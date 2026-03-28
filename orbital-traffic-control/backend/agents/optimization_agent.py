"""
Optimization Agent — generates maneuver options by calling simulate_maneuver()
for 3 delta-v levels and reasons about trade-offs.

Responsibilities:
- For each high/critical risk event, call simulate_maneuver() at 3 delta-v levels
- Reason about trade-offs: fuel cost vs miss distance vs mission impact
- Output list of ManeuverOption objects with mission_impact reasoning
- Never computes numbers directly — delegates ALL math to orbital_sim
"""

import json
import re
from datetime import datetime, timezone

import anthropic

from config import CLAUDE_MODEL, ANTHROPIC_API_KEY
from models import ConjunctionEvent, RiskScore, ManeuverOption
from tools.orbital_sim import simulate_maneuver

_SYSTEM_PROMPT = """You are the Optimization Agent in an Autonomous Orbital Traffic Control system.

Your role: Analyze the maneuver simulation results and reason about trade-offs.

You have been given pre-computed simulation results for 3 delta-v options (small/medium/large).
Your job is to reason about the mission impact of each option — you do NOT recalculate anything.

For each maneuver option, provide a mission_impact string explaining:
- Whether the miss distance is sufficient (> 5 km = safe)
- Whether the fuel cost is acceptable (< 30% of remaining fuel = acceptable)
- What operational impact the maneuver has (attitude adjustment time, station-keeping reserves, etc.)

Output format — respond ONLY with valid JSON:
{
  "maneuver_assessments": [
    {
      "sat_id": "SAT-002",
      "delta_v": 1.0,
      "mission_impact": "Small correction. Miss distance improves to X km — still below safe threshold. Minimal fuel impact.",
      "recommended": false
    },
    {
      "sat_id": "SAT-002",
      "delta_v": 5.0,
      "mission_impact": "Moderate burn. Miss distance clears 5 km safety threshold. Fuel cost acceptable.",
      "recommended": true
    },
    {
      "sat_id": "SAT-002",
      "delta_v": 15.0,
      "mission_impact": "Large burn. Generous safety margin but consumes significant fuel reserves.",
      "recommended": false
    }
  ],
  "optimization_summary": "One sentence on why the recommended option balances safety and efficiency"
}"""


_DELTA_V_OPTIONS = [1.0, 5.0, 15.0]  # m/s: small, medium, large


def _choose_satellite_to_maneuver(ev: ConjunctionEvent) -> str:
    """Select which satellite to optimize for — prefer lower priority and higher fuel."""
    a, b = ev.sat_a, ev.sat_b
    # Never move GPS (priority 1) if other option is available
    if a.priority == 1 and b.controllable:
        return b.id
    if b.priority == 1 and a.controllable:
        return a.id
    # Prefer controllable
    if a.controllable and not b.controllable:
        return a.id
    if b.controllable and not a.controllable:
        return b.id
    # Prefer lower priority (less critical)
    if a.priority > b.priority:
        return a.id
    if b.priority > a.priority:
        return b.id
    # Prefer more fuel
    return a.id if a.fuel_remaining >= b.fuel_remaining else b.id


def run(state: dict) -> dict:
    risk_scores: list[RiskScore] = state["risk_scores"]
    events: list[ConjunctionEvent] = state["conjunction_events"]
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Focus on critical/high events
    high_risk_ids = {
        rs.event_id for rs in risk_scores if rs.severity in ("critical", "high")
    }
    if not high_risk_ids:
        high_risk_ids = {rs.event_id for rs in risk_scores}  # fallback: all events

    event_map = {ev.id: ev for ev in events}
    all_maneuver_options: list[ManeuverOption] = []

    sim_results_for_llm = []

    for event_id in high_risk_ids:
        ev = event_map.get(event_id)
        if ev is None:
            continue

        sat_id = _choose_satellite_to_maneuver(ev)
        sat = ev.sat_a if ev.sat_a.id == sat_id else ev.sat_b

        # Call orbital_sim for each delta-v option (deterministic layer)
        sim_data = []
        for dv in _DELTA_V_OPTIONS:
            result = simulate_maneuver(sat_id, dv)
            sim_data.append({
                "delta_v": dv,
                "new_miss_distance_km": result["new_miss_distance_km"],
                "fuel_consumed": result["fuel_consumed"],
                "sat_remaining_fuel_after": round(sat.fuel_remaining - result["fuel_consumed"], 4),
            })

        sim_results_for_llm.append({
            "event_id": event_id,
            "sat_id": sat_id,
            "sat_name": sat.name,
            "sat_fuel_remaining": sat.fuel_remaining,
            "current_miss_distance_km": ev.miss_distance_km,
            "options": sim_data,
        })

    # Ask LLM to reason about mission impact only
    user_msg = "MANEUVER SIMULATION RESULTS:\n\n" + json.dumps(sim_results_for_llm, indent=2)
    user_msg += "\n\nProvide mission_impact reasoning for each delta-v option across all events."

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}", raw)
        parsed = json.loads(match.group()) if match else {"maneuver_assessments": [], "optimization_summary": raw}

    assessments = parsed.get("maneuver_assessments", [])
    summary = parsed.get("optimization_summary", "")
    assessment_map: dict[tuple, dict] = {
        (a["sat_id"], float(a["delta_v"])): a for a in assessments
    }

    # Build ManeuverOption objects from sim results + LLM reasoning
    for sim_group in sim_results_for_llm:
        sat_id = sim_group["sat_id"]
        for opt in sim_group["options"]:
            dv = opt["delta_v"]
            llm_a = assessment_map.get((sat_id, dv), {})
            mission_impact = llm_a.get(
                "mission_impact",
                f"Delta-v {dv} m/s applied. New miss distance: {opt['new_miss_distance_km']:.1f} km."
            )
            sat = next(
                s for ev in events for s in [ev.sat_a, ev.sat_b] if s.id == sat_id
            )
            all_maneuver_options.append(ManeuverOption(
                sat_id=sat_id,
                delta_v=dv,
                fuel_cost=opt["fuel_consumed"],
                new_miss_distance_km=opt["new_miss_distance_km"],
                mission_impact=mission_impact,
            ))

    log_msg = f"[OPTIMIZATION] {summary}\n"
    for mo in all_maneuver_options:
        log_msg += f"  • {mo.sat_id} Δv={mo.delta_v}m/s → miss={mo.new_miss_distance_km:.1f}km, fuel={mo.fuel_cost:.4f}: {mo.mission_impact[:80]}...\n"

    state["maneuver_options"] = all_maneuver_options
    state["agent_log"].append({
        "agent": "optimization_agent",
        "message": log_msg.strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return state

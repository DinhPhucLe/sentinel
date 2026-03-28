"""
Negotiation Agent — the key differentiator.

Responsibilities:
- Receive all ManeuverOptions
- Reason about which satellite should move and which maneuver to execute
- Consider: priority, fuel, controllability, operator policy
- Output a single chosen ManeuverOption with detailed rationale
- Must respect: GPS satellites (priority 1) never maneuver unless no other option exists

This agent's system prompt is the most carefully crafted in the pipeline.
"""

import json
import re
from datetime import datetime, timezone

import anthropic

from config import CLAUDE_MODEL, ANTHROPIC_API_KEY
from models import ConjunctionEvent, RiskScore, ManeuverOption, Decision

_SYSTEM_PROMPT = """You are the Negotiation Agent in an Autonomous Orbital Traffic Control system.

Your role: Make the final call — which satellite moves, and with which maneuver.

## Operator Policy (legally binding — must be followed exactly)
1. GPS satellites (priority 1) NEVER maneuver unless NO other option exists
2. ISS (priority 1) may maneuver only if debris field risk is classified critical
3. Uncontrollable objects (debris) CANNOT be assigned maneuvers
4. Starlink satellites (priority 2) are preferred candidates for avoidance maneuvers
5. When two eligible satellites exist, prefer the one with MORE fuel remaining

## Decision Criteria (apply in this order)
1. Eliminate: any option targeting an uncontrollable satellite
2. Eliminate: any option that brings fuel below 10% remaining (fuel_cost > 90% of remaining fuel is catastrophic)
3. Prioritize: options where new_miss_distance_km > 10 km (comfortable safety margin)
4. Among valid options: prefer the smallest delta_v that achieves > 5 km miss distance
5. If all options fail to reach 5 km, escalate to governance with the best available

## Rationale Requirements
Your rationale MUST explain:
- Why this specific satellite was chosen to maneuver (not the other)
- Why this delta-v level was selected over the alternatives
- What policy rules were applied and whether any exceptions were considered
- The operational consequence of this decision

Output format — respond ONLY with valid JSON:
{
  "chosen_sat_id": "SAT-002",
  "chosen_delta_v": 5.0,
  "rationale": "Detailed multi-sentence rationale explaining the decision...",
  "policy_rules_applied": ["rule 1 applied", "rule 4 applied"],
  "alternatives_rejected": [
    {"sat_id": "SAT-001", "reason": "GPS priority 1 — policy prohibition"},
    {"delta_v": 1.0, "reason": "Insufficient miss distance improvement"}
  ]
}"""


def _format_input(state: dict) -> str:
    events: list[ConjunctionEvent] = state["conjunction_events"]
    risk_scores: list[RiskScore] = state["risk_scores"]
    maneuver_options: list[ManeuverOption] = state["maneuver_options"]

    lines = ["SITUATION SUMMARY:\n"]

    # Conjunction events
    for ev in events:
        rs = next((r for r in risk_scores if r.event_id == ev.id), None)
        lines.append(f"Conjunction {ev.id}:")
        lines.append(f"  {ev.sat_a.name} ({ev.sat_a.id}) — priority={ev.sat_a.priority}, operator={ev.sat_a.operator}, fuel={ev.sat_a.fuel_remaining:.0%}, controllable={ev.sat_a.controllable}")
        lines.append(f"  {ev.sat_b.name} ({ev.sat_b.id}) — priority={ev.sat_b.priority}, operator={ev.sat_b.operator}, fuel={ev.sat_b.fuel_remaining:.0%}, controllable={ev.sat_b.controllable}")
        lines.append(f"  Probability: {ev.collision_probability:.0%}, TCA: {ev.time_to_closest_approach_hours:.1f}h, Miss dist: {ev.miss_distance_km:.2f} km")
        if rs:
            lines.append(f"  Risk severity: {rs.severity}")
            lines.append(f"  Risk reasoning: {rs.reasoning[:200]}")
        lines.append("")

    lines.append("AVAILABLE MANEUVER OPTIONS:\n")
    for mo in maneuver_options:
        lines.append(f"  Satellite: {mo.sat_id} | Δv={mo.delta_v} m/s | Fuel cost={mo.fuel_cost:.4f} | New miss dist={mo.new_miss_distance_km:.1f} km")
        lines.append(f"    Mission impact: {mo.mission_impact}")

    lines.append("\nApply operator policy and decision criteria to select the optimal maneuver.")
    return "\n".join(lines)


def run(state: dict) -> dict:
    maneuver_options: list[ManeuverOption] = state["maneuver_options"]
    events: list[ConjunctionEvent] = state["conjunction_events"]

    if not maneuver_options:
        # No options available — create a fallback
        state["agent_log"].append({
            "agent": "negotiation_agent",
            "message": "[NEGOTIATION] No maneuver options available. Cannot produce decision.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return state

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1500,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _format_input(state)}],
    )

    raw = response.content[0].text.strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}", raw)
        parsed = json.loads(match.group()) if match else {}

    chosen_sat_id = parsed.get("chosen_sat_id")
    chosen_delta_v = float(parsed.get("chosen_delta_v", 5.0))
    rationale = parsed.get("rationale", "Decision made based on operator policy.")
    policy_rules = parsed.get("policy_rules_applied", [])
    alternatives_rejected = parsed.get("alternatives_rejected", [])

    # Find the matching ManeuverOption
    chosen_option = next(
        (mo for mo in maneuver_options
         if mo.sat_id == chosen_sat_id and abs(mo.delta_v - chosen_delta_v) < 0.01),
        None,
    )

    if chosen_option is None:
        # Fallback: pick the safest option for the lowest-priority controllable satellite
        controllable_options = [
            mo for mo in maneuver_options
            if any(
                (ev.sat_a.id == mo.sat_id and ev.sat_a.controllable) or
                (ev.sat_b.id == mo.sat_id and ev.sat_b.controllable)
                for ev in events
            )
        ]
        if controllable_options:
            chosen_option = max(controllable_options, key=lambda mo: mo.new_miss_distance_km)
        else:
            chosen_option = maneuver_options[0]

    # Determine the event id for this decision
    event_id = "CONJ-001"
    for ev in events:
        if ev.sat_a.id == chosen_option.sat_id or ev.sat_b.id == chosen_option.sat_id:
            event_id = ev.id
            break

    decision = Decision(
        event_id=event_id,
        chosen_maneuver=chosen_option,
        rationale=rationale,
        decided_by="negotiation_agent",
        validated=False,  # governance_agent sets this
        validation_notes="",
    )

    policy_summary = "; ".join(policy_rules) if policy_rules else "Standard policy applied"
    rejected_summary = "; ".join(
        r.get("reason", "") for r in alternatives_rejected
    ) if alternatives_rejected else ""

    log_msg = (
        f"[NEGOTIATION] Decision: {chosen_option.sat_id} executes Δv={chosen_delta_v}m/s\n"
        f"  Policy applied: {policy_summary}\n"
        f"  Rationale: {rationale[:300]}"
    )
    if rejected_summary:
        log_msg += f"\n  Rejected alternatives: {rejected_summary[:200]}"

    state["decision"] = decision
    state["agent_log"].append({
        "agent": "negotiation_agent",
        "message": log_msg.strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return state

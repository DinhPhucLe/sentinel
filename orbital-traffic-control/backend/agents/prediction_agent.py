"""
Prediction Agent — contextualises risk scores with satellite priority,
time windows, and debris field implications.

Responsibilities:
- Receive prioritised events + tracking assessments
- Add contextual reasoning: what does it MEAN if this collision happens?
- Consider satellite priority (GPS > Starlink > ISS > debris)
- Consider debris field proliferation (Kessler syndrome risk)
- Output RiskScore objects with human-readable reasoning
- Does NOT compute any numbers — interprets what orbital_sim provided
"""

import json
import re
from datetime import datetime, timezone

import anthropic

from config import CLAUDE_MODEL, ANTHROPIC_API_KEY
from models import ConjunctionEvent, RiskScore

_SYSTEM_PROMPT = """You are the Prediction Agent in an Autonomous Orbital Traffic Control system.

Your role: Contextualise each risk event — what does it actually MEAN for orbital safety?

Context you must consider:
- Priority 1 satellites (GPS, ISS) are critical infrastructure — their loss affects millions
- Priority 2 satellites (Starlink) create large debris fields if destroyed
- Priority 4 (DEBRIS) collisions can trigger Kessler syndrome — cascading collisions
- Time window matters: under 6 hours is crisis-level, under 24 hours is urgent

Output format — respond ONLY with valid JSON:
{
  "risk_scores": [
    {
      "event_id": "CONJ-001",
      "probability": 0.82,
      "severity": "critical",
      "reasoning": "Multi-sentence explanation of why this is dangerous, what the consequences are, and what factors amplify the risk."
    }
  ],
  "cascade_risk": "Brief assessment of whether these events could trigger a Kessler cascade"
}"""


def _format_input(state: dict) -> str:
    events: list[ConjunctionEvent] = state["conjunction_events"]
    assessments: list[dict] = state.get("tracking_assessments", [])

    lines = ["TRACKING AGENT ASSESSMENT:\n"]
    assessment_map = {a["event_id"]: a for a in assessments}

    for ev in events:
        a = assessment_map.get(ev.id, {})
        lines.append(f"Event: {ev.id}")
        lines.append(f"  Satellites: {ev.sat_a.name} (priority {ev.sat_a.priority}) ↔ {ev.sat_b.name} (priority {ev.sat_b.priority})")
        lines.append(f"  Operators: {ev.sat_a.operator} ↔ {ev.sat_b.operator}")
        lines.append(f"  Collision probability: {ev.collision_probability:.0%}")
        lines.append(f"  Time to closest approach: {ev.time_to_closest_approach_hours:.1f} hours")
        lines.append(f"  Miss distance: {ev.miss_distance_km:.2f} km")
        lines.append(f"  Controllable: {ev.sat_a.name}={ev.sat_a.controllable}, {ev.sat_b.name}={ev.sat_b.controllable}")
        lines.append(f"  Tracking severity: {a.get('severity', 'unknown')}")
        lines.append(f"  Tracking reasoning: {a.get('urgency_reasoning', 'N/A')}")
        lines.append("")

    return "\n".join(lines)


def run(state: dict) -> dict:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _format_input(state)}],
    )

    raw = response.content[0].text.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}", raw)
        parsed = json.loads(match.group()) if match else {"risk_scores": [], "cascade_risk": raw}

    risk_scores_raw = parsed.get("risk_scores", [])
    cascade_risk = parsed.get("cascade_risk", "")

    risk_scores: list[RiskScore] = []
    for rs in risk_scores_raw:
        risk_scores.append(RiskScore(
            event_id=rs["event_id"],
            probability=float(rs["probability"]),
            severity=rs["severity"],
            reasoning=rs["reasoning"],
        ))

    # Build log entry
    log_msg = f"[PREDICTION] Cascade risk assessment: {cascade_risk}\n"
    for rs in risk_scores:
        log_msg += f"  • {rs.event_id} ({rs.severity}, {rs.probability:.0%}): {rs.reasoning[:120]}...\n"

    state["risk_scores"] = risk_scores
    state["agent_log"].append({
        "agent": "prediction_agent",
        "message": log_msg.strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return state

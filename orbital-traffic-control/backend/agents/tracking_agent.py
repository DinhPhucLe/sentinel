"""
Tracking Agent — ingests ConjunctionEvents and reasons about urgency/severity.

Responsibilities:
- Receive raw ConjunctionEvent list from orbital_sim
- Reason about which events are most urgent and why
- Assign severity labels: critical / high / medium / low
- Output prioritised list with reasoning string
- Does NOT compute probabilities — those come from ConjunctionEvent.collision_probability
"""

import json
from datetime import datetime, timezone

import anthropic

from config import CLAUDE_MODEL, ANTHROPIC_API_KEY
from models import ConjunctionEvent, RiskScore

_SYSTEM_PROMPT = """You are the Tracking Agent in an Autonomous Orbital Traffic Control system.

Your role: Receive raw conjunction event data and reason about urgency and severity.

Rules you MUST follow:
- You do NOT compute collision probabilities — those are already provided in the data
- You DO reason about WHY an event is urgent (time window, satellite types, debris implications)
- You assign severity: "critical" (prob > 0.7 AND tca < 6h), "high" (prob > 0.5 OR tca < 12h), "medium", "low"
- Be concise but specific — your reasoning feeds the next agent

Output format — respond ONLY with valid JSON:
{
  "assessments": [
    {
      "event_id": "CONJ-001",
      "severity": "critical",
      "urgency_reasoning": "...",
      "priority_rank": 1
    }
  ],
  "summary": "One sentence overview of the situation"
}"""


def _format_events(events: list[ConjunctionEvent]) -> str:
    lines = ["CONJUNCTION EVENTS REQUIRING ASSESSMENT:\n"]
    for ev in events:
        lines.append(f"Event ID: {ev.id}")
        lines.append(f"  Satellite A: {ev.sat_a.name} ({ev.sat_a.id}) — operator={ev.sat_a.operator}, priority={ev.sat_a.priority}, fuel={ev.sat_a.fuel_remaining:.0%}, controllable={ev.sat_a.controllable}")
        lines.append(f"  Satellite B: {ev.sat_b.name} ({ev.sat_b.id}) — operator={ev.sat_b.operator}, priority={ev.sat_b.priority}, fuel={ev.sat_b.fuel_remaining:.0%}, controllable={ev.sat_b.controllable}")
        lines.append(f"  Time to Closest Approach: {ev.time_to_closest_approach_hours:.1f} hours")
        lines.append(f"  Miss Distance: {ev.miss_distance_km:.2f} km")
        lines.append(f"  Collision Probability: {ev.collision_probability:.0%}")
        lines.append("")
    return "\n".join(lines)


def run(state: dict) -> dict:
    events: list[ConjunctionEvent] = state["conjunction_events"]
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _format_events(events)}],
    )

    raw = response.content[0].text.strip()

    # Parse JSON response
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: extract JSON block if wrapped in markdown
        import re
        match = re.search(r"\{[\s\S]+\}", raw)
        parsed = json.loads(match.group()) if match else {"assessments": [], "summary": raw}

    assessments = parsed.get("assessments", [])
    summary = parsed.get("summary", "")

    # Build log entry
    log_msg = f"[TRACKING] {summary}\n"
    for a in assessments:
        log_msg += f"  • {a['event_id']} → severity={a['severity']}: {a['urgency_reasoning']}\n"

    state["agent_log"].append({
        "agent": "tracking_agent",
        "message": log_msg.strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "assessments": assessments,
    })

    # Store assessments in state for prediction agent
    state["tracking_assessments"] = assessments

    return state

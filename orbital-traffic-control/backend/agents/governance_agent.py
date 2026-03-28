"""
Governance Agent — final validation pass.

Responsibilities:
- Check Decision against hard safety rules
- Rule 1: miss distance after maneuver must be > 5 km
- Rule 2: fuel cost must not exceed 30% of remaining fuel
- Rule 3: uncontrollable debris cannot be assigned maneuvers
- Set validated: True/False with notes
- Acts as the safety net — overrides negotiation if rules are violated
"""

import json
import re
from datetime import datetime, timezone

import anthropic

from config import CLAUDE_MODEL, ANTHROPIC_API_KEY, MIN_SAFE_MISS_DISTANCE_KM, MAX_FUEL_COST_FRACTION
from models import ConjunctionEvent, Decision, ManeuverOption

_SYSTEM_PROMPT = """You are the Governance Agent in an Autonomous Orbital Traffic Control system.

Your role: Final safety validation of the proposed maneuver decision.

## Hard Safety Rules (non-negotiable)
1. MISS DISTANCE: New miss distance must be > 5.0 km after maneuver
2. FUEL LIMIT: Fuel cost must not exceed 30% of the satellite's remaining fuel
3. CONTROLLABILITY: Uncontrollable objects (debris, dead satellites) cannot execute maneuvers

## Your Task
Check each rule against the proposed decision. If any rule is violated, set validated=false.
If all rules pass, set validated=true.

Be precise — cite the exact numbers when explaining a violation or confirmation.

Output format — respond ONLY with valid JSON:
{
  "validated": true,
  "rule_checks": [
    {"rule": "miss_distance", "passed": true, "detail": "New miss distance 17.4 km exceeds 5 km minimum"},
    {"rule": "fuel_limit", "passed": true, "detail": "Fuel cost 0.0062 is 1.0% of remaining fuel 0.62 — within 30% limit"},
    {"rule": "controllability", "passed": true, "detail": "SAT-002 is controllable"}
  ],
  "validation_notes": "All safety checks passed. Decision is approved for execution.",
  "override_action": null
}

If validated=false, set override_action to one of:
- "ABORT" — no safe maneuver available
- "ESCALATE" — requires human operator review"""


def _format_input(state: dict) -> str:
    decision: Decision = state["decision"]
    events: list[ConjunctionEvent] = state["conjunction_events"]
    mo: ManeuverOption = decision.chosen_maneuver

    # Find the satellite
    sat = None
    for ev in events:
        if ev.sat_a.id == mo.sat_id:
            sat = ev.sat_a
            break
        if ev.sat_b.id == mo.sat_id:
            sat = ev.sat_b
            break

    fuel_remaining = sat.fuel_remaining if sat else 1.0
    controllable = sat.controllable if sat else True
    fuel_pct = (mo.fuel_cost / fuel_remaining * 100) if fuel_remaining > 0 else 999

    lines = [
        "PROPOSED DECISION FOR VALIDATION:\n",
        f"Event: {decision.event_id}",
        f"Satellite to maneuver: {mo.sat_id}",
        f"  Controllable: {controllable}",
        f"  Current fuel remaining: {fuel_remaining:.2%}",
        f"Delta-v: {mo.delta_v} m/s",
        f"Fuel cost: {mo.fuel_cost:.4f} ({fuel_pct:.1f}% of remaining fuel)",
        f"New miss distance: {mo.new_miss_distance_km:.2f} km",
        f"Mission impact: {mo.mission_impact}",
        f"\nNegotiation rationale: {decision.rationale[:500]}",
        f"\nSAFETY THRESHOLDS:",
        f"  Minimum safe miss distance: {MIN_SAFE_MISS_DISTANCE_KM} km",
        f"  Maximum fuel cost fraction: {MAX_FUEL_COST_FRACTION * 100:.0f}%",
        "\nValidate all three rules and provide final approval or rejection.",
    ]
    return "\n".join(lines)


def run(state: dict) -> dict:
    decision: Decision | None = state.get("decision")

    if decision is None:
        state["agent_log"].append({
            "agent": "governance_agent",
            "message": "[GOVERNANCE] No decision to validate. Pipeline incomplete.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return state

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
        parsed = json.loads(match.group()) if match else {}

    validated = bool(parsed.get("validated", False))
    validation_notes = parsed.get("validation_notes", "Validation completed.")
    rule_checks = parsed.get("rule_checks", [])
    override_action = parsed.get("override_action")

    # Also run hard-coded deterministic checks (safety backstop)
    mo = decision.chosen_maneuver
    events: list[ConjunctionEvent] = state["conjunction_events"]
    sat = None
    for ev in events:
        if ev.sat_a.id == mo.sat_id:
            sat = ev.sat_a
            break
        if ev.sat_b.id == mo.sat_id:
            sat = ev.sat_b
            break

    hard_violations = []
    if mo.new_miss_distance_km <= MIN_SAFE_MISS_DISTANCE_KM:
        hard_violations.append(f"Miss distance {mo.new_miss_distance_km:.2f} km ≤ {MIN_SAFE_MISS_DISTANCE_KM} km minimum")
    if sat and sat.fuel_remaining > 0 and (mo.fuel_cost / sat.fuel_remaining) > MAX_FUEL_COST_FRACTION:
        hard_violations.append(f"Fuel cost {mo.fuel_cost:.4f} exceeds 30% of remaining {sat.fuel_remaining:.2f}")
    if sat and not sat.controllable:
        hard_violations.append(f"{mo.sat_id} is not controllable — cannot execute maneuver")

    if hard_violations:
        validated = False
        validation_notes = "HARD RULE VIOLATION: " + "; ".join(hard_violations) + ". " + validation_notes

    # Update decision in place
    decision.validated = validated
    decision.validation_notes = validation_notes

    rule_summary = " | ".join(
        f"{r['rule']}={'✓' if r['passed'] else '✗'} {r.get('detail', '')[:60]}"
        for r in rule_checks
    )

    log_msg = (
        f"[GOVERNANCE] Decision {'APPROVED ✓' if validated else 'REJECTED ✗'}\n"
        f"  Rules: {rule_summary}\n"
        f"  Notes: {validation_notes[:300]}"
    )
    if override_action:
        log_msg += f"\n  Override action: {override_action}"

    state["agent_log"].append({
        "agent": "governance_agent",
        "message": log_msg.strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "validated": validated,
        "override_action": override_action,
    })

    return state

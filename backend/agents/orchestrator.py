"""
ADK orchestrator — SequentialAgent pipeline with streaming WebSocket support.

Pipeline: tracking → prediction → optimization → negotiation → governance

If governance rejects, agents automatically escalate and try a different approach:
  Attempt 1 — standard maneuver options (SAT-002, low delta-v preferred)
  Attempt 2 — rejected option removed, alternative satellite options added
  Attempt 3 — emergency override, all options on table including policy exceptions
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Callable, Any

from google.adk.agents import SequentialAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from agents.tracking_agent import tracking_agent
from agents.prediction_agent import prediction_agent
from agents.optimization_agent import optimization_agent
from agents.negotiation_agent import negotiation_agent
from agents.governance_agent import governance_agent
from tools.orbital_sim import get_conjunction_events, get_kessler_cascade_events, simulate_maneuver
from tools.real_data_loader import get_real_kessler_events, get_space_environment_context

# Module-level constant — loaded once when orchestrator is first imported
_SPACE_CONTEXT = get_space_environment_context()

APP_NAME = "orbital_traffic_control"

AGENT_ORDER = [
    "tracking_agent",
    "prediction_agent",
    "optimization_agent",
    "negotiation_agent",
    "governance_agent",
]

_pipeline = None
_session_service = None
_runner = None


def _get_runner() -> Runner:
    global _pipeline, _session_service, _runner
    if _runner is None:
        _pipeline = SequentialAgent(
            name="orbital_pipeline",
            sub_agents=[
                tracking_agent,
                prediction_agent,
                optimization_agent,
                negotiation_agent,
                governance_agent,
            ],
        )
        _session_service = InMemorySessionService()
        _runner = Runner(
            agent=_pipeline,
            app_name=APP_NAME,
            session_service=_session_service,
        )
    return _runner


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_text(event) -> str:
    if not event.content or not event.content.parts:
        return ""
    return "".join(
        part.text for part in event.content.parts if hasattr(part, "text") and part.text
    )


def _is_validated(gov_output: str) -> bool:
    low = gov_output.lower()
    return (
        ("validated: true" in low or "✓ approved" in low or "approved" in low)
        and "rejected" not in low
        and "fail" not in low
    )


def _build_maneuver_table() -> str:
    """
    Pre-compute maneuver simulations for all viable candidates and approaches.
    Returns a formatted table string to inject into the agent brief.
    """
    lines = []

    # SAT-002 (Starlink, priority 2) — primary candidate
    lines.append("SAT-002 (STARLINK-3421, P2, 62% fuel) — preferred candidate:")
    for dv in [1.0, 5.0, 15.0, 25.0]:
        r = simulate_maneuver("SAT-002", dv)
        safe = "✓" if r["new_miss_distance_km"] > 5.0 else "✗"
        lines.append(
            f"  {dv:5.1f} m/s → miss {r['new_miss_distance_km']:6.2f} km  "
            f"fuel {r['fuel_consumed']*100:4.1f}%  {safe}"
        )

    # SAT-001 (GPS, priority 1) — policy restricts this, emergency only
    lines.append("SAT-001 (GPS-IIR-14, P1, 85% fuel) — EMERGENCY / policy override only:")
    for dv in [5.0, 15.0]:
        r = simulate_maneuver("SAT-001", dv)
        safe = "✓" if r["new_miss_distance_km"] > 5.0 else "✗"
        lines.append(
            f"  {dv:5.1f} m/s → miss {r['new_miss_distance_km']:6.2f} km  "
            f"fuel {r['fuel_consumed']*100:4.1f}%  {safe}  [requires policy exception]"
        )

    return "\n".join(lines)


async def _run_pass(
    runner: Runner,
    brief: str,
    user_id: str,
    emit: Callable[[dict], Any],
    attempt: int,
) -> tuple[str, str]:
    """Run one full pipeline pass. Returns (governance_output, negotiation_output)."""
    status_map = {
        "tracking_agent":     "ANALYZING",
        "prediction_agent":   "ANALYZING",
        "optimization_agent": "ANALYZING",
        "negotiation_agent":  "DECIDING",
        "governance_agent":   "VALIDATING",
    }

    session_id = f"run-{uuid.uuid4().hex[:8]}-a{attempt}"
    await _session_service.create_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id,
    )

    seen_agents: set[str] = set()
    buffers: dict[str, list[str]] = {}

    new_message = genai_types.Content(
        role="user", parts=[genai_types.Part(text=brief)],
    )

    async for event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=new_message,
    ):
        author = event.author or ""

        if author in AGENT_ORDER and author not in seen_agents:
            seen_agents.add(author)
            await emit({"type": "status", "status": status_map.get(author, "ANALYZING"), "timestamp": _ts()})

        text = _extract_text(event)
        if not text:
            continue

        buffers.setdefault(author, []).append(text)

        if event.is_final_response() and author in AGENT_ORDER:
            full = "".join(buffers.get(author, [])).strip()
            await emit({"type": "agent_log", "agent": author, "message": full, "timestamp": _ts()})
            await asyncio.sleep(0.1)

    session = await _session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    gov_out = session.state.get("governance_validation", "") if session else ""
    neg_out = session.state.get("negotiation_decision", "") if session else ""
    return gov_out, neg_out


def _reroute_message(attempt: int, neg_output: str, gov_output: str) -> str:
    labels = {
        1: ("REROUTING — ESCALATING TO ALTERNATIVE APPROACH",
            "The initial maneuver was rejected. Agents are now evaluating "
            "alternative satellites and higher delta-v options."),
        2: ("REROUTING — EMERGENCY OVERRIDE AUTHORIZED",
            "Two attempts have failed. Emergency protocol engaged. "
            "All options are now on the table including policy exceptions."),
    }
    title, context = labels.get(attempt, labels[1])
    return (
        f"⚠ {title}\n"
        f"{'─' * 48}\n"
        f"{context}\n\n"
        f"Rejected maneuver:\n{neg_output[:300]}\n\n"
        f"Rejection reason:\n{gov_output[:300]}"
    )


def _attempt_brief(base: str, attempt: int, neg_output: str, gov_output: str) -> str:
    """Build an escalating brief for retry attempts."""
    if attempt == 1:
        return (
            base
            + "\n\n" + "─" * 48
            + "\nATTEMPT 2 — ALTERNATIVE APPROACH REQUIRED\n"
            + "─" * 48
            + f"\nThe following decision FAILED governance validation:\n{neg_output}\n\n"
            + f"Rejection reason:\n{gov_output}\n\n"
            + "Do NOT repeat the same satellite/delta-v combination. "
            + "Consider: a higher delta-v burn on SAT-002, or if SAT-002 options are exhausted, "
            + "evaluate whether SAT-001 emergency maneuver is justifiable. "
            + "The goal is miss distance > 5 km within fuel limits."
        )
    else:  # attempt == 2, final
        return (
            base
            + "\n\n" + "─" * 48
            + "\nATTEMPT 3 — EMERGENCY PROTOCOL\n"
            + "─" * 48
            + f"\nTwo prior decisions were rejected. This is the final attempt.\n\n"
            + f"Last rejected:\n{neg_output}\n\nRejection:\n{gov_output}\n\n"
            + "EMERGENCY AUTHORIZATION: Standard operator policy may be overridden as a last resort. "
            + "If SAT-002 cannot achieve safe separation within fuel limits, "
            + "SAT-001 emergency maneuver IS authorized despite priority-1 policy. "
            + "Choose the option that achieves the largest miss distance margin. "
            + "Mission-critical infrastructure preservation supersedes standard procedure."
        )


async def run_pipeline_streaming(
    emit: Callable[[dict], Any],
    kessler: bool = False,
    event_id: str = None,
) -> None:
    """
    Run the agent pipeline with up to 3 attempts.
    Each rejection escalates to a more aggressive / alternative approach.
    """
    events = get_kessler_cascade_events() if kessler else get_conjunction_events()
    if event_id:
        events = [ev for ev in events if ev.id == event_id] or events

    event_lines = []
    for ev in events:
        event_lines.append(
            f"- {ev.id}: {ev.sat_a.name} ({ev.sat_a.operator}, P{ev.sat_a.priority}) ↔ "
            f"{ev.sat_b.name} ({ev.sat_b.operator}, P{ev.sat_b.priority}) | "
            f"prob={ev.collision_probability:.0%} | TCA={ev.time_to_closest_approach_hours:.1f}h | "
            f"miss={ev.miss_distance_km:.2f} km | "
            f"ctrl_a={ev.sat_a.controllable} ctrl_b={ev.sat_b.controllable}"
        )

    maneuver_table = _build_maneuver_table()

    base_brief = (
        "ACTIVE CONJUNCTION EVENTS:\n"
        + "\n".join(event_lines)
        + "\n\nAVAILABLE MANEUVER OPTIONS (pre-computed):\n"
        + maneuver_table
        + "\n\nGovernance rules: miss distance > 5 km, fuel cost < 30% of remaining fuel, "
        + "only controllable satellites may maneuver."
    )

    runner = _get_runner()
    user_id = "operator"

    await emit({"type": "status", "status": "ANALYZING", "timestamp": _ts()})

    gov_output = ""
    neg_output = ""
    validated = False

    for attempt in range(3):
        if attempt > 0:
            await emit({
                "type": "agent_log",
                "agent": "system",
                "message": _reroute_message(attempt, neg_output, gov_output),
                "timestamp": _ts(),
            })
            await asyncio.sleep(0.4)
            brief = _attempt_brief(base_brief, attempt, neg_output, gov_output)
            await emit({"type": "status", "status": "ANALYZING", "timestamp": _ts()})
        else:
            brief = base_brief

        gov_output, neg_output = await _run_pass(runner, brief, user_id, emit, attempt)
        validated = _is_validated(gov_output)

        if validated:
            break

    await emit({
        "type": "decision",
        "data": {
            "negotiation_decision": neg_output,
            "governance_validation": gov_output,
            "validated": validated,
        },
        "timestamp": _ts(),
    })

    await emit({
        "type": "status",
        "status": "AVOIDED" if validated else "ERROR",
        "timestamp": _ts(),
    })

"""
ADK orchestrator — SequentialAgent pipeline with streaming WebSocket support.

Pipeline: tracking → prediction → optimization → negotiation → governance
If governance rejects, agents automatically reroute and propose an alternative.
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
    return ("validated: true" in low or "✓ approved" in low or "approved" in low) and "rejected" not in low


async def _run_pass(
    runner: Runner,
    brief: str,
    user_id: str,
    emit: Callable[[dict], Any],
    attempt: int,
) -> tuple[str, str]:
    """
    Run one full pipeline pass. Returns (governance_output, negotiation_output).
    Streams agent_log events to the client as each agent completes.
    """
    status_map = {
        "tracking_agent":     "ANALYZING",
        "prediction_agent":   "ANALYZING",
        "optimization_agent": "ANALYZING",
        "negotiation_agent":  "DECIDING",
        "governance_agent":   "VALIDATING",
    }

    session_id = f"run-{uuid.uuid4().hex[:8]}-a{attempt}"
    await _session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    seen_agents: set[str] = set()
    buffers: dict[str, list[str]] = {}

    new_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=brief)],
    )

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
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
            await emit({
                "type": "agent_log",
                "agent": author,
                "message": full,
                "timestamp": _ts(),
            })
            await asyncio.sleep(0.1)

    session = await _session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    gov_out = session.state.get("governance_validation", "") if session else ""
    neg_out = session.state.get("negotiation_decision", "") if session else ""
    return gov_out, neg_out


async def run_pipeline_streaming(
    emit: Callable[[dict], Any],
    kessler: bool = False,
    event_id: str = None,
) -> None:
    """
    Run the agent pipeline with automatic rerouting if governance rejects.

    Attempt 1 → agents propose a solution
    If rejected → emit system REROUTING message → Attempt 2 with rejection context
    If still rejected → emit ERROR
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
            f"miss={ev.miss_distance_km:.2f}km | "
            f"ctrl_a={ev.sat_a.controllable} ctrl_b={ev.sat_b.controllable}"
        )

    maneuver_lines = []
    for dv in [1.0, 5.0, 15.0]:
        result = simulate_maneuver("SAT-002", dv)
        maneuver_lines.append(
            f"  delta_v={dv} m/s → miss_distance={result['new_miss_distance_km']:.2f} km, "
            f"fuel_consumed={result['fuel_consumed']:.1f}%, "
            f"status={result.get('status', 'ok')}"
        )

    base_brief = (
        "ACTIVE CONJUNCTION EVENTS — assess immediately:\n"
        + "\n".join(event_lines)
        + "\n\nPRE-COMPUTED MANEUVER OPTIONS FOR SAT-002 (Starlink, 62% fuel remaining):\n"
        + "\n".join(maneuver_lines)
        + "\n\nSafety minimum: miss distance > 5 km, fuel cost < 30% of remaining fuel."
    )

    runner = _get_runner()
    user_id = "operator"

    await emit({"type": "status", "status": "ANALYZING", "timestamp": _ts()})

    gov_output = ""
    neg_output = ""
    validated = False

    for attempt in range(2):
        if attempt == 1:
            # Reroute: inject rejection context so agents pick a different maneuver
            await emit({
                "type": "agent_log",
                "agent": "system",
                "message": (
                    "⚠ REROUTING — ALTERNATIVE SOLUTION REQUIRED\n"
                    "─────────────────────────────────────────────\n"
                    "Governance rejected the proposed maneuver.\n"
                    "Agents are re-evaluating all options.\n\n"
                    f"Rejected decision:\n{neg_output[:400]}\n\n"
                    f"Rejection reason:\n{gov_output[:400]}"
                ),
                "timestamp": _ts(),
            })
            await asyncio.sleep(0.3)

            brief = (
                base_brief
                + "\n\n"
                + "─" * 48
                + "\nPREVIOUS DECISION REJECTED — FIND ALTERNATIVE\n"
                + "─" * 48
                + f"\nThe following maneuver was proposed but FAILED governance:\n{neg_output}\n\n"
                + f"Governance rejection reason:\n{gov_output}\n\n"
                + "You MUST select a different maneuver option. "
                + "The rejected option is off the table. "
                + "Consider higher delta-v for greater miss distance margin, "
                + "or re-examine whether a different satellite should maneuver. "
                + "Do not repeat the same choice."
            )
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

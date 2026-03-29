"""
ADK orchestrator — SequentialAgent pipeline with streaming WebSocket support.

Pipeline: tracking → prediction → optimization → negotiation → governance

Each agent's output is stored in session state via output_key and is visible
to subsequent agents through the conversation history.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator, Callable, Any

from google.adk.agents import SequentialAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from agents.tracking_agent import tracking_agent
from agents.prediction_agent import prediction_agent
from agents.optimization_agent import optimization_agent
from agents.negotiation_agent import negotiation_agent
from agents.governance_agent import governance_agent
from tools.orbital_sim import get_conjunction_events, get_kessler_cascade_events

APP_NAME = "orbital_traffic_control"

# Agent display order for streaming — maps author name to label
AGENT_ORDER = [
    "tracking_agent",
    "prediction_agent",
    "optimization_agent",
    "negotiation_agent",
    "governance_agent",
]

# Lazily initialised — built on first call to run_pipeline_streaming
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
    """Pull plain text out of an ADK Event content object."""
    if not event.content or not event.content.parts:
        return ""
    return "".join(
        part.text for part in event.content.parts if hasattr(part, "text") and part.text
    )


async def run_pipeline_streaming(
    emit: Callable[[dict], Any],
    kessler: bool = False,
) -> None:
    """
    Run the full ADK agent pipeline and call emit() with each WebSocket message.

    emit() receives dicts:
      {"type": "agent_log", "agent": "...", "message": "...", "timestamp": "..."}
      {"type": "decision", "data": {...}}
      {"type": "status", "status": "..."}
    """
    events = get_kessler_cascade_events() if kessler else get_conjunction_events()

    # Serialise conjunction events as a human-readable brief for the first agent
    event_lines = []
    for ev in events:
        event_lines.append(
            f"- {ev.id}: {ev.sat_a.name} ({ev.sat_a.operator}, P{ev.sat_a.priority}) ↔ "
            f"{ev.sat_b.name} ({ev.sat_b.operator}, P{ev.sat_b.priority}) | "
            f"prob={ev.collision_probability:.0%} | TCA={ev.time_to_closest_approach_hours:.1f}h | "
            f"miss={ev.miss_distance_km:.2f}km | "
            f"ctrl_a={ev.sat_a.controllable} ctrl_b={ev.sat_b.controllable}"
        )
    initial_brief = (
        "ACTIVE CONJUNCTION EVENTS — assess immediately:\n" + "\n".join(event_lines)
    )

    # Initialise runner lazily (first call only — avoids blocking uvicorn startup)
    runner = _get_runner()

    # Create a fresh session per run
    user_id = "operator"
    session_id = f"run-{uuid.uuid4().hex[:8]}"
    _session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    await emit({"type": "status", "status": "ANALYZING", "timestamp": _ts()})

    # Status transitions per agent
    status_map = {
        "tracking_agent":     "ANALYZING",
        "prediction_agent":   "ANALYZING",
        "optimization_agent": "ANALYZING",
        "negotiation_agent":  "DECIDING",
        "governance_agent":   "VALIDATING",
    }

    seen_agents: set[str] = set()
    current_agent_buffer: dict[str, list[str]] = {}

    new_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=initial_brief)],
    )

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
    ):
        author = event.author or ""

        # Emit status transition when a new agent starts
        if author in AGENT_ORDER and author not in seen_agents:
            seen_agents.add(author)
            status = status_map.get(author, "ANALYZING")
            await emit({"type": "status", "status": status, "timestamp": _ts()})

        text = _extract_text(event)
        if not text:
            continue

        # Buffer partial chunks per agent
        if author not in current_agent_buffer:
            current_agent_buffer[author] = []
        current_agent_buffer[author].append(text)

        # On final response from an agent, emit the full message
        if event.is_final_response() and author in AGENT_ORDER:
            full_message = "".join(current_agent_buffer.get(author, []))
            await emit({
                "type": "agent_log",
                "agent": author,
                "message": full_message.strip(),
                "timestamp": _ts(),
            })
            # Small pause so the UI can animate each entry
            await asyncio.sleep(0.1)

    # Emit the governance output as the final decision signal
    session = _session_service.get_session(  # noqa: uses module-level ref set by _get_runner()
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    governance_output = session.state.get("governance_validation", "") if session else ""
    negotiation_output = session.state.get("negotiation_decision", "") if session else ""

    validated = "validated: true" in governance_output.lower() or "approved" in governance_output.lower()

    await emit({
        "type": "decision",
        "data": {
            "negotiation_decision": negotiation_output,
            "governance_validation": governance_output,
            "validated": validated,
        },
        "timestamp": _ts(),
    })

    await emit({
        "type": "status",
        "status": "AVOIDED" if validated else "ERROR",
        "timestamp": _ts(),
    })

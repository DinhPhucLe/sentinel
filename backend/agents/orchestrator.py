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
from tools.orbital_sim import get_conjunction_events, get_kessler_cascade_events, simulate_maneuver
from tools.real_data_loader import get_real_kessler_events, get_space_environment_context

# Module-level constant — loaded once when orchestrator is first imported
_SPACE_CONTEXT = get_space_environment_context()

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
    event_id: str = None,
) -> None:
    """
    Run the full ADK agent pipeline and call emit() with each WebSocket message.

    emit() receives dicts:
      {"type": "agent_log", "agent": "...", "message": "...", "timestamp": "..."}
      {"type": "decision", "data": {...}}
      {"type": "status", "status": "..."}
    """
    # --- Primary event (always scripted, always SAT-001 vs SAT-002) ---
    events = get_conjunction_events()
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

    # Pre-compute maneuver simulations for the primary event (SAT-002)
    maneuver_lines = []
    for dv in [1.0, 5.0, 15.0]:
        result = simulate_maneuver("SAT-002", dv)
        maneuver_lines.append(
            f"  delta_v={dv} m/s → miss_distance={result['new_miss_distance_km']:.2f} km, "
            f"fuel_consumed={result['fuel_consumed']:.1f}%, "
            f"status={result.get('status', 'ok')}"
        )

    # --- Kessler cascade: real CDMs or scripted fallback ---
    if kessler:
        real_events = get_real_kessler_events(top_n=5)
        if real_events:
            cascade_lines = ["SECONDARY CONJUNCTION WARNINGS (real NORAD CDM data):"]
            for ev in real_events:
                cascade_lines.append(
                    f"- {ev['id']}: {ev['sat_a_name']} ({ev['sat_a_type']}, "
                    f"ctrl={ev['sat_a_controllable']}) ↔ "
                    f"{ev['sat_b_name']} ({ev['sat_b_type']}, "
                    f"ctrl={ev['sat_b_controllable']}) | "
                    f"prob={ev['collision_probability']:.4%} | "
                    f"TCA={ev['time_to_closest_approach_hours']:.1f}h | "
                    f"miss={ev['miss_distance_km']:.0f}km"
                )
            cascade_section = "\n".join(cascade_lines)
        else:
            # Fallback to scripted cascade if dataset unavailable
            cascade_events = get_kessler_cascade_events()
            cascade_lines = ["SECONDARY CONJUNCTION WARNINGS (simulated):"]
            for ev in cascade_events:
                cascade_lines.append(
                    f"- {ev.id}: {ev.sat_a.name} ↔ {ev.sat_b.name} | "
                    f"prob={ev.collision_probability:.0%} | "
                    f"TCA={ev.time_to_closest_approach_hours:.1f}h | "
                    f"miss={ev.miss_distance_km:.2f}km"
                )
            cascade_section = "\n".join(cascade_lines)
    else:
        cascade_section = ""

    # --- Assemble the full brief ---
    sections = [
        _SPACE_CONTEXT,
        "",
        "ACTIVE CONJUNCTION EVENTS — assess immediately:",
        "\n".join(event_lines),
        "",
        "PRE-COMPUTED MANEUVER OPTIONS FOR SAT-002 (Starlink, 62% fuel remaining):",
        "\n".join(maneuver_lines),
    ]
    if cascade_section:
        sections += ["", cascade_section]

    sections += [
        "",
        "Safety minimum: miss distance > 5 km, fuel cost < 30% of remaining fuel.",
        "Respond with urgency. These are live events.",
    ]

    initial_brief = "\n".join(sections)

    # Initialise runner lazily (first call only — avoids blocking uvicorn startup)
    runner = _get_runner()

    # Create a fresh session per run
    user_id = "operator"
    session_id = f"run-{uuid.uuid4().hex[:8]}"
    await _session_service.create_session(
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
    session = await _session_service.get_session(
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

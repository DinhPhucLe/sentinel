"""
LangGraph orchestrator — wires all agents into a sequential pipeline.

State flows: tracking → prediction → optimization → negotiation → governance

The orchestrator streams agent_log entries over WebSocket as each node completes.
Agents never call each other directly — all data passes through AgentState.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Callable

from langgraph.graph import StateGraph, END

from models import AgentState, ConjunctionEvent, RiskScore, ManeuverOption, Decision
from tools.orbital_sim import get_conjunction_events

# Import agent node functions (defined below as thin wrappers)
from agents.tracking_agent import run as tracking_run
from agents.prediction_agent import run as prediction_run
from agents.optimization_agent import run as optimization_run
from agents.negotiation_agent import run as negotiation_run
from agents.governance_agent import run as governance_run


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Node wrappers — each node updates state and appends to agent_log
# ---------------------------------------------------------------------------

def tracking_node(state: dict) -> dict:
    return tracking_run(state)


def prediction_node(state: dict) -> dict:
    return prediction_run(state)


def optimization_node(state: dict) -> dict:
    return optimization_run(state)


def negotiation_node(state: dict) -> dict:
    return negotiation_run(state)


def governance_node(state: dict) -> dict:
    return governance_run(state)


# ---------------------------------------------------------------------------
# Build the LangGraph graph
# ---------------------------------------------------------------------------

def _build_graph() -> Any:
    graph = StateGraph(dict)
    graph.add_node("tracking", tracking_node)
    graph.add_node("prediction", prediction_node)
    graph.add_node("optimization", optimization_node)
    graph.add_node("negotiation", negotiation_node)
    graph.add_node("governance", governance_node)

    graph.set_entry_point("tracking")
    graph.add_edge("tracking", "prediction")
    graph.add_edge("prediction", "optimization")
    graph.add_edge("optimization", "negotiation")
    graph.add_edge("negotiation", "governance")
    graph.add_edge("governance", END)

    return graph.compile()


_COMPILED_GRAPH = None


def get_compiled_graph():
    global _COMPILED_GRAPH
    if _COMPILED_GRAPH is None:
        _COMPILED_GRAPH = _build_graph()
    return _COMPILED_GRAPH


# ---------------------------------------------------------------------------
# Async streaming runner — used by the WebSocket endpoint
# ---------------------------------------------------------------------------

async def run_pipeline_streaming(
    emit: Callable[[dict], Any],
    kessler: bool = False,
) -> dict:
    """
    Run the full agent pipeline and call emit() with each WebSocket message.

    emit() receives dicts like:
      {"type": "agent_log", "agent": "...", "message": "...", "timestamp": "..."}
      {"type": "decision", "data": {...}}
      {"type": "status", "status": "..."}
    """
    from tools.orbital_sim import get_conjunction_events, get_kessler_cascade_events

    events = get_kessler_cascade_events() if kessler else get_conjunction_events()

    initial_state: dict = {
        "conjunction_events": events,
        "risk_scores": [],
        "maneuver_options": [],
        "decision": None,
        "agent_log": [],
    }

    await emit({"type": "status", "status": "ANALYZING", "timestamp": _ts()})

    # Run each node manually so we can stream after each completes
    state = initial_state

    # Node sequence with display names
    nodes = [
        ("tracking", tracking_node, "TRACKING"),
        ("prediction", prediction_node, "ANALYZING"),
        ("optimization", optimization_node, "ANALYZING"),
        ("negotiation", negotiation_node, "DECIDING"),
        ("governance", governance_node, "VALIDATING"),
    ]

    seen_log_count = 0

    for node_name, node_fn, status in nodes:
        await emit({"type": "status", "status": status, "timestamp": _ts()})

        # Run node in a thread to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        state = await loop.run_in_executor(None, node_fn, state)

        # Stream any new agent_log entries produced by this node
        new_entries = state["agent_log"][seen_log_count:]
        for entry in new_entries:
            await emit({"type": "agent_log", **entry})
            await asyncio.sleep(0.05)  # slight pacing for UI effect
        seen_log_count = len(state["agent_log"])

    # Emit the final decision
    decision: Decision | None = state.get("decision")
    if decision:
        await emit({
            "type": "decision",
            "data": decision.to_dict(),
            "timestamp": _ts(),
        })
        await emit({"type": "status", "status": "AVOIDED", "timestamp": _ts()})
    else:
        await emit({
            "type": "status",
            "status": "ERROR",
            "message": "No decision produced",
            "timestamp": _ts(),
        })

    return state

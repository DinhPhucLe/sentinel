"""
FastAPI backend for Autonomous Orbital Traffic Control.

Routes:
  GET  /api/satellites       — all satellites from mock data
  GET  /api/events           — current conjunction events
  POST /api/trigger-scenario — starts the agent pipeline
  POST /api/reset            — resets pipeline to MONITORING state
  POST /api/chat             — AI assistant (Groq) with live orbital context
  WS   /ws/agent-stream      — streams agent_log entries in real time
"""

import asyncio
import json
import logging
import os
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone

# ── Logging setup — prints all errors to terminal ──
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("sentinel")

from dotenv import load_dotenv
# Load .env from repo root (sentinel/.env) or backend/.env — whichever exists first
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Ensure backend package root is on path
import sys
sys.path.insert(0, os.path.dirname(__file__))

from models import Satellite, ConjunctionEvent
from tools.orbital_sim import get_conjunction_events, get_kessler_cascade_events
from config import WS_MSG_AGENT, WS_MSG_DECISION, WS_MSG_STATUS, WS_MSG_ERROR


# ---------------------------------------------------------------------------
# Connection manager for WebSocket broadcasts
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def send(self, ws: WebSocket, data: dict):
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            self.disconnect(ws)

    async def broadcast(self, data: dict):
        disconnected = []
        for ws in list(self.active):
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)


manager = ConnectionManager()

# Pipeline lock — only one run at a time
_pipeline_running = False


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Orbital Traffic Control API", version="1.0.0")

@app.on_event("startup")
async def startup_log():
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    logger.info("=" * 50)
    logger.info("SENTINEL backend starting")
    logger.info(f"ANTHROPIC_API_KEY: {'SET (' + key[:12] + '...)' if key else 'NOT SET'}")
    from config import AGENT_MODEL
    logger.info(f"Agent model: {AGENT_MODEL}")
    logger.info("=" * 50)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_DATA_DIR = Path(__file__).parent.parent / "data"

# Serve data files (debris cloud JSON for frontend visualization)
if _DATA_DIR.exists():
    app.mount(
        "/data",
        StaticFiles(directory=str(_DATA_DIR)),
        name="data",
    )


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/api/satellites")
async def get_satellites():
    from tools.real_data_loader import get_real_satellites
    return get_real_satellites()


@app.get("/api/events")
async def get_events():
    events = get_conjunction_events()
    return {"events": [ev.to_dict() for ev in events]}


@app.post("/api/trigger-scenario")
async def trigger_scenario(body: dict = None):
    global _pipeline_running

    if _pipeline_running:
        return {"status": "already_running", "message": "Pipeline is already running"}

    body = body or {}
    kessler = body.get("kessler", False)
    event_id = body.get("event_id", None)

    async def run():
        global _pipeline_running
        _pipeline_running = True
        logger.info(f"Pipeline started — kessler={kessler}, event_id={event_id}")
        try:
            from agents.orchestrator import run_pipeline_streaming

            async def emit(data: dict):
                logger.debug(f"WS emit: type={data.get('type')} agent={data.get('agent', '-')}")
                await manager.broadcast(data)

            await run_pipeline_streaming(emit=emit, kessler=kessler, event_id=event_id)
            logger.info("Pipeline completed successfully")
        except Exception as e:
            logger.error(f"Pipeline FAILED: {e}")
            logger.error(traceback.format_exc())
            await manager.broadcast({
                "type": WS_MSG_ERROR,
                "message": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        finally:
            _pipeline_running = False

    asyncio.create_task(run())
    return {"status": "started", "kessler": kessler}


@app.post("/api/reset")
async def reset_scenario():
    global _pipeline_running
    _pipeline_running = False
    await manager.broadcast({
        "type": "status",
        "status": "MONITORING",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "reset"}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/agent-stream")
async def ws_agent_stream(websocket: WebSocket):
    await manager.connect(websocket)
    # Send welcome / initial status
    await manager.send(websocket, {
        "type": "status",
        "status": "MONITORING",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    try:
        while True:
            # Keep connection alive — client messages are ignored
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------

@app.post("/api/chat")
async def chat(body: dict):
    import re
    from fastapi import HTTPException
    from litellm import acompletion

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")

    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    context = body.get("context", {})
    history = body.get("history", [])

    satellites = context.get("satellites", [])
    events = context.get("events", [])
    status = context.get("status", "MONITORING")
    view = context.get("view", "mission")
    agent_activity = context.get("agentActivity", "")

    sat_summary = json.dumps(satellites[:10], indent=2) if satellites else "No satellites loaded yet."
    event_summary = json.dumps(events[:5], indent=2) if events else "No conjunction events active."

    activity_section = f"\n## Recent Agent Activity (last pipeline run)\n{agent_activity}" if agent_activity else ""

    system_prompt = f"""You are Sentinel AI, the intelligent assistant embedded in the Sentinel Orbital Traffic Control dashboard. You help operators understand the live orbital situation and navigate the UI.

## Live System State
- Pipeline status: {status}
- Active view: {view}
- Satellites tracked: {len(satellites)}
- Active conjunction events: {len(events)}

## Live Satellite Data
{sat_summary}

## Active Conjunction Events
{event_summary}

## Dashboard Navigation
The sidebar has 4 views:
- **dashboard** — analytics charts, orbital traffic stats, agent response time histograms
- **mission** — 3D orbit canvas + live agent reasoning log + conjunction triage table + mission control panel
- **satellites** — card view of all tracked satellites (fuel, altitude, controllability, priority)
- **alerts** — real-time alert feed sorted by severity

In the Mission view, the 3D OrbitCanvas has:
- LAYERS button — toggle per-satellite and per-severity conjunction tier visibility (CRITICAL/HIGH/MEDIUM/LOW)
- SETTINGS button — camera sensitivity, simulation speed, invert controls
- Click any satellite to open its detail popup (fuel, altitude, active conjunctions)
{activity_section}
## Orbital Knowledge
- LEO (Low Earth Orbit): 160–2,000 km — most congested zone; ISS (~408 km) and Starlink (~550 km) are here
- MEO (Medium Earth Orbit): 2,000–35,786 km — GPS constellation at ~20,200 km
- GEO (Geostationary Orbit): 35,786 km — comms satellites, appear stationary above equator
- Kessler Syndrome: a cascade where collisions create debris that causes more collisions, eventually making an orbital shell unusable
- TCA (Time of Closest Approach): when two objects reach minimum separation
- PC (Collision Probability): > 0.01% (1-in-10,000) triggers mandatory avoidance review in real operations; > 0.1% is a critical emergency
- TLE (Two-Line Element): standard orbital state format. Key fields:
  - EPOCH: reference time for accuracy
  - Mean Motion: revolutions per day (higher = lower orbit)
  - Inclination: orbital tilt relative to equator
  - BSTAR: atmospheric drag coefficient

## Governance Rules (hard constraints)
- GPS satellites (priority 1) never maneuver unless no other option
- Fuel cost per maneuver must not exceed 30% of remaining fuel
- Miss distance after maneuver must exceed 5 km
- Uncontrollable debris objects cannot be assigned maneuvers

## Agent Pipeline
When a scenario is triggered, 5 agents run in sequence:
1. tracking_agent — assesses event urgency and severity
2. prediction_agent — contextualises risk (Kessler cascade implications, operator impact)
3. optimization_agent — simulates 3 delta-v maneuver options, reasons about trade-offs
4. negotiation_agent — applies operator policy to pick which satellite moves and which burn to execute
5. governance_agent — validates the decision against the 3 hard safety rules

## Globe Control
When the user asks to navigate or filter, append ONE action block at the very end of your response (nothing after it):
<action>{{"type":"SET_VIEW","payload":{{"view":"alerts"}}}}</action>

Available actions:
- SET_VIEW — navigate to a view. payload: {{"view": "dashboard"|"mission"|"satellites"|"alerts"}}
- SET_LAYER — toggle a conjunction tier. payload: {{"layer": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"orbitRings", "visible": true|false}}

Only emit an action when the user explicitly asks to navigate or toggle a layer. Never emit an action for informational questions.

## Style
- Be concise and direct — operators are busy during an incident
- Use real space-operations terminology
- Never invent satellite data; use only what is in the live context above
- For navigation requests, confirm what you did and include the action
"""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-10:]:
        if msg.get("role") in ("user", "assistant") and msg.get("content"):
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": message})

    import time
    t0 = time.time()
    try:
        response = await acompletion(
            model="anthropic/claude-sonnet-4-6",
            messages=messages,
            max_tokens=600,
            temperature=0.3,
        )
    except Exception as e:
        logger.error(f"Chat LLM error: {e}")
        raise HTTPException(status_code=502, detail="AI service unavailable — check ANTHROPIC_API_KEY")

    elapsed_ms = round((time.time() - t0) * 1000)
    text = response.choices[0].message.content or ""

    # Extract optional action block
    action = None
    match = re.search(r"<action>(.*?)</action>", text, re.DOTALL)
    if match:
        try:
            action = json.loads(match.group(1))
        except Exception:
            pass
        text = text.replace(match.group(0), "").strip()

    logger.info(f"Chat response: {elapsed_ms}ms | action={action['type'] if action else None}")
    return {"response": text, "action": action}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

"""
FastAPI backend for Autonomous Orbital Traffic Control.

Routes:
  GET  /api/satellites       — all satellites from mock data
  GET  /api/events           — current conjunction events
  POST /api/trigger-scenario — starts the agent pipeline
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
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

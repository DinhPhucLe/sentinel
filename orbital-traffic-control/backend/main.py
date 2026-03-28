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
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend package root is on path
import sys
sys.path.insert(0, os.path.dirname(__file__))

from models import Satellite, ConjunctionEvent
from tools.orbital_sim import get_conjunction_events, get_kessler_cascade_events
from agents.orchestrator import run_pipeline_streaming
from config import WS_MSG_AGENT, WS_MSG_DECISION, WS_MSG_STATUS, WS_MSG_ERROR

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/api/satellites")
async def get_satellites():
    path = os.path.join(_DATA_DIR, "mock_satellites.json")
    with open(path) as f:
        data = json.load(f)
    return data


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

    async def run():
        global _pipeline_running
        _pipeline_running = True
        try:
            async def emit(data: dict):
                await manager.broadcast(data)

            await run_pipeline_streaming(emit=emit, kessler=kessler)
        except Exception as e:
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

"""
Integration tests for the FastAPI backend.
Covers: health check, satellite list, events list, duplicate trigger rejection, reset.
"""

import pytest
from httpx import AsyncClient, ASGITransport

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


async def test_satellites_returns_four(client):
    response = await client.get("/api/satellites")
    assert response.status_code == 200
    data = response.json()
    assert "satellites" in data
    assert len(data["satellites"]) == 4


async def test_events_returns_conj001(client):
    response = await client.get("/api/events")
    assert response.status_code == 200
    data = response.json()
    assert "events" in data
    assert len(data["events"]) == 1
    event = data["events"][0]
    assert event["id"] == "CONJ-001"
    assert abs(event["collision_probability"] - 0.82) < 0.01


async def test_duplicate_trigger_rejected(client):
    import main as main_module
    main_module._pipeline_running = True
    try:
        response = await client.post("/api/trigger-scenario")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "already_running"
    finally:
        main_module._pipeline_running = False


async def test_reset(client):
    response = await client.post("/api/reset")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "reset"

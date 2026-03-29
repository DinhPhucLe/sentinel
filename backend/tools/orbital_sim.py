"""
Deterministic orbital simulation layer.

IMPORTANT: This module must NEVER import from agents/.
All functions here are pure math — no LLM calls.
"""

import math
import os
import sys

# Allow imports from backend root when run as a script
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import Satellite, ConjunctionEvent
from tools.real_data_loader import get_real_satellites, get_real_scenario


def _load_satellites() -> dict[str, Satellite]:
    data = get_real_satellites()
    satellites = {}
    for s in data["satellites"]:
        sat = Satellite(
            id=s["id"],
            name=s["name"],
            operator=s["operator"],
            priority=s["priority"],
            altitude_km=s["altitude_km"],
            fuel_remaining=s["fuel_remaining"],
            position=tuple(s["position"]),
            velocity=tuple(s["velocity"]),
            controllable=s["controllable"],
            inclination=s.get("inclination", 0.0),
        )
        satellites[sat.id] = sat
    return satellites


def _load_scenario() -> dict:
    scenario = get_real_scenario()
    if scenario is None:
        raise RuntimeError(
            "No future CDM events available in dataset/data/processed/conjunctions.json. "
            "Re-download the CDM feed from Space-Track.org."
        )
    return scenario


def _distance(pos_a: tuple, pos_b: tuple) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(pos_a, pos_b)))


def get_conjunction_events() -> list[ConjunctionEvent]:
    """
    Load conjunction events from the collision_course scenario.
    Returns only the primary events (not Kessler cascades).
    This is the ONLY source of conjunction data.
    """
    satellites = _load_satellites()
    scenario = _load_scenario()
    events = []
    for ev in scenario["conjunction_events"]:
        sat_a = satellites[ev["sat_a_id"]]
        sat_b = satellites[ev["sat_b_id"]]
        events.append(ConjunctionEvent(
            id=ev["id"],
            sat_a=sat_a,
            sat_b=sat_b,
            time_to_closest_approach_hours=ev["time_to_closest_approach_hours"],
            miss_distance_km=ev["miss_distance_km"],
            collision_probability=ev["collision_probability"],
        ))
    return events


def compute_collision_probability(sat_a: Satellite, sat_b: Satellite) -> float:
    """
    Distance-based collision probability estimate.
    No LLM — pure geometry.
    Returns float 0.0–1.0.
    """
    dist = _distance(sat_a.position, sat_b.position)
    # Sigmoid-style mapping: closer = higher probability
    # At dist=50 km → ~0.82, at dist=500 km → ~0.02
    if dist <= 0:
        return 1.0
    raw = math.exp(-dist / 60.0)
    return round(min(max(raw, 0.0), 1.0), 4)


def simulate_maneuver(sat_id: str, delta_v: float) -> dict:
    """
    Simulate the result of applying delta_v (m/s) to a satellite.
    Returns new predicted position and updated miss_distance_km.
    Uses linear approximation — no real orbital mechanics.
    """
    satellites = _load_satellites()
    scenario = _load_scenario()

    if sat_id not in satellites:
        raise ValueError(f"Unknown satellite id: {sat_id}")

    sat = satellites[sat_id]

    # Find conjunction involving this satellite
    conjunction = None
    for ev in scenario["conjunction_events"]:
        if ev["sat_a_id"] == sat_id or ev["sat_b_id"] == sat_id:
            conjunction = ev
            break

    if conjunction is None:
        # No active conjunction; maneuver has no miss-distance effect
        return {
            "sat_id": sat_id,
            "delta_v_applied": delta_v,
            "new_position": list(sat.position),
            "new_miss_distance_km": 999.0,
            "fuel_consumed": round(delta_v * 0.001, 4),
        }

    base_miss_km = conjunction["miss_distance_km"]
    tca_hours = conjunction["time_to_closest_approach_hours"]

    # Linear approximation: each m/s of delta_v improves miss distance
    # More time → more leverage per m/s
    leverage = tca_hours * 0.8  # km per m/s of delta_v
    delta_miss = delta_v * leverage
    new_miss_km = round(base_miss_km + delta_miss, 2)

    # Fuel cost: proportional to delta_v (Tsiolkovsky approximation, simplified)
    fuel_consumed = round(delta_v * 0.001 * (1 / max(sat.fuel_remaining, 0.01)), 4)
    fuel_consumed = min(fuel_consumed, sat.fuel_remaining)

    # Slight position shift perpendicular to velocity
    vx, vy, vz = sat.velocity
    speed = math.sqrt(vx**2 + vy**2 + vz**2) or 1.0
    # Perpendicular nudge (simplified — rotate in x-z plane)
    nudge_km = delta_v * tca_hours * 3.6 / 1000  # rough km shift
    new_pos = (
        round(sat.position[0] + nudge_km * (-vz / speed), 2),
        round(sat.position[1], 2),
        round(sat.position[2] + nudge_km * (vx / speed), 2),
    )

    return {
        "sat_id": sat_id,
        "delta_v_applied": delta_v,
        "new_position": list(new_pos),
        "new_miss_distance_km": new_miss_km,
        "fuel_consumed": fuel_consumed,
    }


def get_kessler_cascade_events() -> list[ConjunctionEvent]:
    """
    Returns 5–8 cascading conjunction events for the stretch demo.
    Simulates a Kessler syndrome scenario.
    """
    satellites = _load_satellites()
    scenario = _load_scenario()
    events = []
    for ev in scenario.get("kessler_cascade_events", []):
        sat_a_id = ev["sat_a_id"]
        sat_b_id = ev["sat_b_id"]
        # Some satellites in cascade events may not exist in mock data;
        # create minimal placeholders if needed
        sat_a = satellites.get(sat_a_id) or Satellite(
            id=sat_a_id, name=sat_a_id, operator="UNKNOWN", priority=4,
            altitude_km=400.0, fuel_remaining=0.0,
            position=(0.0, 0.0, 0.0), velocity=(0.0, 0.0, 0.0), controllable=False
        )
        sat_b = satellites.get(sat_b_id) or Satellite(
            id=sat_b_id, name=sat_b_id, operator="UNKNOWN", priority=4,
            altitude_km=400.0, fuel_remaining=0.0,
            position=(0.0, 0.0, 0.0), velocity=(0.0, 0.0, 0.0), controllable=False
        )
        events.append(ConjunctionEvent(
            id=ev["id"],
            sat_a=sat_a,
            sat_b=sat_b,
            time_to_closest_approach_hours=ev["time_to_closest_approach_hours"],
            miss_distance_km=ev["miss_distance_km"],
            collision_probability=ev["collision_probability"],
        ))
    return events

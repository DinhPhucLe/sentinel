"""
ADK-compatible tool wrappers around the deterministic orbital_sim layer.

These are plain Python functions with docstrings — Google ADK registers them
as tools automatically. They delegate ALL math to orbital_sim.py.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tools.orbital_sim import (
    get_conjunction_events as _get_conjunctions,
    compute_collision_probability as _compute_prob,
    simulate_maneuver as _simulate,
    get_kessler_cascade_events as _get_kessler,
)


def get_conjunction_events() -> list[dict]:
    """
    Return all active conjunction events from the orbital surveillance system.
    Each event contains two satellites on a potential collision course,
    their time to closest approach in hours, miss distance in km,
    and collision probability as a float 0-1.
    """
    return [ev.to_dict() for ev in _get_conjunctions()]


def simulate_maneuver(sat_id: str, delta_v: float) -> dict:
    """
    Simulate the outcome of applying a delta-v burn to a satellite.

    Args:
        sat_id: Satellite identifier (e.g. 'SAT-002')
        delta_v: Maneuver magnitude in m/s (try 1.0, 5.0, or 15.0)

    Returns a dict with new_miss_distance_km, fuel_consumed, and new_position.
    """
    return _simulate(sat_id, delta_v)


def get_kessler_cascade_events() -> list[dict]:
    """
    Return the full Kessler cascade event chain — multiple secondary conjunctions
    triggered by debris from an initial collision. Use this for cascade risk assessment.
    """
    return [ev.to_dict() for ev in _get_kessler()]

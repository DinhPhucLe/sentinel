"""Tests for tools/orbital_sim.py — deterministic layer only."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from models import Satellite, ConjunctionEvent
from tools.orbital_sim import (
    get_conjunction_events,
    compute_collision_probability,
    simulate_maneuver,
    get_kessler_cascade_events,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_satellite(id="SAT-TEST", position=(0.0, 0.0, 0.0), fuel=0.8,
                   priority=2, controllable=True) -> Satellite:
    return Satellite(
        id=id, name=f"Test-{id}", operator="TEST", priority=priority,
        altitude_km=500.0, fuel_remaining=fuel,
        position=position, velocity=(0.0, 7.5, 0.0),
        controllable=controllable,
    )


# ---------------------------------------------------------------------------
# get_conjunction_events
# ---------------------------------------------------------------------------

class TestGetConjunctionEvents:
    def test_returns_list(self):
        events = get_conjunction_events()
        assert isinstance(events, list)

    def test_at_least_one_event(self):
        events = get_conjunction_events()
        assert len(events) >= 1

    def test_event_is_conjunction_event(self):
        events = get_conjunction_events()
        assert all(isinstance(e, ConjunctionEvent) for e in events)

    def test_primary_event_satellites(self):
        events = get_conjunction_events()
        primary = events[0]
        assert primary.sat_a.id == "SAT-001"
        assert primary.sat_b.id == "SAT-002"

    def test_primary_event_probability(self):
        events = get_conjunction_events()
        primary = events[0]
        assert primary.collision_probability == pytest.approx(0.82)

    def test_primary_event_tca(self):
        events = get_conjunction_events()
        primary = events[0]
        assert primary.time_to_closest_approach_hours == pytest.approx(4.2)

    def test_event_id_not_empty(self):
        events = get_conjunction_events()
        for ev in events:
            assert ev.id


# ---------------------------------------------------------------------------
# compute_collision_probability
# ---------------------------------------------------------------------------

class TestComputeCollisionProbability:
    def test_close_satellites_high_prob(self):
        a = make_satellite("A", position=(0.0, 0.0, 0.0))
        b = make_satellite("B", position=(10.0, 0.0, 0.0))
        prob = compute_collision_probability(a, b)
        assert prob > 0.5

    def test_distant_satellites_low_prob(self):
        a = make_satellite("A", position=(0.0, 0.0, 0.0))
        b = make_satellite("B", position=(1000.0, 0.0, 0.0))
        prob = compute_collision_probability(a, b)
        assert prob < 0.1

    def test_coincident_satellites_max_prob(self):
        a = make_satellite("A", position=(0.0, 0.0, 0.0))
        b = make_satellite("B", position=(0.0, 0.0, 0.0))
        prob = compute_collision_probability(a, b)
        assert prob == pytest.approx(1.0)

    def test_return_type_float(self):
        a = make_satellite("A", position=(100.0, 0.0, 0.0))
        b = make_satellite("B", position=(200.0, 0.0, 0.0))
        prob = compute_collision_probability(a, b)
        assert isinstance(prob, float)

    def test_probability_bounds(self):
        a = make_satellite("A", position=(0.0, 0.0, 0.0))
        b = make_satellite("B", position=(50.0, 0.0, 0.0))
        prob = compute_collision_probability(a, b)
        assert 0.0 <= prob <= 1.0

    def test_monotonic_with_distance(self):
        a = make_satellite("A", position=(0.0, 0.0, 0.0))
        probs = []
        for dist in [10, 50, 200, 500]:
            b = make_satellite("B", position=(float(dist), 0.0, 0.0))
            probs.append(compute_collision_probability(a, b))
        # Should be strictly decreasing
        for i in range(len(probs) - 1):
            assert probs[i] > probs[i + 1]


# ---------------------------------------------------------------------------
# simulate_maneuver
# ---------------------------------------------------------------------------

class TestSimulateManeuver:
    def test_returns_dict(self):
        result = simulate_maneuver("SAT-002", 5.0)
        assert isinstance(result, dict)

    def test_required_keys(self):
        result = simulate_maneuver("SAT-002", 5.0)
        required = {"sat_id", "delta_v_applied", "new_position", "new_miss_distance_km", "fuel_consumed"}
        assert required.issubset(result.keys())

    def test_larger_delta_v_improves_miss_distance(self):
        small = simulate_maneuver("SAT-002", 1.0)
        large = simulate_maneuver("SAT-002", 10.0)
        assert large["new_miss_distance_km"] > small["new_miss_distance_km"]

    def test_fuel_consumed_positive(self):
        result = simulate_maneuver("SAT-002", 5.0)
        assert result["fuel_consumed"] > 0.0

    def test_fuel_consumed_not_exceed_available(self):
        result = simulate_maneuver("SAT-002", 1000.0)
        # SAT-002 has 0.62 fuel — consumed should not exceed that
        assert result["fuel_consumed"] <= 0.62 + 1e-6

    def test_invalid_sat_id_raises(self):
        with pytest.raises(ValueError):
            simulate_maneuver("NONEXISTENT-SAT", 5.0)

    def test_new_position_is_list_of_three(self):
        result = simulate_maneuver("SAT-002", 5.0)
        assert isinstance(result["new_position"], list)
        assert len(result["new_position"]) == 3


# ---------------------------------------------------------------------------
# get_kessler_cascade_events
# ---------------------------------------------------------------------------

class TestGetKesslerCascadeEvents:
    def test_returns_list(self):
        events = get_kessler_cascade_events()
        assert isinstance(events, list)

    def test_has_multiple_events(self):
        events = get_kessler_cascade_events()
        assert len(events) >= 4

    def test_all_conjunction_events(self):
        events = get_kessler_cascade_events()
        assert all(isinstance(e, ConjunctionEvent) for e in events)

    def test_probabilities_in_range(self):
        events = get_kessler_cascade_events()
        for ev in events:
            assert 0.0 <= ev.collision_probability <= 1.0

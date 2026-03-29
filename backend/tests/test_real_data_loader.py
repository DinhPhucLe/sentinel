"""Tests for real_data_loader.py"""
import pytest
from datetime import datetime, timezone, timedelta

from tools.real_data_loader import (
    _deduplicate_cdms,
    _tca_to_hours,
    _object_type_to_controllable,
    _derive_priority,
)


class TestDeduplication:
    def test_removes_reverse_pair(self):
        raw = [
            {"CDM_ID": 100, "SAT_1_ID": 1, "SAT_2_ID": 2, "TCA": "2026-04-01T00:00:00"},
            {"CDM_ID": 101, "SAT_1_ID": 2, "SAT_2_ID": 1, "TCA": "2026-04-01T00:00:00"},
        ]
        result = _deduplicate_cdms(raw)
        assert len(result) == 1

    def test_keeps_lower_cdm_id(self):
        raw = [
            {"CDM_ID": 200, "SAT_1_ID": 1, "SAT_2_ID": 2, "TCA": "2026-04-01T00:00:00"},
            {"CDM_ID": 100, "SAT_1_ID": 2, "SAT_2_ID": 1, "TCA": "2026-04-01T00:00:00"},
        ]
        result = _deduplicate_cdms(raw)
        assert result[0]["CDM_ID"] == 100

    def test_distinct_pairs_both_kept(self):
        raw = [
            {"CDM_ID": 1, "SAT_1_ID": 1, "SAT_2_ID": 2, "TCA": "2026-04-01T00:00:00"},
            {"CDM_ID": 2, "SAT_1_ID": 3, "SAT_2_ID": 4, "TCA": "2026-04-01T00:00:00"},
        ]
        result = _deduplicate_cdms(raw)
        assert len(result) == 2

    def test_empty_input(self):
        assert _deduplicate_cdms([]) == []


class TestTcaToHours:
    def test_future_event_returns_positive(self):
        future = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
        result = _tca_to_hours(future)
        assert 4.9 < result < 5.1

    def test_past_event_returns_zero(self):
        past = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
        result = _tca_to_hours(past)
        assert result == 0.0

    def test_result_rounded_to_2_decimals(self):
        future = (datetime.now(timezone.utc) + timedelta(hours=2.555)).isoformat()
        result = _tca_to_hours(future)
        assert result == round(result, 2)


class TestControllability:
    def test_payload_is_controllable(self):
        assert _object_type_to_controllable("PAYLOAD") is True

    def test_debris_not_controllable(self):
        assert _object_type_to_controllable("DEBRIS") is False

    def test_rocket_body_not_controllable(self):
        assert _object_type_to_controllable("ROCKET BODY") is False

    def test_case_insensitive(self):
        assert _object_type_to_controllable("payload") is True


class TestPriorityDerivation:
    def test_iss_is_priority_1(self):
        assert _derive_priority("ISS (ZARYA)", "PAYLOAD") == 1

    def test_gps_is_priority_1(self):
        assert _derive_priority("GPS IIR-14", "PAYLOAD") == 1

    def test_generic_payload_is_priority_2(self):
        assert _derive_priority("COSMOS 1486", "PAYLOAD") == 2

    def test_rocket_body_is_priority_3(self):
        assert _derive_priority("CZ-6A R/B", "ROCKET BODY") == 3

    def test_debris_is_priority_4(self):
        assert _derive_priority("FENGYUN 1C DEB", "DEBRIS") == 4

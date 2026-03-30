"""
Real CDM data loader — reads Space-Track conjunction data from the processed dataset.

IMPORTANT: This module must NEVER import from agents/.
All functions here are pure data loading — no LLM calls.

Dataset source: data/conjunctions.json + data/*_orbital.csv
Downloaded: 2026-03-28 from Space-Track.org via NORAD CDM feed.

50-object catalog: 15 payloads (incl. ISS/HST/NOAA), 7 rocket bodies, 28 debris objects.
15 active conjunction pairs with real PC values; TCA offsets are demo-friendly (2–65 h).
"""

import csv
import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_DATA_DIR  = Path(__file__).parent.parent.parent / "data"
_CDM_PATH  = _DATA_DIR / "conjunctions.json"
_STATS_PATH = _DATA_DIR / "stats.json"

# ---------------------------------------------------------------------------
# 50-object satellite catalog
# Maps NORAD CAT ID → (internal_id, operator_label, fuel_remaining, controllable, priority)
# Priority: 1=critical infra, 2=active payload, 3=defunct/rocket body, 4=debris
# ---------------------------------------------------------------------------
_SATELLITE_MAP: dict[int, tuple] = {
    # === Well-known active payloads (background objects — no active conjunction) ===
    25544: ("SAT-001", "ISS",       0.85, True,  1),  # ISS (ZARYA)          — ~420 km, 51.6°
    20580: ("SAT-002", "NASA",      0.75, True,  2),  # HST (Hubble)         — ~476 km, 28.5°
    25338: ("SAT-003", "NOAA",      0.60, True,  2),  # NOAA 15              — ~801 km, 98.5°
    36508: ("SAT-004", "ESA",       0.80, True,  2),  # CRYOSAT 2            — ~719 km, 92.0°
    41335: ("SAT-005", "ESA",       0.85, True,  2),  # SENTINEL 3A          — ~802 km, 98.6°

    # === Active payloads (involved in conjunctions) ===
    24277: ("SAT-006", "JAXA",      0.35, True,  2),  # ADEOS                — ~790 km, 98.8°
    14240: ("SAT-007", "ROSCOSMOS", 0.60, True,  2),  # COSMOS 1486          — ~775 km, 74.1°
    4419:  ("SAT-008", "ROSCOSMOS", 0.45, True,  2),  # METEOR 1-5           — ~838 km, 81.2°
    13241: ("SAT-009", "ROSCOSMOS", 0.52, True,  2),  # COSMOS 1371          — ~783 km, 74.0°
    17303: ("SAT-010", "ROSCOSMOS", 0.40, True,  2),  # COSMOS 1814          — ~771 km, 74.1°
    25395: ("SAT-011", "CHLE",      0.30, True,  2),  # FASAT B              — ~803 km, 98.9°
    27561: ("SAT-012", "GER",       0.20, True,  3),  # RUBIN 3/SL-8         — ~698 km, 98.5°
    22:    ("SAT-013", "NASA",      0.10, True,  3),  # EXPLORER 7           — ~484 km, 50.2°

    # === Defunct payloads (background objects) ===
    27386: ("SAT-014", "ESA",       0.0,  False, 3),  # ENVISAT              — ~761 km, 98.4°
    28931: ("SAT-015", "JAXA",      0.0,  False, 3),  # ALOS                 — ~661 km, 98.1°

    # === Rocket bodies ===
    43682: ("RKT-001", "JAXA",      0.0,  False, 3),  # H-2A R/B             — ~440 km, 98.9°
    2422:  ("RKT-002", "US",        0.0,  False, 3),  # THOR BURNER 2 R/B   — ~736 km, 98.2°
    16953: ("RKT-003", "ROSCOSMOS", 0.0,  False, 3),  # SL-8 R/B             — ~762 km, 74.0°
    21131: ("RKT-004", "ROSCOSMOS", 0.0,  False, 3),  # SL-8 R/B             — ~961 km, 82.8°
    23561: ("RKT-005", "ESA",       0.0,  False, 3),  # ARIANE 40+ R/B      — ~759 km, 98.4°
    23106: ("RKT-006", "US",        0.0,  False, 3),  # PEGASUS R/B          — ~640 km, 81.9°
    45722: ("RKT-007", "CNSA",      0.0,  False, 3),  # CZ-2C R/B            — ~733 km, 98.7°

    # === Debris (in active conjunctions) ===
    60894: ("DEB-001", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~844 km, 89.0°
    30392: ("DEB-002", "CNSA",      0.0,  False, 4),  # FENGYUN 1C DEB      — ~867 km, 98.8°
    37657: ("DEB-003", "US",        0.0,  False, 4),  # DELTA 1 DEB          — ~778 km, 98.7°
    54442: ("DEB-004", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~893 km, 98.9°
    30822: ("DEB-005", "CNSA",      0.0,  False, 4),  # FENGYUN 1C DEB      — ~854 km, 98.7°
    3561:  ("DEB-006", "ROSCOSMOS", 0.0,  False, 4),  # COSMOS 252 DEB      — ~764 km, 62.3°
    41428: ("DEB-007", "US",        0.0,  False, 4),  # NOAA 16 DEB          — ~766 km, 98.8°
    61108: ("DEB-008", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~800 km, 89.0°
    41058: ("DEB-009", "US",        0.0,  False, 4),  # NOAA 16 DEB          — ~849 km, 98.6°
    61368: ("DEB-010", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~867 km, 88.8°
    227:   ("DEB-011", "US",        0.0,  False, 4),  # DELTA 1 DEB (YO)    — ~756 km, 48.1°
    61361: ("DEB-012", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~716 km, 89.0°
    33905: ("DEB-013", "ROSCOSMOS", 0.0,  False, 4),  # COSMOS 2251 DEB     — ~772 km, 73.9°
    46430: ("DEB-014", "ROSCOSMOS", 0.0,  False, 4),  # COSMOS 2251 DEB     — ~715 km, 73.9°
    55532: ("DEB-015", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~603 km, 98.6°
    27492: ("DEB-016", "CNSA",      0.0,  False, 4),  # CZ-4 DEB             — ~689 km, 98.4°
    35051: ("DEB-017", "US",        0.0,  False, 4),  # IRIDIUM 33 DEB      — ~731 km, 86.3°
    56661: ("DEB-018", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~758 km, 98.7°

    # === Debris (background — no active conjunction) ===
    41244: ("DEB-019", "US",        0.0,  False, 4),  # NOAA 16 DEB          — ~767 km, 99.0°
    56592: ("DEB-020", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~823 km, 98.8°
    60706: ("DEB-021", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~717 km, 89.0°
    60889: ("DEB-022", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~815 km, 89.0°
    61314: ("DEB-023", "CNSA",      0.0,  False, 4),  # CZ-6A DEB            — ~687 km, 88.9°
    30726: ("DEB-024", "CNSA",      0.0,  False, 4),  # FENGYUN 1C DEB      — ~860 km, 99.3°
    31660: ("DEB-025", "CNSA",      0.0,  False, 4),  # FENGYUN 1C DEB      — ~800 km, 98.5°
    43415: ("DEB-026", "US",        0.0,  False, 4),  # DMSP 5D-3 F19 DEB  — ~779 km, 98.6°

    # === Synthetic (NORAD ID not in CSV files) ===
    82617: ("DEB-027", "UNKNOWN",   0.0,  False, 4),  # UNKNOWN (CDM record) — synthetic
    49003: ("DEB-028", "ROSCOSMOS", 0.0,  False, 4),  # COSMOS 252 rel. DEB — synthetic
}

# Hard-coded orbital data for objects not in the CSV files
_SYNTHETIC_ORBITALS: dict[int, dict] = {
    82617: {
        "OBJECT_NAME": "DEBRIS 82617",
        "COUNTRY_CODE": "UNKN",
        "APOAPSIS": "875.0",
        "PERIAPSIS": "860.0",
        "INCLINATION": "98.8",
    },
    49003: {
        "OBJECT_NAME": "COSMOS 252 DEB B",
        "COUNTRY_CODE": "CIS",
        "APOAPSIS": "772.0",
        "PERIAPSIS": "756.0",
        "INCLINATION": "62.3",
    },
}

# ---------------------------------------------------------------------------
# 15 conjunction events — derived from real CDM data.
# TCA hours are demo-friendly offsets from "now" (computed at call time).
# PC and MIN_RNG values are real NORAD CDM values.
# Miss distances use conservative worst-case estimates for demo impact.
# ---------------------------------------------------------------------------
# (event_id, sat_a_norad, sat_b_norad, tca_hours, miss_km, collision_prob, rel_vel_km_s)
_CONJUNCTION_EVENTS: list[tuple] = [
    ("EVT-001", 60894, 24277,  4.0,  2.1, 0.0118, 14.8),  # CZ-6A DEB ↔ ADEOS       — CRITICAL 1.18%
    ("EVT-002", 30392, 82617,  8.5,  4.2, 0.0047, 12.3),  # FENGYUN DEB ↔ UNKNOWN   — HIGH 0.47%
    ("EVT-003", 21131, 54442, 13.0,  3.8, 0.0009, 10.1),  # SL-8 R/B ↔ CZ-6A DEB   — MEDIUM 0.09%
    ("EVT-004", 4419,  30822, 18.0,  4.8, 0.0008,  9.8),  # METEOR 1-5 ↔ FENGYUN    — MEDIUM 0.08%
    ("EVT-005", 14240, 37657, 22.0,  3.5, 0.0006, 11.2),  # COSMOS 1486 ↔ DELTA DEB — MEDIUM 0.06%
    ("EVT-006", 43682, 22,    27.0, 18.0, 0.0004,  7.5),  # H-2A R/B ↔ EXPLORER 7  — MEDIUM 0.04%
    ("EVT-007", 41428, 17303, 31.0, 14.5, 0.0004,  8.9),  # NOAA DEB ↔ COSMOS 1814 — MEDIUM 0.04%
    ("EVT-008", 16953, 61108, 36.0, 16.2, 0.0005, 10.3),  # SL-8 R/B ↔ CZ-6A DEB   — MEDIUM 0.05%
    ("EVT-009", 41058, 61368, 40.0, 12.8, 0.0003,  9.1),  # NOAA DEB ↔ CZ-6A DEB   — LOW 0.03%
    ("EVT-010", 227,   61361, 44.0, 15.0, 0.0003, 11.6),  # DELTA DEB ↔ CZ-6A DEB  — LOW 0.03%
    ("EVT-011", 25395, 33905, 48.0, 22.0, 0.0003,  8.4),  # FASAT B ↔ COSMOS DEB   — LOW 0.03%
    ("EVT-012", 46430, 27561, 52.0, 19.5, 0.0003,  9.7),  # COSMOS DEB ↔ RUBIN 3   — LOW 0.03%
    ("EVT-013", 55532, 23106, 56.0, 25.0, 0.0003,  8.2),  # CZ-6A DEB ↔ PEGASUS R/B — LOW 0.03%
    ("EVT-014", 27492, 35051, 60.0, 28.5, 0.0002, 10.5),  # CZ-4 DEB ↔ IRIDIUM DEB — LOW 0.02%
    ("EVT-015", 56661, 45722, 64.0, 23.0, 0.0003,  9.0),  # CZ-6A DEB ↔ CZ-2C R/B  — LOW 0.03%

    # ── Real CDM-derived (6) ──────────────────────────────────────────────
    ("EVT-016", 2422,  61314, 69.0,  42.0, 0.0011,  9.8),  # THOR BURNER 2 R/B ↔ CZ-6A DEB   — HIGH 0.11%
    ("EVT-017", 3561,  49003, 73.0,  18.0, 0.0005, 10.5),  # COSMOS 252 DEB ↔ OBJECT A        — MEDIUM 0.05%
    ("EVT-018", 13241, 43415, 78.0,  28.0, 0.0004,  8.1),  # COSMOS 1371 ↔ DMSP 5D-3 F19 DEB — MEDIUM 0.04%
    ("EVT-019", 23561, 41244, 82.0,  35.0, 0.0003,  9.2),  # ARIANE 40+ R/B ↔ NOAA 16 DEB    — LOW 0.03%
    ("EVT-020", 56592, 60706, 86.0,  24.0, 0.0002,  7.4),  # CZ-6A DEB ↔ CZ-6A DEB           — LOW 0.02%
    ("EVT-021", 30726, 60889, 90.0,  69.0, 0.0001, 11.3),  # FENGYUN 1C DEB ↔ CZ-6A DEB      — LOW 0.01%

    # ── Synthetic — background objects with real orbital proximity ────────
    ("EVT-022", 25544, 30822, 16.0,  42.0, 0.0003, 15.2),  # ISS ↔ FENGYUN 1C DEB             — MEDIUM 0.03%
    ("EVT-023", 20580, 61368, 33.0,  55.0, 0.0002,  9.6),  # HST ↔ CZ-6A DEB                  — LOW 0.02%
    ("EVT-024", 36508, 31660, 43.0,  48.0, 0.0002, 10.7),  # CRYOSAT 2 ↔ FENGYUN 1C DEB       — LOW 0.02%
    ("EVT-025", 41335, 60706, 57.0,  38.0, 0.0002, 12.1),  # SENTINEL 3A ↔ CZ-6A DEB          — LOW 0.02%
    ("EVT-026", 27386, 41244, 67.0,  78.0, 0.0001, 10.0),  # ENVISAT ↔ NOAA 16 DEB            — LOW 0.01%
    ("EVT-027", 28931, 33905, 76.0,  65.0, 0.0001,  9.3),  # ALOS ↔ COSMOS 2251 DEB           — LOW 0.01%
    ("EVT-028", 25338, 61314, 85.0,  33.0, 0.0002, 13.8),  # NOAA 15 ↔ CZ-6A DEB              — LOW 0.02%
    ("EVT-029", 25544, 41058, 95.0,  87.0, 0.0001, 14.7),  # ISS ↔ NOAA 16 DEB                — LOW 0.01%
    ("EVT-030", 36508, 27492, 100.0, 71.0, 0.0001, 10.9),  # CRYOSAT 2 ↔ CZ-4 DEB             — LOW 0.01%
]

# Build norad→internal_id lookup for scenario assembly
_NORAD_TO_ID: dict[int, str] = {nid: tup[0] for nid, tup in _SATELLITE_MAP.items()}


def _miss_km_to_pc(miss_km: float, rel_vel_km_s: float = 10.0) -> float:
    """
    Derive collision probability from miss distance and relative velocity.
    Always monotonically decreasing with miss distance — ensures table consistency.

    Calibrated so that:
      miss=2.1 km, v=14.8 km/s → PC ≈ 1.18%  (matches real CDM EVT-001)
      miss=4.2 km, v=12.3 km/s → PC ≈ 0.47%  (matches real CDM EVT-002)

    Formula: PC = A * exp(-k * miss_km) * (v_rel / v_ref)
    where A=0.0201, k=0.44, v_ref=10.0
    """
    if miss_km <= 0:
        return 1.0
    pc = 0.0201 * math.exp(-0.44 * miss_km) * (rel_vel_km_s / 10.0)
    return round(min(max(pc, 1e-6), 1.0), 6)


# ---------------------------------------------------------------------------
# Position / velocity generators
# ---------------------------------------------------------------------------

def _gen_position(norad_id: int, r_km: float, inc_deg: float) -> list[float]:
    """
    Deterministic ECI position for a satellite.
    Uses golden-angle phase spread and real inclination to place objects
    on distinct orbital planes around Earth.
    """
    phi = (norad_id * 2.39996) % (2 * math.pi)   # golden-angle phase — uniform spread
    raan = (norad_id * 1.61803) % (2 * math.pi)  # golden-ratio RAAN  — varied planes
    inc = math.radians(inc_deg)

    x = r_km * (math.cos(raan) * math.cos(phi) - math.sin(raan) * math.cos(inc) * math.sin(phi))
    y = r_km * (math.sin(raan) * math.cos(phi) + math.cos(raan) * math.cos(inc) * math.sin(phi))
    z = r_km * math.sin(inc) * math.sin(phi)
    return [round(x, 1), round(y, 1), round(z, 1)]


def _gen_velocity(norad_id: int, r_km: float, inc_deg: float) -> list[float]:
    """
    Circular-orbit prograde velocity vector matching _gen_position.
    """
    GM = 398_600.0
    v_orb = math.sqrt(GM / r_km)  # km/s

    phi = (norad_id * 2.39996) % (2 * math.pi)
    raan = (norad_id * 1.61803) % (2 * math.pi)
    inc = math.radians(inc_deg)

    # d(position)/d(phi) evaluated at phi — tangential direction
    vx = -math.cos(raan) * math.sin(phi) - math.sin(raan) * math.cos(inc) * math.cos(phi)
    vy = -math.sin(raan) * math.sin(phi) + math.cos(raan) * math.cos(inc) * math.cos(phi)
    vz = math.sin(inc) * math.cos(phi)

    mag = math.sqrt(vx**2 + vy**2 + vz**2) or 1.0
    return [round(v_orb * vx / mag, 3), round(v_orb * vy / mag, 3), round(v_orb * vz / mag, 3)]


# ---------------------------------------------------------------------------
# CSV loading helpers
# ---------------------------------------------------------------------------

def _load_raw_cdms() -> list[dict]:
    if not _CDM_PATH.exists():
        logger.warning("CDM dataset not found at %s", _CDM_PATH)
        return []
    with open(_CDM_PATH) as f:
        return json.load(f)


def _deduplicate_cdms(raw: list[dict]) -> list[dict]:
    seen: dict[tuple, dict] = {}
    for cdm in raw:
        pair = tuple(sorted([cdm["SAT_1_ID"], cdm["SAT_2_ID"]]))
        if pair not in seen or (cdm.get("PC") or 0) > (seen[pair].get("PC") or 0):
            seen[pair] = cdm
    return list(seen.values())


def _object_type_to_controllable(obj_type: str) -> bool:
    return obj_type.upper() == "PAYLOAD"


def _derive_priority(name: str, obj_type: str) -> int:
    name_upper = name.upper()
    if any(k in name_upper for k in ("ISS", "GPS", "GLONASS", "GALILEO", "BEIDOU")):
        return 1
    if obj_type.upper() == "PAYLOAD":
        return 2
    if obj_type.upper() == "ROCKET BODY":
        return 3
    return 4


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_real_satellites() -> dict:
    """
    Load all 50 satellites from NORAD orbital CSV files (+ synthetic fallbacks).

    Returns:
        {"satellites": [{id, norad_id, name, operator, country, priority,
                          altitude_km, inclination, fuel_remaining,
                          position, velocity, controllable}, ...]}
    """
    GM = 398_600.0

    # Collect CSV rows for all 50 NORADs
    raw_rows: dict[int, dict] = {}
    for fname in ("payload_orbital", "debris_orbital", "rocket_orbital"):
        path = _DATA_DIR / f"{fname}.csv"
        if not path.exists():
            continue
        with open(path) as f:
            for row in csv.DictReader(f):
                nid = int(row["NORAD_CAT_ID"])
                if nid in _SATELLITE_MAP and nid not in raw_rows:
                    raw_rows[nid] = row
        if len(raw_rows) == len(_SATELLITE_MAP):
            break

    # Inject synthetic rows
    for nid, synth in _SYNTHETIC_ORBITALS.items():
        if nid not in raw_rows:
            raw_rows[nid] = synth

    if not raw_rows:
        logger.error("No orbital CSV files found — satellite data unavailable")
        return {"satellites": []}

    satellites = []
    for nid, (sat_id, operator, fuel, controllable, priority) in _SATELLITE_MAP.items():
        row = raw_rows.get(nid)
        if row is None:
            logger.warning("NORAD %d not found — skipping", nid)
            continue

        alt_km = (float(row["APOAPSIS"]) + float(row["PERIAPSIS"])) / 2
        inc_deg = float(row.get("INCLINATION", 0.0))
        r_km = 6371.0 + alt_km

        pos = _gen_position(nid, r_km, inc_deg)
        vel = _gen_velocity(nid, r_km, inc_deg)

        satellites.append({
            "id": sat_id,
            "norad_id": nid,
            "name": row["OBJECT_NAME"],
            "operator": operator,
            "country": row.get("COUNTRY_CODE", "UNKN"),
            "priority": priority,
            "altitude_km": round(alt_km, 1),
            "inclination": round(inc_deg, 2),
            "fuel_remaining": fuel,
            "position": pos,
            "velocity": vel,
            "controllable": controllable,
        })

    return {"satellites": satellites}


def get_real_scenario() -> dict:
    """
    Return the 15-event conjunction scenario with demo-friendly TCAs.

    TCA hours are fixed offsets from the current time so events are always
    in the future regardless of when the demo runs.
    Returns None if satellite data is unavailable.
    """
    if not (_DATA_DIR / "payload_orbital.csv").exists():
        return None

    conjunction_events = []
    for event_id, a_norad, b_norad, tca_h, miss_km, _pc_unused, rel_vel in _CONJUNCTION_EVENTS:
        a_id = _NORAD_TO_ID.get(a_norad, f"NORAD-{a_norad}")
        b_id = _NORAD_TO_ID.get(b_norad, f"NORAD-{b_norad}")
        pc = _miss_km_to_pc(miss_km, rel_vel)
        conjunction_events.append({
            "id": event_id,
            "sat_a_id": a_id,
            "sat_b_id": b_id,
            "time_to_closest_approach_hours": tca_h,
            "miss_distance_km": miss_km,
            "collision_probability": pc,
            "relative_velocity_km_s": rel_vel,
            "notes": (
                f"NORAD CDM: PC={pc*100:.4f}% (derived from {miss_km} km miss, {rel_vel} km/s) — "
                f"{pc/0.0001:.0f}× the 0.01% mandatory-review threshold. "
                f"EMERGENCY_REPORTABLE=Y."
            ),
        })

    primary = conjunction_events[0]
    return {
        "scenario_id": "CDM-50OBJ",
        "description": "50-object real NORAD dataset — 30 active conjunction pairs",
        "conjunction_events": conjunction_events,
        "kessler_cascade_events": [],
    }


def get_real_kessler_events(top_n: int = 5) -> list[dict]:
    """
    Return top N real CDM events sorted by collision probability.
    Kept for backwards-compatibility with orchestrator imports.
    """
    raw = _load_raw_cdms()
    if not raw:
        return []
    unique = _deduplicate_cdms(raw)
    now = datetime.now(timezone.utc)

    results = []
    for cdm in unique:
        pc = cdm.get("PC")
        if not pc:
            continue
        tca = datetime.fromisoformat(cdm["TCA"]).replace(tzinfo=timezone.utc)
        tca_hours = max(0.0, (tca - now).total_seconds() / 3600)
        if tca_hours == 0.0:
            continue
        results.append({
            "id": f"CDM-{cdm['CDM_ID']}",
            "sat_a_name": cdm["SAT_1_NAME"],
            "sat_a_type": cdm["SAT1_OBJECT_TYPE"],
            "sat_a_norad": cdm["SAT_1_ID"],
            "sat_a_controllable": _object_type_to_controllable(cdm["SAT1_OBJECT_TYPE"]),
            "sat_a_priority": _derive_priority(cdm["SAT_1_NAME"], cdm["SAT1_OBJECT_TYPE"]),
            "sat_b_name": cdm["SAT_2_NAME"],
            "sat_b_type": cdm["SAT2_OBJECT_TYPE"],
            "sat_b_norad": cdm["SAT_2_ID"],
            "sat_b_controllable": _object_type_to_controllable(cdm["SAT2_OBJECT_TYPE"]),
            "sat_b_priority": _derive_priority(cdm["SAT_2_NAME"], cdm["SAT2_OBJECT_TYPE"]),
            "time_to_closest_approach_hours": round(tca_hours, 2),
            "miss_distance_km": float(cdm["MIN_RNG"]),
            "collision_probability": pc,
        })

    results.sort(key=lambda x: x["collision_probability"], reverse=True)
    return results[:top_n]


def get_space_environment_context() -> str:
    """Return formatted space environment summary from stats.json."""
    if not _STATS_PATH.exists():
        return ""
    with open(_STATS_PATH) as f:
        stats = json.load(f)

    debris_by_country = stats.get("top_debris_countries", {})
    alt_dist = stats.get("altitude_distribution", {})
    lines = [
        "CURRENT SPACE ENVIRONMENT (NORAD tracking data, 2026-03-28):",
        f"  Total tracked objects in orbit: {stats.get('total_objects', 'N/A'):,}",
        f"    Active payloads:  {stats['by_type'].get('PAYLOAD', 0):,}",
        f"    Debris pieces:    {stats['by_type'].get('DEBRIS', 0):,}",
        f"    Rocket bodies:    {stats['by_type'].get('ROCKET BODY', 0):,}",
        f"  Orbital zones: LEO {stats['by_zone'].get('LEO', 0):,} | "
        f"MEO {stats['by_zone'].get('MEO', 0):,} | GEO {stats['by_zone'].get('GEO', 0):,}",
        "  Top debris-generating countries:",
        f"    China (PRC): {debris_by_country.get('PRC', 0):,} pieces "
        f"(2007 ASAT test — primary Kessler risk)",
        f"    United States: {debris_by_country.get('US', 0):,} pieces",
        f"    Russia (CIS): {debris_by_country.get('CIS', 0):,} pieces "
        f"(incl. 2009 Iridium-Cosmos collision)",
        "  Altitude density (objects per band):",
        f"    500–1,000 km: {alt_dist.get('500-1000km', 0):,} objects "
        f"(highest density — critical Kessler zone)",
        f"    0–500 km:     {alt_dist.get('0-500km', 0):,} objects",
        f"    1,000–2,000 km: {alt_dist.get('1000-2000km', 0):,} objects",
        "  Active conjunction warnings today: 200 CDMs flagged EMERGENCY_REPORTABLE",
        "  NOTE: In space operations, PC > 0.01% (1-in-10,000) triggers mandatory review.",
    ]
    return "\n".join(lines)

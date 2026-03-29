# ─────────────────────────────────────────────
#  config.py  –  Space-Track credentials & paths
# ─────────────────────────────────────────────
import os
from dotenv import load_dotenv

load_dotenv()  # loads from .env file if present

CREDENTIALS = {
    "identity": os.environ.get("SPACETRACK_IDENTITY", ""),
    "password": os.environ.get("SPACETRACK_PASSWORD", ""),
}

BASE_URL = "https://www.space-track.org"

# Where raw CSV files are saved after download
RAW_DIR = "data/raw"

# Where processed JSON files ready for the globe are saved
PROCESSED_DIR = "data/processed"

# Where merged/analysis files are saved
ANALYSIS_DIR = "data/analysis"

# ── Query definitions ──────────────────────────────────────────────────────
# Each entry:  output_filename  →  API path
# All return CSV. Fields are standard OMM/SATCAT field names.
# ──────────────────────────────────────────────────────────────────────────
QUERIES = {
    # Latest orbital elements for ALL debris in orbit (non-decayed, fresh < 10 days)
    "debris_orbital.csv": (
        "/basicspacedata/query/class/gp"
        "/OBJECT_TYPE/DEBRIS"
        "/decay_date/null-val"
        "/epoch/%3Enow-10"
        "/orderby/NORAD_CAT_ID"
        "/format/csv"
    ),

    # Latest orbital elements for ALL payloads
    "payload_orbital.csv": (
        "/basicspacedata/query/class/gp"
        "/OBJECT_TYPE/PAYLOAD"
        "/decay_date/null-val"
        "/epoch/%3Enow-10"
        "/orderby/NORAD_CAT_ID"
        "/format/csv"
    ),

    # Latest orbital elements for ALL rocket bodies
    "rocket_orbital.csv": (
        "/basicspacedata/query/class/gp"
        "/OBJECT_TYPE/ROCKET%20BODY"
        "/decay_date/null-val"
        "/epoch/%3Enow-10"
        "/orderby/NORAD_CAT_ID"
        "/format/csv"
    ),

    # Full satellite catalog – metadata for every tracked object
    "satcat_all.csv": (
        "/basicspacedata/query/class/satcat"
        "/CURRENT/Y"
        "/orderby/NORAD_CAT_ID"
        "/format/csv"
    ),

    # Re-entry / decay predictions (last 500 most recent)
    "decay_predictions.csv": (
        "/basicspacedata/query/class/decay"
        "/orderby/DECAY_EPOCH%20desc"
        "/limit/500"
        "/format/csv"
    ),

    # Tracked Impact Predictions – objects re-entering within ~30 days
    "tip_messages.csv": (
        "/basicspacedata/query/class/tip"
        "/INSERT_EPOCH/%3Enow-30"
        "/orderby/INSERT_EPOCH%20desc"
        "/format/csv"
    ),

    # Public Conjunction Data Messages – close approach alerts
    "conjunctions.csv": (
        "/basicspacedata/query/class/cdm_public"
        "/orderby/TCA%20desc"
        "/limit/200"
        "/format/csv"
    ),

    # Boxscore – per-country summary counts (payloads / debris / rocket bodies)
    "boxscore.csv": (
        "/basicspacedata/query/class/boxscore"
        "/format/csv"
    ),
}

# ── Globe output columns ───────────────────────────────────────────────────
# Only these columns are written to the final JSON the globe reads.
# Keeping it minimal reduces file size significantly.
GLOBE_COLUMNS = [
    "NORAD_CAT_ID",
    "OBJECT_NAME",
    "OBJECT_TYPE",
    "COUNTRY",
    "INCLINATION",
    "RA_OF_ASC_NODE",
    "ARG_OF_PERICENTER",
    "MEAN_ANOMALY",
    "APOAPSIS",
    "PERIAPSIS",
    "RCS_SIZE",
    "EPOCH",
]

# ─────────────────────────────────────────────
#  processor.py  –  Clean, merge, export JSON
# ─────────────────────────────────────────────

import os
import json
import pandas as pd
from config import RAW_DIR, DATA_DIR, PROCESSED_DIR, ANALYSIS_DIR, GLOBE_COLUMNS


# ── Helpers ────────────────────────────────────────────────────────────────

def _read_csv(filename: str, directory: str = RAW_DIR) -> pd.DataFrame | None:
    path = os.path.join(directory, filename)
    if not os.path.exists(path):
        fallback = os.path.join(DATA_DIR, filename)
        if os.path.exists(fallback):
            path = fallback
        else:
            print(f"  [WARN] File not found: {path} (or {fallback})")
            return None
    try:
        df = pd.read_csv(path, low_memory=False)
        print(f"  [OK] Loaded {filename}  ({len(df):,} rows, {len(df.columns)} cols)")
        return df
    except Exception as e:
        print(f"  [ERROR] Could not read {filename}: {e}")
        return None


def _to_numeric(df: pd.DataFrame, cols: list) -> pd.DataFrame:
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def _save_csv(df: pd.DataFrame, filename: str, directory: str):
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, filename)
    df.to_csv(path, index=False)
    print(f"  [SAVED] {path}  ({len(df):,} rows)")


def _save_json(df: pd.DataFrame, filename: str, directory: str):
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, filename)
    df.to_json(path, orient="records", indent=2, force_ascii=False)
    size_kb = os.path.getsize(path) // 1024
    print(f"  [SAVED] {path}  ({len(df):,} records, {size_kb:,} KB)")


# ── Step 1 – Load & clean orbital data ────────────────────────────────────

def load_orbital() -> pd.DataFrame:
    """Read debris + payload + rocket CSVs, union them, clean types."""
    print("\n--- Loading orbital data ---")
    frames = []
    for fname in ("debris_orbital.csv", "payload_orbital.csv", "rocket_orbital.csv"):
        df = _read_csv(fname)
        if df is not None:
            frames.append(df)

    if not frames:
        raise FileNotFoundError("No orbital CSV files found in data/raw/. Run downloader.py first.")

    orbital = pd.concat(frames, ignore_index=True)

    # Numeric columns used for globe positioning
    num_cols = ["INCLINATION", "RA_OF_ASC_NODE", "ARG_OF_PERICENTER",
                "MEAN_ANOMALY", "MEAN_MOTION", "ECCENTRICITY",
                "APOAPSIS", "PERIAPSIS", "NORAD_CAT_ID"]
    orbital = _to_numeric(orbital, num_cols)

    # Drop rows with missing positional data
    required = ["INCLINATION", "RA_OF_ASC_NODE", "MEAN_ANOMALY", "APOAPSIS"]
    before = len(orbital)
    orbital = orbital.dropna(subset=required)
    print(f"  Dropped {before - len(orbital):,} rows with missing orbital elements")

    # Normalise OBJECT_TYPE to uppercase
    if "OBJECT_TYPE" in orbital.columns:
        orbital["OBJECT_TYPE"] = orbital["OBJECT_TYPE"].str.upper().str.strip()

    print(f"  Total orbital objects : {len(orbital):,}")
    return orbital


# ── Step 2 – Load & clean SATCAT metadata ─────────────────────────────────

def load_satcat() -> pd.DataFrame:
    print("\n--- Loading SATCAT ---")
    df = _read_csv("satcat_all.csv")
    if df is None:
        return pd.DataFrame()

    df = _to_numeric(df, ["NORAD_CAT_ID", "PERIOD", "APOGEE", "PERIGEE"])

    # Keep only currently-orbiting objects
    if "CURRENT" in df.columns:
        df = df[df["CURRENT"] == "Y"]

    print(f"  Current objects in catalog : {len(df):,}")
    return df


# ── Step 3 – Merge orbital + satcat ───────────────────────────────────────

def merge_datasets(orbital: pd.DataFrame, satcat: pd.DataFrame) -> pd.DataFrame:
    print("\n--- Merging datasets ---")

    if satcat.empty:
        print("  [WARN] SATCAT empty – using orbital data only")
        merged = orbital.copy()
    else:
        satcat_cols = ["NORAD_CAT_ID", "COUNTRY", "RCS_SIZE", "LAUNCH",
                       "SITE", "PERIOD"]
        satcat_cols = [c for c in satcat_cols if c in satcat.columns]
        merged = orbital.merge(satcat[satcat_cols], on="NORAD_CAT_ID", how="left")

    # Fill missing country
    if "COUNTRY" in merged.columns:
        merged["COUNTRY"] = merged["COUNTRY"].fillna("UNKNOWN")

    print(f"  Merged dataset size : {len(merged):,} objects")
    return merged


# ── Step 4 – Classify orbital zones ───────────────────────────────────────

def add_orbit_zone(df: pd.DataFrame) -> pd.DataFrame:
    def zone(alt):
        if pd.isna(alt):
            return "UNKNOWN"
        if alt < 2000:
            return "LEO"
        if alt < 35786:
            return "MEO"
        return "GEO"

    df["ORBIT_ZONE"] = df["APOAPSIS"].apply(zone)
    return df


# ── Step 5 – Export processed CSV ─────────────────────────────────────────

def export_processed(df: pd.DataFrame):
    print("\n--- Exporting processed CSV ---")
    _save_csv(df, "all_objects_merged.csv", PROCESSED_DIR)


# ── Step 6 – Export globe-ready JSON files ────────────────────────────────

def export_globe_json(df: pd.DataFrame):
    print("\n--- Exporting globe JSON files ---")

    available_cols = [c for c in GLOBE_COLUMNS if c in df.columns]

    # All objects
    globe_df = df[available_cols].copy()
    _save_json(globe_df, "globe_all.json", PROCESSED_DIR)

    # Debris only
    if "OBJECT_TYPE" in df.columns:
        debris = df[df["OBJECT_TYPE"] == "DEBRIS"][available_cols]
        _save_json(debris, "globe_debris.json", PROCESSED_DIR)

        # LEO debris only (most dense, most dangerous)
        leo = df[(df["OBJECT_TYPE"] == "DEBRIS") & (df["APOAPSIS"] < 2000)][available_cols]
        _save_json(leo, "globe_debris_leo.json", PROCESSED_DIR)


# ── Step 7 – Produce summary statistics ───────────────────────────────────

def export_stats(df: pd.DataFrame):
    print("\n--- Generating statistics ---")
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    stats = {}

    # Overall counts
    stats["total_objects"] = int(len(df))
    if "OBJECT_TYPE" in df.columns:
        type_counts = df["OBJECT_TYPE"].value_counts().to_dict()
        stats["by_type"] = {str(k): int(v) for k, v in type_counts.items()}

    # By orbit zone
    if "ORBIT_ZONE" in df.columns:
        zone_counts = df["ORBIT_ZONE"].value_counts().to_dict()
        stats["by_zone"] = {str(k): int(v) for k, v in zone_counts.items()}

    # Top 10 countries by debris count
    if "COUNTRY" in df.columns and "OBJECT_TYPE" in df.columns:
        top_countries = (
            df[df["OBJECT_TYPE"] == "DEBRIS"]["COUNTRY"]
            .value_counts()
            .head(10)
            .to_dict()
        )
        stats["top_debris_countries"] = {str(k): int(v) for k, v in top_countries.items()}

    # Altitude distribution buckets
    if "APOAPSIS" in df.columns:
        buckets = {
            "0-500km": int(((df["APOAPSIS"] >= 0) & (df["APOAPSIS"] < 500)).sum()),
            "500-1000km": int(((df["APOAPSIS"] >= 500) & (df["APOAPSIS"] < 1000)).sum()),
            "1000-2000km": int(((df["APOAPSIS"] >= 1000) & (df["APOAPSIS"] < 2000)).sum()),
            "2000-20000km": int(((df["APOAPSIS"] >= 2000) & (df["APOAPSIS"] < 20000)).sum()),
            "20000km+": int((df["APOAPSIS"] >= 20000).sum()),
        }
        stats["altitude_distribution"] = buckets

    path = os.path.join(ANALYSIS_DIR, "stats.json")
    with open(path, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"  [SAVED] {path}")

    # Pretty print summary
    print("\n  ── Summary ──────────────────────────────")
    print(f"  Total objects       : {stats['total_objects']:,}")
    if "by_type" in stats:
        for k, v in stats["by_type"].items():
            print(f"  {k:<20} : {v:,}")
    if "by_zone" in stats:
        print()
        for k, v in stats["by_zone"].items():
            print(f"  {k:<20} : {v:,}")
    print("  ─────────────────────────────────────────")

    return stats


# ── Step 8 – Process CDM / decay supplementary data ───────────────────────

def export_supplementary():
    print("\n--- Processing supplementary data ---")

    # Decay predictions
    decay = _read_csv("decay_predictions.csv")
    if decay is not None and not decay.empty:
        decay = _to_numeric(decay, ["NORAD_CAT_ID"])
        _save_json(decay, "decay_predictions.json", PROCESSED_DIR)

    # Conjunction alerts
    cdm = _read_csv("conjunctions.csv")
    if cdm is not None and not cdm.empty:
        _save_json(cdm, "conjunctions.json", PROCESSED_DIR)

    # Boxscore
    box = _read_csv("boxscore.csv")
    if box is not None and not box.empty:
        _save_json(box, "boxscore.json", PROCESSED_DIR)

    # TIP messages
    tip = _read_csv("tip_messages.csv")
    if tip is not None and not tip.empty:
        _save_json(tip, "tip_messages.json", PROCESSED_DIR)


# ── Main processing pipeline ───────────────────────────────────────────────

def run():
    print("\n============================")
    print("  Space-Track Processor")
    print("============================")

    orbital  = load_orbital()
    satcat   = load_satcat()
    merged   = merge_datasets(orbital, satcat)
    merged   = add_orbit_zone(merged)

    export_processed(merged)
    export_globe_json(merged)
    export_stats(merged)
    export_supplementary()

    print("\n[DONE] All files ready in data/processed/ and data/analysis/")


if __name__ == "__main__":
    run()

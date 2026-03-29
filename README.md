# Sentinel — Space Debris Tracker

A data pipeline that downloads live orbital tracking data from [Space-Track.org](https://www.space-track.org), cleans it, and exports JSON files ready for a 3D globe visualization.

---

## How It Works

```
Space-Track.org API
        │
        ▼
  downloader.py  ──►  data/raw/*.csv         (8 raw CSV files)
        │
        ▼
  processor.py   ──►  data/processed/*.json   (globe-ready JSON)
                 ──►  data/analysis/stats.json
```

1. **`downloader.py`** — Logs into Space-Track.org, fires 8 API queries, and saves each result as a CSV file under `data/raw/`.
2. **`processor.py`** — Reads the raw CSVs, merges orbital elements with satellite catalog metadata, classifies each object by orbit zone (LEO/MEO/GEO), and exports cleaned JSON files for the frontend globe.
3. **`etl_pipeline.py`** — Orchestrates the full pipeline with CLI flags.

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure credentials

Edit `.env` in the project root with your [Space-Track.org](https://www.space-track.org/auth/createAccount) account:

```env
SPACETRACK_IDENTITY=your_email@gmail.com
SPACETRACK_PASSWORD=your_password
```

> `.env` is excluded from git via `.gitignore` — your credentials will never be committed.

---

## How to Run

| Command | What it does |
|---|---|
| `python etl_pipeline.py` | Full pipeline: download + process |
| `python etl_pipeline.py --download` | Download raw CSVs only |
| `python etl_pipeline.py --process` | Process existing raw CSVs (no network call) |
| `python etl_pipeline.py --verify` | Show row counts of all downloaded files |
| `python scheduler.py --run-now` | Start recurring scheduler and run all groups immediately |

### Typical first run

```bash
python etl_pipeline.py
```

This will:
1. Authenticate with Space-Track.org
2. Download 8 CSV datasets into `data/raw/`
3. Merge and clean the data
4. Export JSON files into `data/processed/`
5. Write summary statistics to `data/analysis/stats.json`

### Run recurring updates (safe "real-time" polling)

```bash
python scheduler.py --run-now
```

The scheduler applies rate-limit-safe polling groups:

- Hourly: orbital + decay + TIP (`debris_orbital.csv`, `payload_orbital.csv`, `rocket_orbital.csv`, `decay_predictions.csv`, `tip_messages.csv`)
- Every 8 hours: conjunctions (`conjunctions.csv`)
- Daily: catalog + boxscore (`satcat_all.csv`, `boxscore.csv`)

Useful flags:

- `--once`: run one scheduling check then exit
- `--poll-seconds 60`: check due jobs every 60 seconds (default)

---

## Project Structure

```
sentinel/
├── etl_pipeline.py      # Pipeline entry point
├── downloader.py        # Authenticates and fetches data from Space-Track
├── processor.py         # Cleans, merges, and exports data
├── config.py            # Paths and API queries (credentials loaded from .env)
├── visualize.py         # Globe visualization helper
├── visualize.html       # 3D globe frontend
├── requirements.txt     # Python dependencies
├── .env                 # Your credentials (never committed)
├── data/
│   ├── raw/             # Downloaded CSVs + manifest.json
│   ├── processed/       # Cleaned JSON files for the globe
│   └── analysis/        # stats.json summary
```

---

## Output Files

| File | Location | Description |
|---|---|---|
| `globe_all.json` | `data/processed/` | All tracked objects (debris + payloads + rockets) |
| `globe_debris.json` | `data/processed/` | Debris objects only |
| `globe_debris_leo.json` | `data/processed/` | LEO debris only (altitude < 2,000 km) |
| `all_objects_merged.csv` | `data/processed/` | Full merged dataset as CSV |
| `decay_predictions.json` | `data/processed/` | Objects predicted to re-enter atmosphere |
| `conjunctions.json` | `data/processed/` | Close-approach (collision risk) alerts |
| `boxscore.json` | `data/processed/` | Per-country object count summary |
| `tip_messages.json` | `data/processed/` | Tracked Impact Prediction messages |
| `stats.json` | `data/analysis/` | Aggregate statistics (counts by type, zone, country) |

---

## Raw Data Column Reference

### `debris_orbital.csv` / `payload_orbital.csv` / `rocket_orbital.csv`

Orbital elements for every tracked object. These three files share the same schema and are merged into one dataset during processing.

| Column | Type | Description |
|---|---|---|
| `NORAD_CAT_ID` | integer | Unique NORAD catalog number assigned to each object |
| `OBJECT_NAME` | string | Official name or designation (e.g. `STARLINK-1234`, `DEB`) |
| `OBJECT_ID` | string | International designator (e.g. `1999-025F`) |
| `OBJECT_TYPE` | string | Category: `DEBRIS`, `PAYLOAD`, or `ROCKET BODY` |
| `EPOCH` | datetime | Timestamp when these orbital elements were measured |
| `MEAN_MOTION` | float | Revolutions per day around Earth |
| `ECCENTRICITY` | float | Shape of the orbit (0 = circular, near 1 = highly elliptical) |
| `INCLINATION` | float (deg) | Tilt of the orbital plane relative to the equator |
| `RA_OF_ASC_NODE` | float (deg) | Right Ascension of Ascending Node — rotational orientation of the orbit |
| `ARG_OF_PERICENTER` | float (deg) | Angle from ascending node to the orbit's closest point to Earth |
| `MEAN_ANOMALY` | float (deg) | Position of the object within its orbit at the epoch time |
| `APOAPSIS` | float (km) | Highest point of the orbit (farthest from Earth) |
| `PERIAPSIS` | float (km) | Lowest point of the orbit (closest to Earth) |
| `PERIOD` | float (min) | Time to complete one full orbit |
| `REV_AT_EPOCH` | integer | Total revolutions completed at the epoch |
| `BSTAR` | float | Atmospheric drag coefficient used for orbit decay prediction |
| `MEAN_MOTION_DOT` | float | First derivative of mean motion (rate of orbital decay) |
| `MEAN_MOTION_DDOT` | float | Second derivative of mean motion |
| `CLASSIFICATION_TYPE` | string | `U` = Unclassified |
| `TLE_LINE0` | string | TLE name line |
| `TLE_LINE1` | string | TLE line 1 (orbital parameters) |
| `TLE_LINE2` | string | TLE line 2 (orbital parameters continued) |

---

### `satcat_all.csv`

The full Satellite Catalog — metadata for every object ever tracked by the US Space Surveillance Network.

| Column | Type | Description |
|---|---|---|
| `NORAD_CAT_ID` | integer | Unique NORAD catalog number |
| `OBJECT_NAME` | string | Official name |
| `INTLDES` | string | International designator |
| `OBJECT_TYPE` | string | `PAY` (payload), `R/B` (rocket body), `DEB` (debris), `UNK` (unknown) |
| `COUNTRY` | string | 3-letter country/org code of the launching entity (e.g. `US`, `CHN`, `RUS`) |
| `LAUNCH` | date | Launch date |
| `SITE` | string | Launch site code |
| `DECAY` | date | Re-entry date (empty if still in orbit) |
| `PERIOD` | float (min) | Orbital period |
| `INCLINATION` | float (deg) | Orbital inclination |
| `APOGEE` | float (km) | Apogee altitude |
| `PERIGEE` | float (km) | Perigee altitude |
| `RCS_SIZE` | string | Radar Cross Section size class: `SMALL`, `MEDIUM`, or `LARGE` |
| `RCSVALUE` | float (m²) | Numeric radar cross section in square meters |
| `RCS_DATE` | date | Date the RCS measurement was taken |
| `CURRENT` | string | `Y` if currently in orbit, `N` if decayed |
| `LAUNCH_YEAR` | integer | Year of launch |
| `LAUNCH_NUM` | integer | Launch number within that year |
| `LAUNCH_PIECE` | string | Piece identifier within the launch (`A` = primary payload) |

---

### `decay_predictions.csv`

Objects predicted to re-enter Earth's atmosphere in the near future.

| Column | Type | Description |
|---|---|---|
| `NORAD_CAT_ID` | integer | NORAD catalog number |
| `OBJECT_NAME` | string | Object name |
| `INTLDES` | string | International designator |
| `RCS` | float (m²) | Radar cross section |
| `RCS_SIZE` | string | Size class: `SMALL`, `MEDIUM`, or `LARGE` |
| `COUNTRY` | string | Country of origin |
| `MSG_EPOCH` | datetime | When this prediction message was issued |
| `DECAY_EPOCH` | datetime | Predicted re-entry date/time |
| `SOURCE` | string | Agency or source that issued the prediction |
| `MSG_TYPE` | string | Message type identifier |
| `PRECEDENCE` | integer | Priority/confidence ranking of this prediction |

---

### `conjunctions.csv`

Conjunction Data Messages (CDMs) — close approach events where two tracked objects risk collision.

| Column | Type | Description |
|---|---|---|
| `CDM_ID` | integer | Unique ID for this conjunction event |
| `CREATED` | datetime | When this CDM was created |
| `TCA` | datetime | Time of Closest Approach |
| `MIN_RNG` | float (km) | Minimum range (closest distance) between the two objects |
| `PC` | float | Probability of collision (0 to 1) |
| `EMERGENCY_REPORTABLE` | string | Whether this triggers an emergency report |
| `SAT_1_ID` | integer | NORAD ID of the first object |
| `SAT_1_NAME` | string | Name of the first object |
| `SAT1_OBJECT_TYPE` | string | Type of the first object |
| `SAT1_RCS` | string | RCS size of the first object |
| `SAT_2_ID` | integer | NORAD ID of the second object |
| `SAT_2_NAME` | string | Name of the second object |
| `SAT2_OBJECT_TYPE` | string | Type of the second object |
| `SAT2_RCS` | string | RCS size of the second object |

---

### `boxscore.csv`

A country-level summary of all objects tracked in orbit.

| Column | Type | Description |
|---|---|---|
| `COUNTRY` | string | Country or organization name |
| `SPADOC_CD` | string | Space Defense Operations Center country code |
| `ORBITAL_PAYLOAD_COUNT` | integer | Active payloads currently in orbit |
| `ORBITAL_ROCKET_BODY_COUNT` | integer | Rocket bodies currently in orbit |
| `ORBITAL_DEBRIS_COUNT` | integer | Debris objects currently in orbit |
| `ORBITAL_TOTAL_COUNT` | integer | Total objects currently in orbit |
| `DECAYED_PAYLOAD_COUNT` | integer | Total decayed (re-entered) payloads |
| `DECAYED_ROCKET_BODY_COUNT` | integer | Total decayed rocket bodies |
| `DECAYED_DEBRIS_COUNT` | integer | Total decayed debris |
| `DECAYED_TOTAL_COUNT` | integer | Total decayed objects |
| `COUNTRY_TOTAL` | integer | Grand total (orbital + decayed) for this country |

---

### `tip_messages.csv`

Tracked Impact Predictions — official messages for objects expected to re-enter within ~30 days.

| Column | Type | Description |
|---|---|---|
| `NORAD_CAT_ID` | integer | NORAD catalog number |
| `MSG_EPOCH` | datetime | When the TIP message was issued |
| `INSERT_EPOCH` | datetime | When this record was inserted into the database |
| `DECAY_EPOCH` | datetime | Predicted re-entry time |
| `WINDOW` | integer (min) | Uncertainty window (±minutes) around the predicted re-entry |
| `REV` | integer | Revolution number at time of re-entry |
| `LAT` | float (deg) | Predicted latitude of re-entry |
| `LON` | float (deg) | Predicted longitude of re-entry |
| `INCL` | float (deg) | Orbital inclination |
| `NEXT_REPORT` | datetime | Time of next expected update to this TIP |
| `HIGH_INTEREST` | string | `Y` if this object is flagged as high interest |
| `OBJECT_NAME` | string | Object name |

---

## Orbit Zone Classification

The processor automatically assigns each object an `ORBIT_ZONE` based on its apoapsis altitude:

| Zone | Altitude | Full Name |
|---|---|---|
| `LEO` | 0 – 2,000 km | Low Earth Orbit — most crowded, highest collision risk |
| `MEO` | 2,000 – 35,786 km | Medium Earth Orbit — GPS satellites live here |
| `GEO` | > 35,786 km | Geostationary Orbit — communications satellites |

---

## Rate Limits (Space-Track API)

Do not re-run the downloader more than the limits below or your account may be suspended.

| Dataset | Max Frequency |
|---|---|
| GP / TLEs (orbital elements) | Once per hour |
| SATCAT | Once per day |
| CDM / Conjunctions | Once every 8 hours |
| Boxscore | Once per day |

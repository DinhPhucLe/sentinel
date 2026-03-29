# Sentinel - Space Debris Tracker

A data pipeline that downloads orbital tracking data from Space-Track.org, processes it, and exports files for simulation and visualization.

## What Was Updated

### File-by-file changes

| File | What I changed | Why it matters |
|---|---|---|
| `config.py` | Added `DATA_DIR = "data"` | Gives one shared base path for fallback file detection |
| `downloader.py` | Added `get_existing_query_files()` and `existing_only` mode in `download_all()` | Lets crawler fetch only datasets that already exist in your project data layout |
| `etl_pipeline.py` | Download step now defaults to existing-file mode; added `--all-files` override | Prevents pulling extra datasets you are not using, but still allows full fetch when needed |
| `processor.py` | `_read_csv()` now falls back from `data/raw` to `data/` | ETL works with your current file placement in `data/` root |
| `scheduler.py` | Scheduler filters each group to existing files only and skips empty groups | Hourly/8h/daily jobs stay aligned with datasets currently in repo |

### Feature meanings

| Feature | Meaning | Behavior |
|---|---|---|
| Existing-only crawling | Crawl only files already present in your `data` workspace | Avoids creating unrelated raw datasets |
| `data/raw -> data/` fallback | ETL reads from `data/raw` first, then `data/` | Supports mixed or legacy folder layouts |
| Safe scheduler filtering | Scheduled jobs run only for files that exist | No failing/empty jobs for missing datasets |
| `--all-files` flag | Explicit full crawl mode | Downloads every query in `config.py` when requested |

## How It Works

```
Space-Track.org API
        |
        v
  downloader.py  -->  data/raw/*.csv
        |
        v
  processor.py   -->  data/processed/*.json
                 -->  data/analysis/stats.json
```

## Commands

| Command | What it does |
|---|---|
| `python etl_pipeline.py` | Download + process (existing-file mode by default) |
| `python etl_pipeline.py --download` | Download only (existing-file mode) |
| `python etl_pipeline.py --download --all-files` | Download all configured query files |
| `python etl_pipeline.py --process` | Process local files only |
| `python etl_pipeline.py --verify` | Show raw/processed file stats |
| `python scheduler.py --run-now` | Start recurring scheduler and run immediately |
| `python scheduler.py --once` | Run one scheduler cycle and exit |

## Scheduler Intervals

| Group | Interval | Files |
|---|---|---|
| `orbital_hourly` | 1 hour | `debris_orbital.csv`, `payload_orbital.csv`, `rocket_orbital.csv`, `decay_predictions.csv`, `tip_messages.csv` |
| `conjunctions_8h` | 8 hours | `conjunctions.csv` |
| `catalog_daily` | 24 hours | `satcat_all.csv`, `boxscore.csv` |

Note: each group is auto-filtered to only files currently present in `data/raw` or `data/`.

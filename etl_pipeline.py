# ─────────────────────────────────────────────
#  etl_pipeline.py  –  Run the full ETL pipeline
#
#  Usage:
#    python etl_pipeline.py            # download + process
#    python etl_pipeline.py --download # download only
#    python etl_pipeline.py --process  # process only (uses existing raw CSVs)
#    python etl_pipeline.py --verify   # verify raw files exist and show row counts
#    python etl_pipeline.py --all-files # download all configured query files
# ─────────────────────────────────────────────

import sys
import os
import json
from datetime import datetime


def print_banner():
    print("""
╔══════════════════════════════════════════════╗
║   Space-Track.org  Data Pipeline             ║
║   Debris Tracking Project                    ║
╚══════════════════════════════════════════════╝
""")


def verify():
    """Print a summary of what raw files exist and their sizes."""
    from config import RAW_DIR, PROCESSED_DIR

    print("\n── Raw files ─────────────────────────────────")
    raw_path = os.path.abspath(RAW_DIR)
    if not os.path.isdir(raw_path):
        print(f"  {RAW_DIR}/ does not exist yet. Run --download first.")
    else:
        for fname in sorted(os.listdir(raw_path)):
            fpath = os.path.join(raw_path, fname)
            size  = os.path.getsize(fpath)
            if fname.endswith(".csv"):
                with open(fpath, encoding="utf-8") as f:
                    lines = sum(1 for _ in f)
                print(f"  {fname:<35}  {lines-1:>7,} rows   {size//1024:>5} KB")
            elif fname == "manifest.json":
                with open(fpath) as f:
                    m = json.load(f)
                print(f"\n  Last download: {m.get('downloaded_at_utc','?')}")

    print("\n── Processed files ────────────────────────────")
    proc_path = os.path.abspath(PROCESSED_DIR)
    if not os.path.isdir(proc_path):
        print(f"  {PROCESSED_DIR}/ does not exist yet. Run --process first.")
    else:
        for fname in sorted(os.listdir(proc_path)):
            fpath = os.path.join(proc_path, fname)
            size  = os.path.getsize(fpath)
            print(f"  {fname:<35}  {size//1024:>6} KB")
    print()


def run_download(existing_only: bool = True):
    from downloader import download_all
    summary = download_all(existing_only=existing_only)
    if not summary:
        print("\n[ABORT] Download failed or no matching existing files found.")
        sys.exit(1)

    errors = [k for k,v in summary.items() if isinstance(v, str) and "ERROR" in v]
    if errors:
        print(f"\n[WARN] {len(errors)} file(s) had errors: {errors}")
    else:
        print("\n[OK] All files downloaded successfully")


def run_process():
    from processor import run
    run()


def main():
    print_banner()
    args = sys.argv[1:]

    existing_only = "--all-files" not in args

    if "--verify" in args:
        verify()
        return

    if "--download" in args and "--process" not in args:
        run_download(existing_only=existing_only)
        return

    if "--process" in args and "--download" not in args:
        run_process()
        return

    # Default: full pipeline
    print(f"Started at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n")
    run_download(existing_only=existing_only)
    run_process()
    verify()
    print(f"\nFinished at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")


if __name__ == "__main__":
    main()

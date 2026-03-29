import argparse
import json
import os
import time
from datetime import datetime, timezone

from config import RAW_DIR
from downloader import download_all, get_existing_query_files
from processor import run as run_processor


SCHEDULE_GROUPS = {
    "orbital_hourly": {
        "interval_seconds": 60 * 60,
        "files": [
            "debris_orbital.csv",
            "payload_orbital.csv",
            "rocket_orbital.csv",
            "decay_predictions.csv",
            "tip_messages.csv",
        ],
    },
    "conjunctions_8h": {
        "interval_seconds": 8 * 60 * 60,
        "files": ["conjunctions.csv"],
    },
    "catalog_daily": {
        "interval_seconds": 24 * 60 * 60,
        "files": ["satcat_all.csv", "boxscore.csv"],
    },
}

STATE_PATH = os.path.join(RAW_DIR, "schedule_state.json")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def parse_utc(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def load_state() -> dict:
    if not os.path.exists(STATE_PATH):
        return {"groups": {}}
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "groups" not in data or not isinstance(data["groups"], dict):
            data["groups"] = {}
        return data
    except Exception:
        return {"groups": {}}


def save_state(state: dict):
    os.makedirs(RAW_DIR, exist_ok=True)
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def is_due(group_name: str, state: dict, now: datetime, run_now: bool) -> bool:
    if run_now:
        return True

    group_state = state.get("groups", {}).get(group_name, {})
    last_success = group_state.get("last_success_utc")
    if not last_success:
        return True

    last_dt = parse_utc(last_success)
    if not last_dt:
        return True

    elapsed = (now - last_dt).total_seconds()
    return elapsed >= SCHEDULE_GROUPS[group_name]["interval_seconds"]


def next_run_str(group_name: str, state: dict) -> str:
    group_state = state.get("groups", {}).get(group_name, {})
    last_success = group_state.get("last_success_utc")
    if not last_success:
        return "now (never run)"
    last_dt = parse_utc(last_success)
    if not last_dt:
        return "now (unknown)"
    interval = SCHEDULE_GROUPS[group_name]["interval_seconds"]
    next_dt = last_dt.timestamp() + interval
    remaining = next_dt - utc_now().timestamp()
    if remaining <= 0:
        return "now (overdue)"
    h, rem = divmod(int(remaining), 3600)
    m = rem // 60
    return f"in {h}h {m:02d}m"


def run_due_groups(state: dict, run_now: bool, dry_run: bool = False) -> bool:
    now = utc_now()
    ran_any = False
    groups = state.setdefault("groups", {})
    existing_files = set(get_existing_query_files())

    for group_name, cfg in SCHEDULE_GROUPS.items():
        if not is_due(group_name, state, now, run_now):
            print(f"  [{group_name}] next run: {next_run_str(group_name, state)}")
            continue

        files = [f for f in cfg["files"] if f in existing_files]
        if not files:
            print(f"\n[{iso_utc(utc_now())}] Skipping group: {group_name} (no matching existing files)")
            continue

        if dry_run:
            print(f"\n[DRY-RUN] Would run group: {group_name}")
            print(f"  Files: {', '.join(files)}")
            continue

        print(f"\n[{iso_utc(utc_now())}] Running group: {group_name}")
        print(f"  Files: {', '.join(files)}")
        summary = download_all(selected_files=files, existing_only=True)

        ran_any = True
        groups.setdefault(group_name, {})
        groups[group_name]["last_attempt_utc"] = iso_utc(utc_now())
        groups[group_name]["last_summary"] = summary
        if summary:
            groups[group_name]["last_success_utc"] = iso_utc(utc_now())
            print(f"  Done — {len(summary)} file(s) updated")

    return ran_any


def main():
    parser = argparse.ArgumentParser(description="Run a safe recurring Space-Track fetch schedule.")
    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=60,
        help="How often to wake up and check which groups are due (default: 60).",
    )
    parser.add_argument(
        "--run-now",
        action="store_true",
        help="Run all groups immediately on startup.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Check and run due groups one time, then exit.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which groups would run without downloading anything.",
    )
    args = parser.parse_args()

    print("Space-Track scheduler started")
    print(f"State file: {STATE_PATH}")
    for group_name, cfg in SCHEDULE_GROUPS.items():
        hours = cfg["interval_seconds"] / 3600
        print(f" - {group_name}: every {hours:g}h")

    if args.dry_run:
        print("[DRY-RUN mode — no downloads will occur]")

    try:
        while True:
            state = load_state()
            ran_any = run_due_groups(state, run_now=args.run_now, dry_run=args.dry_run)

            if ran_any and not args.dry_run:
                print(f"\n[{iso_utc(utc_now())}] Running processor.py")
                run_processor()
                print(f"[{iso_utc(utc_now())}] Processing complete")

            save_state(state)

            if args.once:
                break

            args.run_now = False
            time.sleep(max(5, args.poll_seconds))
    except KeyboardInterrupt:
        print("\nScheduler stopped by user.")


if __name__ == "__main__":
    main()

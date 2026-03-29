# ─────────────────────────────────────────────
#  downloader.py  –  Authenticate & fetch CSVs
# ─────────────────────────────────────────────

import os
import time
import requests
from datetime import datetime
from config import CREDENTIALS, BASE_URL, QUERIES, RAW_DIR


def _login(session: requests.Session) -> bool:
    """Authenticate with Space-Track. Returns True on success."""
    url = f"{BASE_URL}/ajaxauth/login"
    resp = session.post(url, data=CREDENTIALS, timeout=30)
    if resp.status_code != 200:
        print(f"  [ERROR] Login HTTP {resp.status_code}")
        return False
    # Space-Track returns 200 even on bad credentials but body contains 'Login'
    if "Login" in resp.text and "logout" not in resp.text.lower():
        print("  [ERROR] Login failed – check your credentials in config.py")
        return False
    print("  [OK] Authenticated with Space-Track")
    return True


def _logout(session: requests.Session):
    try:
        session.get(f"{BASE_URL}/ajaxauth/logout", timeout=10)
        print("  [OK] Logged out")
    except Exception:
        pass


def download_all(output_dir: str = RAW_DIR, selected_files: list[str] | None = None) -> dict:
    """
    Download every query defined in config.QUERIES as CSV.
    Saves files to output_dir.
    Returns a summary dict  {filename: record_count | 'ERROR'}.
    """
    os.makedirs(output_dir, exist_ok=True)
    session = requests.Session()
    summary = {}

    print("\n=== Space-Track Downloader ===")
    print(f"Target directory : {os.path.abspath(output_dir)}\n")

    if not _login(session):
        return {}

    query_items = QUERIES.items()
    if selected_files:
        wanted = set(selected_files)
        query_items = [(name, path) for name, path in QUERIES.items() if name in wanted]

    for filename, query_path in query_items:
        url = BASE_URL + query_path
        filepath = os.path.join(output_dir, filename)
        print(f"Fetching  {filename} ...", end=" ", flush=True)

        try:
            resp = session.get(url, timeout=120)
            resp.raise_for_status()

            # Space-Track sometimes returns an error page instead of data
            if resp.text.strip().startswith("<!"):
                print("SKIP (HTML response – possibly empty result)")
                summary[filename] = "EMPTY"
                continue

            with open(filepath, "w", encoding="utf-8", newline="") as f:
                f.write(resp.text)

            # Count data rows (total lines minus header)
            lines = [l for l in resp.text.strip().splitlines() if l.strip()]
            n_records = max(0, len(lines) - 1)
            summary[filename] = n_records
            print(f"OK  ({n_records:,} records)")

        except requests.exceptions.Timeout:
            print("ERROR (timeout)")
            summary[filename] = "TIMEOUT"
        except requests.exceptions.HTTPError as e:
            print(f"ERROR (HTTP {e.response.status_code})")
            summary[filename] = f"HTTP_{e.response.status_code}"
        except Exception as e:
            print(f"ERROR ({e})")
            summary[filename] = "ERROR"

        # Respect rate limits – small pause between requests
        time.sleep(1.5)

    _logout(session)

    # Write manifest
    manifest = {
        "downloaded_at_utc": datetime.utcnow().isoformat() + "Z",
        "files": summary,
    }
    import json
    with open(os.path.join(output_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest saved → {os.path.join(output_dir, 'manifest.json')}")
    return summary


if __name__ == "__main__":
    download_all()

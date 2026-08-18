#!/usr/bin/env python3
"""
Force sync eBay listings for a user — bypasses broken UI.

Requirements:
  - DATABASE_URL set (or .env in repo root).
  - Backend deps installed: pip install -r backend/requirements.txt
  - Run from repo root (or set PYTHONPATH so backend package resolves).

Usage (from repo root, with venv active):
  python scripts/force_sync.py
"""
import asyncio
import os
import sys

# Repo root on path so "backend" package resolves
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

# Load .env if present (backend uses DATABASE_URL)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_REPO_ROOT, ".env"))
except ImportError:
    pass

# Master's User ID
USER_ID = "ee0da9dd-566e-4a97-95f2-baf3733221ad"


class _FakeRequest:
    """Minimal Request for get_active_listings_trading_api_internal (only headers.get is used)."""
    def __init__(self):
        self.headers = type("Headers", (), {"get": lambda self, k, default=None: default or "force_sync_script"})()


async def run_manual_sync():
    from backend.ebay_webhook import get_active_listings_trading_api_internal

    print(">>> STARTING MANUAL SYNC...")
    print(f"    USER_ID = {USER_ID}")
    request = _FakeRequest()
    try:
        result = await get_active_listings_trading_api_internal(
            request=request,
            user_id=USER_ID,
            page=1,
            entries_per_page=200,
        )
        if result and result.get("success"):
            total = result.get("total", 0)
            upserted = result.get("upserted", 0)
            listings = result.get("listings", [])
            print(f">>> MANUAL SYNC COMPLETE. total={total}, upserted={upserted}, listings returned={len(listings)}")
        else:
            print(">>> MANUAL SYNC returned no success or empty result:", result)
    except Exception as e:
        print(">>> MANUAL SYNC FAILED:", e)
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    asyncio.run(run_manual_sync())

"""
Daily automatic traffic-scan job.

Problem this solves: get_traffic_report_for_user() (the function that consumes a store's
daily 400-listing traffic-scan quota and advances SCAN PROGRESS / "Today Limit") was only
ever triggered as a side effect of a full listing sync completing. Since a full sync is
rate-limited to once per 24h per store, a user who doesn't manually click "Sync Now" every
day would never actually use that day's quota — the Today Limit card would sit at 0/400
indefinitely and the overall Scan Progress bar would never advance.

This job runs once per day (scheduled safely after eBay's own quota reset at midnight
Pacific Time) and triggers a traffic scan for every connected store automatically, so
progress advances on its own regardless of whether the user opens the dashboard that day.
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


async def run_daily_traffic_scan_for_all_users():
    """
    Iterate every store with an active eBay connection and trigger a traffic-scan
    (up to 400 listings / ~2 Analytics API calls each). Each call already respects the
    global daily Analytics budget and per-store 429 cooldown internally (ebay_rate_limiter),
    so this simply gives every connected store a fair daily chance at the shared quota —
    it does not bypass or duplicate any of the existing rate-limit protections.
    """
    from .models import get_db, Profile
    from .ebay_webhook import get_traffic_report_for_user

    db = next(get_db())
    try:
        connected_profiles = db.query(Profile).filter(
            Profile.ebay_connected == True,  # noqa: E712
            Profile.ebay_access_token.isnot(None)
        ).all()
        user_ids = [p.user_id for p in connected_profiles]
    except Exception as e:
        logger.error(f"❌ [DAILY-SCAN] Failed to load connected users: {e}")
        return
    finally:
        db.close()

    logger.info(f"🗓️ [DAILY-SCAN] Starting daily traffic scan for {len(user_ids)} connected store(s)")
    total_updated = 0
    total_skipped = 0

    for user_id in user_ids:
        try:
            result = await get_traffic_report_for_user(user_id)
            if result.get("success") and result.get("listings_updated", 0) > 0:
                total_updated += 1
            else:
                total_skipped += 1
                if result.get("skipped_reason"):
                    logger.info(f"ℹ️ [DAILY-SCAN] {user_id}: skipped — {result['skipped_reason']}")
        except Exception as e:
            logger.error(f"❌ [DAILY-SCAN] Failed for user {user_id}: {e}")
            total_skipped += 1

    logger.info(f"✅ [DAILY-SCAN] Complete: {total_updated} store(s) updated, {total_skipped} skipped, at {datetime.utcnow().isoformat()}Z")

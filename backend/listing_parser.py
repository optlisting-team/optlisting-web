"""
Listing Parser Utility - Consolidated parsing logic for eBay listings
Eliminates code duplication between ebay_webhook.py and services.py
"""
from datetime import date, datetime
from dateutil import parser
from typing import Dict, Any, Optional
from .models import Listing
import logging

logger = logging.getLogger(__name__)


def parse_listing_from_data(
    listing_data: Dict[str, Any],
    user_id: str,
    platform: str = "eBay"
) -> Listing:
    """
    Parse eBay listing data dictionary into Listing object.
    
    Args:
        listing_data: Dictionary containing listing data from eBay API
        user_id: User ID to associate with the listing
        platform: Platform name (default: "eBay")
        
    Returns:
        Listing object ready for database insertion
        
    Raises:
        ValueError: If user_id is invalid or required fields are missing
    """
    # Validate user_id
    if not user_id or user_id == "default-user":
        logger.error(f"❌ [PARSER] Invalid user_id: {user_id}")
        raise ValueError(f"user_id가 유효하지 않습니다: {user_id}. 'default-user'로 저장할 수 없습니다.")
    
    # Parse date_listed
    date_listed = date.today()
    if listing_data.get("start_time"):
        try:
            start_date = parser.parse(listing_data["start_time"])
            date_listed = start_date.date()
        except Exception as e:
            logger.warning(f"⚠️ [PARSER] Failed to parse start_time: {e}, using today's date")
    
    # Extract image URL (try multiple fields)
    image_url = (
        listing_data.get("image_url") or 
        listing_data.get("picture_url") or 
        listing_data.get("thumbnail_url") or 
        ""
    )
    
    # Create Listing object
    listing_obj = Listing(
        ebay_item_id=listing_data["item_id"],
        item_id=listing_data["item_id"],
        title=listing_data["title"],
        sku=listing_data.get("sku", ""),
        image_url=image_url,
        price=listing_data.get("price", 0),
        date_listed=date_listed,
        sold_qty=listing_data.get("quantity_sold", 0),
        watch_count=listing_data.get("watch_count", 0),
        view_count=listing_data.get("view_count", 0),
        user_id=user_id,
        supplier_name=listing_data.get("supplier_name"),
        supplier_id=listing_data.get("supplier_id"),
        source=listing_data.get("supplier_name") or "ebay",  # NOT NULL
        marketplace="eBay",
        platform=platform,  # CRITICAL: Must match summary query key
        raw_data=listing_data.get("raw_data", {}),
        last_synced_at=datetime.utcnow()
    )
    
    # Verify platform was set correctly
    actual_platform = getattr(listing_obj, 'platform', None)
    if actual_platform != platform:
        logger.error(f"❌ [PARSER] Platform mismatch: '{actual_platform}' != '{platform}'")
    
    logger.debug(
        f"📝 [PARSER] Created Listing: user_id={user_id}, "
        f"platform='{actual_platform}', item_id={listing_data['item_id']}"
    )
    
    return listing_obj

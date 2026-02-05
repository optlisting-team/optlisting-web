"""
Lemon Squeezy Webhook Handler
Stability principle: Log all errors and return 200 OK (prevents LS retries)

Handles subscription events for $120/month Professional Plan
"""
import os
import hmac
import hashlib
import json
import logging
from typing import Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from .models import Profile

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables with safe fallbacks
LS_WEBHOOK_SECRET = os.getenv("LEMON_SQUEEZY_WEBHOOK_SECRET") or os.getenv("LS_WEBHOOK_SECRET") or ""

# Warning log for missing webhook secret
if not LS_WEBHOOK_SECRET:
    logger.warning("⚠️ [CONFIG] LEMON_SQUEEZY_WEBHOOK_SECRET is not set. Webhook signature verification will fail.")

# Listing limits per plan
PLAN_LIMITS = {
    "pro": 999999,  # Pro plan: effectively unlimited
    "free": 100,    # Free plan: 100 limit
    "default": 100  # Default
}

# Credit pack definition (price -> credits). Match by Lemon Squeezy variant_id or product_name.
CREDIT_PACKS = {
    # Price in cents -> credits
    500: 300,      # $5 -> 300 credits
    1000: 800,     # $10 -> 800 credits
    1500: 1200,    # $15 -> 1,200 credits
    2000: 2000,    # $20 -> 2,000 credits
    2500: 2600,    # $25 -> 2,600 credits
    5000: 6000,    # $50 -> 6,000 credits
}

# Variant ID -> credits (update after Lemon Squeezy setup)
VARIANT_CREDITS = {
    "1150506": 1000,  # Credit Pack_1000 - $5.00 -> 1,000 credits
}


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """
    Verify Lemon Squeezy webhook payload using HMAC SHA256 (X-Signature header).
    Returns True only if secret is set, signature is present, and digest matches.
    """
    if not LS_WEBHOOK_SECRET:
        logger.error("LEMON_SQUEEZY_WEBHOOK_SECRET not set")
        return False
    if not signature:
        logger.error("Webhook X-Signature header missing")
        return False
    try:
        expected_signature = hmac.new(
            LS_WEBHOOK_SECRET.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        is_valid = hmac.compare_digest(expected_signature, signature)
        if not is_valid:
            logger.warning("Webhook signature mismatch")
        return is_valid
    except Exception as e:
        logger.error("Webhook signature verification error: %s", e)
        return False


def get_or_create_profile(db: Session, user_id: str) -> Profile:
    """
    Get existing profile by user_id or create one (idempotent). Handles race
    conditions; safe for concurrent webhook and API calls.
    """
    logger.info(f"[get_or_create_profile] START: user_id={user_id}")
    try:
        # Try query first
        logger.info(f"[get_or_create_profile] Querying profile for user_id={user_id}")
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            logger.info(f"[get_or_create_profile] Profile not found, creating new profile for user_id={user_id}")
            # Create profile if not present (idempotent)
            try:
                logger.info(f"[get_or_create_profile] Creating Profile object for user_id={user_id}")
                profile = Profile(
                    user_id=user_id,
                    subscription_status='inactive',
                    subscription_plan='free',
                    total_listings_limit=PLAN_LIMITS['free'],
                    purchased_credits=0,
                    consumed_credits=0,
                    current_plan='free'
                )
                logger.info(f"[get_or_create_profile] Adding profile to session for user_id={user_id}")
                db.add(profile)
                logger.info(f"[get_or_create_profile] Committing profile creation for user_id={user_id}")
                db.commit()
                logger.info(f"[get_or_create_profile] Refreshing profile for user_id={user_id}")
                db.refresh(profile)
                logger.info(f"[get_or_create_profile] New profile created: user_id={user_id}, profile_id={profile.id}")
            except SQLAlchemyError as e:
                db.rollback()
                logger.error(f"[get_or_create_profile] ❌ Profile creation failed: user_id={user_id}, error={str(e)}", exc_info=True)
                logger.error(f"[get_or_create_profile] Error type: {type(e).__name__}, Error details: {repr(e)}")
                # Race condition: another process may have already created
                # Retry query
                logger.info(f"[get_or_create_profile] Retrying query after rollback for user_id={user_id}")
                profile = db.query(Profile).filter(Profile.user_id == user_id).first()
                if not profile:
                    logger.error(f"[get_or_create_profile] Profile creation and retry both failed: user_id={user_id}, error={e}")
                    raise
                else:
                    logger.info(f"[get_or_create_profile] Profile already created by another process: user_id={user_id}, profile_id={profile.id}")
        else:
            logger.info(f"[get_or_create_profile] ✅ Profile found: user_id={user_id}, profile_id={profile.id}, purchased_credits={profile.purchased_credits}, consumed_credits={profile.consumed_credits}")
        
        logger.info(f"[get_or_create_profile] END: user_id={user_id}, profile_id={profile.id}")
        return profile
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"[get_or_create_profile] DB error during profile get/create: user_id={user_id}, error={str(e)}", exc_info=True)
        logger.error(f"[get_or_create_profile] Error type: {type(e).__name__}, Error details: {repr(e)}")
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"[get_or_create_profile] Unexpected error during profile get/create: user_id={user_id}, error={str(e)}", exc_info=True)
        logger.error(f"[get_or_create_profile] Error type: {type(e).__name__}, Error details: {repr(e)}")
        raise


def handle_subscription_created(db: Session, event_data: Dict) -> bool:
    """
    Handle subscription_created event for $120/month Professional Plan
    
    Sets subscription_plan to 'professional' and status to 'active'
    Shows "Activation in Progress" state if sync is pending
    
    Args:
        db: Database session
        event_data: Webhook event data
    
    Returns:
        Processing success status
    """
    try:
        # Extract information from Lemon Squeezy webhook data structure
        subscription = event_data.get('data', {}).get('attributes', {})
        customer_id = subscription.get('customer_id')
        subscription_id = subscription.get('id') or event_data.get('data', {}).get('id')
        
        # Extract user_id from custom_data or meta
        # LS typically includes user_id in custom_data passed during checkout
        # Check multiple paths: data.attributes.custom_data, meta.custom_data, checkout_data.custom
        custom_data = subscription.get('custom_data', {})
        if isinstance(custom_data, str):
            try:
                custom_data = json.loads(custom_data)
            except:
                custom_data = {}
        
        user_id = (
            custom_data.get('user_id') or 
            subscription.get('user_id') or
            event_data.get('meta', {}).get('custom_data', {}).get('user_id')
        )
        
        if not user_id:
            # HIGH-PRIORITY ERROR: Full payload logging for manual intervention
            logger.error("🚨 [WEBHOOK] CRITICAL: subscription_created - user_id not found in webhook payload")
            logger.error("🚨 [WEBHOOK] FULL PAYLOAD DUMP (for manual user_id extraction):")
            logger.error(f"   Full event_data: {json.dumps(event_data, indent=2, default=str)}")
            logger.error(f"   data.attributes.custom_data: {subscription.get('custom_data')}")
            logger.error(f"   meta.custom_data: {event_data.get('meta', {}).get('custom_data')}")
            logger.error(f"   subscription_id: {subscription_id}")
            logger.error(f"   customer_id: {customer_id}")
            logger.error("🚨 [WEBHOOK] ACTION REQUIRED: Manually extract user_id from payload above and update profile")
            return False
        
        logger.info(f"✅ [WEBHOOK] subscription_created: Extracted user_id={user_id} from webhook payload")
        logger.info(f"   Product ID: 795931, Variant ID: 1255285 (for verification)")
        logger.info(f"   subscription_id: {subscription_id}, customer_id: {customer_id}")
        
        # Get or create profile
        profile = get_or_create_profile(db, user_id)
        
        # Update subscription information for $120/month Professional Plan
        profile.ls_customer_id = str(customer_id) if customer_id else profile.ls_customer_id
        profile.ls_subscription_id = str(subscription_id) if subscription_id else profile.ls_subscription_id
        profile.subscription_status = 'active'
        profile.subscription_plan = 'professional'  # $120/month Professional Plan
        profile.total_listings_limit = PLAN_LIMITS['pro']
        
        db.commit()
        db.refresh(profile)  # Refresh to ensure changes are visible
        
        # Database verification: Confirm the update was successful
        logger.info(f"✅ [WEBHOOK] Subscription created successfully: user_id={user_id}, subscription_id={subscription_id}, plan=professional, status=active")
        logger.info(f"   Profile updated: subscription_plan={profile.subscription_plan}, subscription_status={profile.subscription_status}")
        logger.info(f"   Database verification: ls_subscription_id={profile.ls_subscription_id}, ls_customer_id={profile.ls_customer_id}")
        
        # Verify database update was successful
        verification_profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        if verification_profile:
            if verification_profile.subscription_plan == 'professional' and verification_profile.subscription_status == 'active':
                logger.info(f"✅ [WEBHOOK] Database verification PASSED: Profile correctly updated in database")
            else:
                logger.error(f"❌ [WEBHOOK] Database verification FAILED: subscription_plan={verification_profile.subscription_plan}, subscription_status={verification_profile.subscription_status}")
        else:
            logger.error(f"❌ [WEBHOOK] Database verification FAILED: Profile not found after update")
        
        return True
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"❌ Database error processing subscription_created: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error processing subscription_created: {e}")
        return False


def handle_subscription_updated(db: Session, event_data: Dict) -> bool:
    """
    Handle subscription_updated: update total_listings_limit and subscription_status on plan change.
    Args: db, event_data. Returns: success.
    """
    try:
        subscription = event_data.get('data', {}).get('attributes', {})
        subscription_id = subscription.get('id') or event_data.get('data', {}).get('id')
        status = subscription.get('status', '').lower()
        
        # Extract user_id
        custom_data = subscription.get('custom_data', {})
        user_id = custom_data.get('user_id') or subscription.get('user_id')
        
        if not user_id:
            # Find profile by subscription_id
            profile = db.query(Profile).filter(
                Profile.ls_subscription_id == str(subscription_id)
            ).first()
            if not profile:
                logger.error(f"subscription_updated: No profile found for subscription_id={subscription_id}")
                return False
            user_id = profile.user_id
        else:
            profile = get_or_create_profile(db, user_id)
        
        # Update status
        if status in ['active', 'cancelled', 'expired', 'past_due']:
            profile.subscription_status = status
        
        # Plan check and limit update
        # LS distinguishes plan by variant_id or product_id
        variant_id = subscription.get('variant_id')
        product_id = subscription.get('product_id')
        
        # Check if Pro plan (by variant_id or product_id)
        # Adjust to match actual LS setup
        is_pro_plan = (
            variant_id and 'pro' in str(variant_id).lower()
        ) or (
            product_id and 'pro' in str(product_id).lower()
        ) or status == 'active'  # Treat active as Pro
        
        if is_pro_plan and status == 'active':
            profile.subscription_plan = 'pro'
            profile.total_listings_limit = PLAN_LIMITS['pro']
        else:
            profile.subscription_plan = 'free'
            profile.total_listings_limit = PLAN_LIMITS['free']
        
        # Update subscription ID if missing
        if not profile.ls_subscription_id:
            profile.ls_subscription_id = str(subscription_id)
        
        db.commit()
        logger.info(f"Subscription updated: user_id={user_id}, status={status}, plan={profile.subscription_plan}")
        return True
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"subscription_updated DB error: {e}")
        return False
    except Exception as e:
        logger.error(f"subscription_updated: Unexpected error: {e}")
        return False


def handle_subscription_cancelled(db: Session, event_data: Dict) -> bool:
    """
    subscription_cancelled 이벤트 처리
    subscription_status를 'cancelled'로 변경
    
    Args:
        db: 데이터베이스 세션
        event_data: 웹훅 이벤트 데이터
    
    Returns:
        처리 성공 여부
    """
    try:
        subscription = event_data.get('data', {}).get('attributes', {})
        subscription_id = subscription.get('id') or event_data.get('data', {}).get('id')
        
        # Extract user_id
        custom_data = subscription.get('custom_data', {})
        user_id = custom_data.get('user_id') or subscription.get('user_id')
        
        if not user_id:
            # Find profile by subscription_id
            profile = db.query(Profile).filter(
                Profile.ls_subscription_id == str(subscription_id)
            ).first()
            if not profile:
                logger.error(f"subscription_cancelled: No profile found for subscription_id={subscription_id}")
                return False
        else:
            profile = get_or_create_profile(db, user_id)
        
        # Set status to cancelled; limit kept until expiry
        profile.subscription_status = 'cancelled'
        
        db.commit()
        logger.info(f"Subscription cancelled: user_id={profile.user_id}, subscription_id={subscription_id}")
        return True
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"subscription_cancelled: DB error: {e}")
        return False
    except Exception as e:
        logger.error(f"subscription_cancelled: Unexpected error: {e}")
        return False


def find_user_id_recursive(data: Dict, key: str = "user_id", max_depth: int = 10, current_depth: int = 0) -> Optional[str]:
    """
    Recursively find user_id in dictionary.
    
    Args:
        data: Dictionary to search
        key: Key name to find
        max_depth: Max recursion depth
        current_depth: Current depth
    
    Returns:
        Found user_id value or None
    """
    if current_depth >= max_depth or not isinstance(data, dict):
        return None
    
    # Check current level directly
    if key in data and data[key]:
        return str(data[key])
    
    # Recursive search over all values
    for value in data.values():
        if isinstance(value, dict):
            result = find_user_id_recursive(value, key, max_depth, current_depth + 1)
            if result:
                return result
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    result = find_user_id_recursive(item, key, max_depth, current_depth + 1)
                    if result:
                        return result
    
    return None


def parse_custom_data(custom_data) -> Dict:
    """Parse custom_data to dict."""
    if isinstance(custom_data, dict):
        return custom_data
    elif isinstance(custom_data, str):
        try:
            return json.loads(custom_data)
        except:
            return {}
    return {}


def handle_order_created(db: Session, event_data: Dict) -> bool:
    """
    Handle order_created (credit pack purchase). Add credits after payment confirmed.
    Args: db, event_data. Returns: success.
    """
    from .credit_service import add_credits, TransactionType
    import requests
    
    try:
        order_data = event_data.get('data', {})
        order_id = str(order_data.get('id', ''))
        
        logger.info(f"[WEBHOOK] order_created: Processing order_id={order_id}")
        
        # Idempotency check: Check if order_id already processed
        # Use ls_order_ prefix for reference_id
        reference_id = f"ls_order_{order_id}"
        try:
            existing = db.execute(
                text("""
                    SELECT reference_id FROM credit_transactions 
                    WHERE reference_id = :reference_id AND transaction_type = 'purchase'
                """),
                {"reference_id": reference_id}
            ).fetchone()
            
            if existing:
                logger.info(f"[WEBHOOK] order_created: Order {order_id} already processed, skipping (idempotency)")
                return True  # Already processed, return success
        except Exception as e:
            logger.warning(f"[WEBHOOK] order_created: Idempotency check failed: {e}, continuing...")
        
        order_attributes = order_data.get('attributes', {})
        meta_data = event_data.get('meta', {})
        
        # user_id 추출 - 여러 경로 시도
        user_id = None
        extraction_paths = []
        
        # 경로 1: event_data["data"]["attributes"]["custom_data"]["user_id"]
        custom_data_1 = order_attributes.get('custom_data', {})
        custom_data_1 = parse_custom_data(custom_data_1)
        if custom_data_1.get('user_id'):
            user_id = str(custom_data_1['user_id'])
            extraction_paths.append("data.attributes.custom_data.user_id")
        
        # Path 2: event_data["meta"]["custom_data"]["user_id"]
        if not user_id:
            custom_data_2 = meta_data.get('custom_data', {})
            custom_data_2 = parse_custom_data(custom_data_2)
            if custom_data_2.get('user_id'):
                user_id = str(custom_data_2['user_id'])
                extraction_paths.append("meta.custom_data.user_id")
        
        # 경로 3: event_data["data"]["attributes"]["first_order_item"]["custom_data"]["user_id"]
        if not user_id:
            first_order_item = order_attributes.get('first_order_item', {})
            if first_order_item:
                item_custom_data = first_order_item.get('custom_data', {})
                item_custom_data = parse_custom_data(item_custom_data)
                if item_custom_data.get('user_id'):
                    user_id = str(item_custom_data['user_id'])
                    extraction_paths.append("data.attributes.first_order_item.custom_data.user_id")
        
        # Path 4: recursive search
        if not user_id:
            user_id = find_user_id_recursive(event_data)
            if user_id:
                extraction_paths.append("recursive_search")
        
        if not user_id:
            # On failure log payload sample (first 2000 chars)
            payload_sample = json.dumps(event_data, indent=2)[:2000]
            logger.error(f"[WEBHOOK] order_created: user_id not found. order_id={order_id}")
            logger.error(f"[WEBHOOK] order_created: Tried paths: data.attributes.custom_data, meta.custom_data, first_order_item.custom_data, recursive_search")
            logger.error(f"[WEBHOOK] order_created: Payload sample:\n{payload_sample}")
            return False
        
        logger.info(f"[WEBHOOK] order_created: user_id found via {extraction_paths[0] if extraction_paths else 'unknown'}: user_id={user_id}")
        
        # Extract variant_id
        first_order_item = order_attributes.get('first_order_item', {})
        variant_id = str(first_order_item.get('variant_id', '')) if first_order_item else ''
        
        # If no variant_id, fetch order detail from Lemon Squeezy API
        if not variant_id:
            logger.info(f"[WEBHOOK] order_created: variant_id not in payload, fetching from API...")
            LS_API_KEY = os.getenv("LEMON_SQUEEZY_API_KEY")
            if LS_API_KEY:
                try:
                    response = requests.get(
                        f"https://api.lemonsqueezy.com/v1/orders/{order_id}",
                        headers={
                            "Authorization": f"Bearer {LS_API_KEY}",
                            "Accept": "application/vnd.api+json",
                        },
                        timeout=10,
                    )
                    if response.status_code == 200:
                        api_order_data = response.json()
                        api_first_item = api_order_data.get('data', {}).get('attributes', {}).get('first_order_item', {})
                        variant_id = str(api_first_item.get('variant_id', '')) if api_first_item else ''
                        logger.info(f"[WEBHOOK] order_created: variant_id from API: {variant_id}")
                except Exception as e:
                    logger.warning(f"[WEBHOOK] order_created: Failed to fetch order from API: {e}")
        
        if not variant_id:
            logger.error(f"[WEBHOOK] order_created: variant_id를 찾을 수 없습니다. order_id={order_id}")
            return False
        
        logger.info(f"[WEBHOOK] order_created: order_id={order_id}, variant_id={variant_id}, user_id={user_id}")
        
        # Confirm payment (paid) status
        is_paid = False
        
        # Method 1: check status in payload
        order_status = order_attributes.get('status', '').lower()
        if order_status == 'paid':
            is_paid = True
            logger.info(f"[WEBHOOK] order_created: Order status is 'paid' from payload")
        else:
            # Method 2: check order status via Lemon Squeezy API
            logger.info(f"[WEBHOOK] order_created: Order status not 'paid' in payload, checking via API...")
            LS_API_KEY = os.getenv("LEMON_SQUEEZY_API_KEY")
            if LS_API_KEY:
                try:
                    response = requests.get(
                        f"https://api.lemonsqueezy.com/v1/orders/{order_id}",
                        headers={
                            "Authorization": f"Bearer {LS_API_KEY}",
                            "Accept": "application/vnd.api+json",
                        },
                        timeout=10,
                    )
                    if response.status_code == 200:
                        api_order_data = response.json()
                        api_status = api_order_data.get('data', {}).get('attributes', {}).get('status', '').lower()
                        if api_status == 'paid':
                            is_paid = True
                            logger.info(f"[WEBHOOK] order_created: Order status confirmed as 'paid' via API")
                        else:
                            logger.info(f"[WEBHOOK] order_created: Order status is '{api_status}', skipping credit addition")
                    else:
                        logger.warning(f"[WEBHOOK] order_created: API returned {response.status_code}, assuming not paid")
                except Exception as e:
                    logger.warning(f"[WEBHOOK] order_created: Failed to verify payment status via API: {e}, assuming not paid")
        
        if not is_paid:
            logger.info(f"[WEBHOOK] order_created: Order {order_id} is not paid, skipping credit addition")
            return True  # Not paid, but return success to prevent retries
        
        # Determine credits to add based on variant_id
        credits_to_add = 0
        if variant_id in VARIANT_CREDITS:
            credits_to_add = VARIANT_CREDITS[variant_id]
        else:
            logger.warning(f"[WEBHOOK] order_created: Unknown variant_id {variant_id}, skipping credit addition")
            return False
        
        if credits_to_add <= 0:
            logger.warning(f"[WEBHOOK] order_created: Invalid credits amount {credits_to_add} for variant {variant_id}")
            return False
        
        # Ensure profile exists (idempotent - creates if not exists)
        try:
            get_or_create_profile(db, user_id)
        except Exception as e:
            logger.warning(f"[WEBHOOK] order_created: Failed to ensure profile exists: {e}, continuing anyway...")
        
        # Add credits atomically (will auto-create profile if needed)
        # Use ls_order_ prefix for reference_id to avoid conflicts
        reference_id = f"ls_order_{order_id}"
        result = add_credits(
            db=db,
            user_id=user_id,
            amount=credits_to_add,
            transaction_type=TransactionType.PURCHASE,
            description=f"Lemon Squeezy purchase: variant {variant_id}",
            reference_id=reference_id  # Use ls_order_ prefix for idempotency
        )
        
        if result.success:
            logger.info(f"[WEBHOOK] order_created: Successfully added {credits_to_add} credits to user {user_id}. order_id={order_id}, variant_id={variant_id}, new_balance={result.total_credits}")
            return True
        else:
            logger.error(f"[WEBHOOK] order_created: Failed to add credits: {result.message}")
            return False
            
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"[WEBHOOK] order_created: Database error: {e}")
        return False
    except Exception as e:
        logger.error(f"[WEBHOOK] order_created: Unexpected error: {e}", exc_info=True)
        return False


def handle_order_paid(db: Session, event_data: Dict) -> bool:
    """
    Handle order_paid (credit top-up). Args: db, event_data. Returns: success.
    """
    from .credit_service import add_credits, TransactionType
    from sqlalchemy import text
    
    try:
        order_data = event_data.get('data', {})
        order_attributes = order_data.get('attributes', {})
        order_id = str(order_data.get('id', ''))
        
        logger.info(f"[WEBHOOK] order_paid received: order_id={order_id}")
        
        # Idempotency check: Check if order_id already processed
        # Use ls_order_ prefix for reference_id
        reference_id = f"ls_order_{order_id}"
        try:
            existing = db.execute(
                text("""
                    SELECT reference_id FROM credit_transactions 
                    WHERE reference_id = :reference_id AND transaction_type = 'purchase'
                """),
                {"reference_id": reference_id}
            ).fetchone()
            
            if existing:
                logger.info(f"[WEBHOOK] Order {order_id} already processed, skipping (idempotency)")
                return True  # Already processed, return success
        except Exception as e:
            logger.warning(f"[WEBHOOK] Idempotency check failed: {e}, continuing...")
        
        # Extract variant_id from first_order_item
        first_order_item = order_attributes.get('first_order_item', {})
        variant_id = str(first_order_item.get('variant_id', ''))
        
        logger.info(f"[WEBHOOK] order_paid: order_id={order_id}, variant_id={variant_id}")
        
        # Extract user_id from custom_data
        custom_data = order_attributes.get('custom_data', {})
        if isinstance(custom_data, str):
            try:
                import json
                custom_data = json.loads(custom_data)
            except:
                custom_data = {}
        
        user_id = custom_data.get('user_id')
        
        # If not in order custom_data, try first_order_item
        if not user_id:
            item_custom_data = first_order_item.get('custom_data', {})
            if isinstance(item_custom_data, str):
                try:
                    import json
                    item_custom_data = json.loads(item_custom_data)
                except:
                    item_custom_data = {}
            user_id = item_custom_data.get('user_id')
        
        if not user_id:
            logger.error(f"[WEBHOOK] order_paid: user_id not found in custom_data. order_id={order_id}")
            return False
        
        logger.info(f"[WEBHOOK] order_paid: order_id={order_id}, variant_id={variant_id}, user_id={user_id}")
        
        # Determine credits to add based on variant_id
        credits_to_add = 0
        if variant_id in VARIANT_CREDITS:
            credits_to_add = VARIANT_CREDITS[variant_id]
        else:
            logger.warning(f"[WEBHOOK] order_paid: Unknown variant_id {variant_id}, skipping credit addition")
            return False
        
        if credits_to_add <= 0:
            logger.warning(f"[WEBHOOK] order_paid: Invalid credits amount {credits_to_add} for variant {variant_id}")
            return False
        
        # Ensure profile exists (idempotent - creates if not exists)
        try:
            get_or_create_profile(db, user_id)
        except Exception as e:
            logger.warning(f"[WEBHOOK] order_paid: Failed to ensure profile exists: {e}, continuing anyway...")
        
        # Add credits atomically (will auto-create profile if needed)
        # Use ls_order_ prefix for reference_id to avoid conflicts
        reference_id = f"ls_order_{order_id}"
        result = add_credits(
            db=db,
            user_id=user_id,
            amount=credits_to_add,
            transaction_type=TransactionType.PURCHASE,
            description=f"Lemon Squeezy purchase: variant {variant_id}",
            reference_id=reference_id  # Use ls_order_ prefix for idempotency
        )
        
        if result.success:
            logger.info(f"[WEBHOOK] order_paid: Successfully added {credits_to_add} credits to user {user_id}. order_id={order_id}, variant_id={variant_id}, new_balance={result.total_credits}")
            return True
        else:
            logger.error(f"[WEBHOOK] order_paid: Failed to add credits: {result.message}")
            return False
            
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"[WEBHOOK] order_paid: Database error: {e}")
        return False
    except Exception as e:
        logger.error(f"[WEBHOOK] order_paid: Unexpected error: {e}", exc_info=True)
        return False


def process_webhook_event(db: Session, event_data: Dict) -> bool:
    """
    Route Lemon Squeezy webhook event by meta.event_name; update profile,
    credits, or subscription. Returns True if handled successfully.
    """
    event_name = event_data.get('meta', {}).get('event_name', '')
    logger.info("Webhook event: %s", event_name)
    
    try:
        if event_name == 'subscription_created':
            return handle_subscription_created(db, event_data)
        elif event_name == 'subscription_updated':
            return handle_subscription_updated(db, event_data)
        elif event_name == 'subscription_cancelled':
            return handle_subscription_cancelled(db, event_data)
        elif event_name == 'order_created':
            return handle_order_created(db, event_data)
        elif event_name == 'order_paid':
            return handle_order_paid(db, event_data)
        else:
            logger.warning(f"Unhandled event: {event_name}")
            return True  # Unknown event -> return success (200 OK)
            
    except Exception as e:
        logger.error(f"Webhook event handling error: {e}")
        return False


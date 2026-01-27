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

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables with safe fallbacks
LS_WEBHOOK_SECRET = os.getenv("LEMON_SQUEEZY_WEBHOOK_SECRET") or os.getenv("LS_WEBHOOK_SECRET") or ""

# 플랜별 리스팅 제한
PLAN_LIMITS = {
    "pro": 999999,  # Pro 플랜: 실질적으로 무제한
    "free": 100,    # Free 플랜: 100개 제한
    "default": 100  # 기본값
}

# 크레딧 팩 정의 (가격 → 크레딧 매핑)
# Lemon Squeezy의 variant_id 또는 product_name으로 매칭
CREDIT_PACKS = {
    # 가격 기준 매핑 (단위: cents)
    500: 300,      # $5 → 300 크레딧
    1000: 800,     # $10 → 800 크레딧
    1500: 1200,    # $15 → 1,200 크레딧
    2000: 2000,    # $20 → 2,000 크레딧
    2500: 2600,    # $25 → 2,600 크레딧
    5000: 6000,    # $50 → 6,000 크레딧
}

# Variant ID 기준 매핑 (Lemon Squeezy 설정 후 업데이트 필요)
VARIANT_CREDITS = {
    "1150506": 1000,  # Credit Pack_1000 - $5.00 → 1,000 크레딧
    # "variant_id": credits
    # 예: "12345": 300,
}


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """
    Lemon Squeezy 웹훅 시그니처 검증
    LS는 HMAC SHA256을 사용하여 시그니처를 생성합니다.
    
    Args:
        payload: 원본 요청 본문 (bytes)
        signature: X-Signature 헤더 값
    
    Returns:
        검증 성공 여부
    """
    if not LS_WEBHOOK_SECRET:
        logger.error("LS_WEBHOOK_SECRET 환경 변수가 설정되지 않았습니다")
        return False
    
    if not signature:
        logger.error("웹훅 시그니처가 제공되지 않았습니다")
        return False
    
    try:
        # HMAC SHA256으로 시그니처 생성
        expected_signature = hmac.new(
            LS_WEBHOOK_SECRET.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # 시그니처 비교 (타이밍 공격 방지를 위해 hmac.compare_digest 사용)
        is_valid = hmac.compare_digest(expected_signature, signature)
        
        if not is_valid:
            logger.warning(f"웹훅 시그니처 검증 실패. 예상: {expected_signature[:10]}..., 받음: {signature[:10]}...")
        
        return is_valid
    except Exception as e:
        logger.error(f"웹훅 시그니처 검증 중 오류: {e}")
        return False


def get_or_create_profile(db: Session, user_id: str) -> Profile:
    """
    프로필 조회 또는 생성 (idempotent, 안정성: 트랜잭션 처리)
    
    Profile이 없으면 자동으로 생성합니다.
    Race condition을 고려하여 idempotent하게 구현되었습니다.
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
    
    Returns:
        Profile 객체
    """
    logger.info(f"[get_or_create_profile] START: user_id={user_id}")
    try:
        # 먼저 조회 시도
        logger.info(f"[get_or_create_profile] Querying profile for user_id={user_id}")
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            logger.info(f"[get_or_create_profile] Profile not found, creating new profile for user_id={user_id}")
            # 프로필이 없으면 생성 (idempotent)
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
                logger.info(f"[get_or_create_profile] ✅ 새 프로필 생성 성공: user_id={user_id}, profile_id={profile.id}")
            except SQLAlchemyError as e:
                db.rollback()
                logger.error(f"[get_or_create_profile] ❌ Profile creation failed: user_id={user_id}, error={str(e)}", exc_info=True)
                logger.error(f"[get_or_create_profile] Error type: {type(e).__name__}, Error details: {repr(e)}")
                # Race condition: 다른 프로세스가 이미 생성했을 수 있음
                # 다시 조회 시도
                logger.info(f"[get_or_create_profile] Retrying query after rollback for user_id={user_id}")
                profile = db.query(Profile).filter(Profile.user_id == user_id).first()
                if not profile:
                    logger.error(f"[get_or_create_profile] ❌ 프로필 생성 실패 및 재조회 실패: user_id={user_id}, error={e}")
                    raise
                else:
                    logger.info(f"[get_or_create_profile] ✅ 프로필이 다른 프로세스에 의해 이미 생성됨: user_id={user_id}, profile_id={profile.id}")
        else:
            logger.info(f"[get_or_create_profile] ✅ Profile found: user_id={user_id}, profile_id={profile.id}, purchased_credits={profile.purchased_credits}, consumed_credits={profile.consumed_credits}")
        
        logger.info(f"[get_or_create_profile] END: user_id={user_id}, profile_id={profile.id}")
        return profile
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"[get_or_create_profile] ❌ 프로필 조회/생성 중 DB 오류: user_id={user_id}, error={str(e)}", exc_info=True)
        logger.error(f"[get_or_create_profile] Error type: {type(e).__name__}, Error details: {repr(e)}")
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"[get_or_create_profile] ❌ 프로필 조회/생성 중 예상치 못한 오류: user_id={user_id}, error={str(e)}", exc_info=True)
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
        # LS typically includes user_id in custom_data
        custom_data = subscription.get('custom_data', {})
        user_id = custom_data.get('user_id') or subscription.get('user_id')
        
        if not user_id:
            logger.error("subscription_created: user_id not found in webhook payload")
            return False
        
        # Get or create profile
        profile = get_or_create_profile(db, user_id)
        
        # Update subscription information for $120/month Professional Plan
        profile.ls_customer_id = str(customer_id) if customer_id else profile.ls_customer_id
        profile.ls_subscription_id = str(subscription_id) if subscription_id else profile.ls_subscription_id
        profile.subscription_status = 'active'
        profile.subscription_plan = 'professional'  # $120/month Professional Plan
        profile.total_listings_limit = PLAN_LIMITS['pro']
        
        db.commit()
        logger.info(f"✅ Subscription created successfully: user_id={user_id}, subscription_id={subscription_id}, plan=professional")
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
    subscription_updated 이벤트 처리
    플랜 변경(업그레이드/다운그레이드) 시 total_listings_limit 및 subscription_status 업데이트
    
    Args:
        db: 데이터베이스 세션
        event_data: 웹훅 이벤트 데이터
    
    Returns:
        처리 성공 여부
    """
    try:
        subscription = event_data.get('data', {}).get('attributes', {})
        subscription_id = subscription.get('id') or event_data.get('data', {}).get('id')
        status = subscription.get('status', '').lower()
        
        # user_id 추출
        custom_data = subscription.get('custom_data', {})
        user_id = custom_data.get('user_id') or subscription.get('user_id')
        
        if not user_id:
            # subscription_id로 프로필 찾기
            profile = db.query(Profile).filter(
                Profile.ls_subscription_id == str(subscription_id)
            ).first()
            if not profile:
                logger.error(f"subscription_updated: subscription_id={subscription_id}에 해당하는 프로필을 찾을 수 없습니다")
                return False
            user_id = profile.user_id
        else:
            profile = get_or_create_profile(db, user_id)
        
        # 상태 업데이트
        if status in ['active', 'cancelled', 'expired', 'past_due']:
            profile.subscription_status = status
        
        # 플랜 확인 및 제한 업데이트
        # LS에서는 variant_id 또는 product_id로 플랜을 구분합니다
        variant_id = subscription.get('variant_id')
        product_id = subscription.get('product_id')
        
        # Pro 플랜인지 확인 (variant_id 또는 product_id로 판단)
        # 실제 LS 설정에 맞게 조정 필요
        is_pro_plan = (
            variant_id and 'pro' in str(variant_id).lower()
        ) or (
            product_id and 'pro' in str(product_id).lower()
        ) or status == 'active'  # 활성 상태면 Pro로 간주
        
        if is_pro_plan and status == 'active':
            profile.subscription_plan = 'pro'
            profile.total_listings_limit = PLAN_LIMITS['pro']
        else:
            profile.subscription_plan = 'free'
            profile.total_listings_limit = PLAN_LIMITS['free']
        
        # 구독 ID 업데이트 (없는 경우)
        if not profile.ls_subscription_id:
            profile.ls_subscription_id = str(subscription_id)
        
        db.commit()
        logger.info(f"구독 업데이트 완료: user_id={user_id}, status={status}, plan={profile.subscription_plan}")
        return True
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"subscription_updated 처리 중 DB 오류: {e}")
        return False
    except Exception as e:
        logger.error(f"subscription_updated 처리 중 예상치 못한 오류: {e}")
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
        
        # user_id 추출
        custom_data = subscription.get('custom_data', {})
        user_id = custom_data.get('user_id') or subscription.get('user_id')
        
        if not user_id:
            # subscription_id로 프로필 찾기
            profile = db.query(Profile).filter(
                Profile.ls_subscription_id == str(subscription_id)
            ).first()
            if not profile:
                logger.error(f"subscription_cancelled: subscription_id={subscription_id}에 해당하는 프로필을 찾을 수 없습니다")
                return False
        else:
            profile = get_or_create_profile(db, user_id)
        
        # 상태를 cancelled로 변경
        profile.subscription_status = 'cancelled'
        # 제한은 유지 (기간 만료까지 사용 가능)
        
        db.commit()
        logger.info(f"구독 취소 완료: user_id={profile.user_id}, subscription_id={subscription_id}")
        return True
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"subscription_cancelled 처리 중 DB 오류: {e}")
        return False
    except Exception as e:
        logger.error(f"subscription_cancelled 처리 중 예상치 못한 오류: {e}")
        return False


def find_user_id_recursive(data: Dict, key: str = "user_id", max_depth: int = 10, current_depth: int = 0) -> Optional[str]:
    """
    재귀적으로 딕셔너리에서 user_id 찾기
    
    Args:
        data: 검색할 딕셔너리
        key: 찾을 키 이름
        max_depth: 최대 재귀 깊이
        current_depth: 현재 깊이
    
    Returns:
        찾은 user_id 값 또는 None
    """
    if current_depth >= max_depth or not isinstance(data, dict):
        return None
    
    # 현재 레벨에서 직접 확인
    if key in data and data[key]:
        return str(data[key])
    
    # 모든 값에 대해 재귀 검색
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
    """custom_data를 딕셔너리로 파싱"""
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
    order_created 이벤트 처리 (크레딧 팩 구매)
    결제 성공 확인 후 크레딧 적립
    
    Args:
        db: 데이터베이스 세션
        event_data: 웹훅 이벤트 데이터
    
    Returns:
        처리 성공 여부
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
        
        # 경로 2: event_data["meta"]["custom_data"]["user_id"]
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
        
        # 경로 4: 재귀 탐색
        if not user_id:
            user_id = find_user_id_recursive(event_data)
            if user_id:
                extraction_paths.append("recursive_search")
        
        if not user_id:
            # 실패 시 payload 일부를 로그에 남기기
            payload_sample = json.dumps(event_data, indent=2)[:2000]  # 처음 2000자만
            logger.error(f"[WEBHOOK] order_created: user_id를 찾을 수 없습니다. order_id={order_id}")
            logger.error(f"[WEBHOOK] order_created: Tried paths: data.attributes.custom_data, meta.custom_data, first_order_item.custom_data, recursive_search")
            logger.error(f"[WEBHOOK] order_created: Payload sample:\n{payload_sample}")
            return False
        
        logger.info(f"[WEBHOOK] order_created: user_id found via {extraction_paths[0] if extraction_paths else 'unknown'}: user_id={user_id}")
        
        # variant_id 추출
        first_order_item = order_attributes.get('first_order_item', {})
        variant_id = str(first_order_item.get('variant_id', '')) if first_order_item else ''
        
        # variant_id가 없으면 Lemon Squeezy API로 주문 상세 조회
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
        
        # 결제 성공(유료) 확정
        is_paid = False
        
        # 방법 1: payload에서 status 확인
        order_status = order_attributes.get('status', '').lower()
        if order_status == 'paid':
            is_paid = True
            logger.info(f"[WEBHOOK] order_created: Order status is 'paid' from payload")
        else:
            # 방법 2: Lemon Squeezy API로 주문 상태 확인
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
    order_paid 이벤트 처리 (크레딧 충전)
    
    Args:
        db: 데이터베이스 세션
        event_data: 웹훅 이벤트 데이터
    
    Returns:
        처리 성공 여부
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
    웹훅 이벤트 처리 라우터
    
    Args:
        db: 데이터베이스 세션
        event_data: 웹훅 이벤트 데이터
    
    Returns:
        처리 성공 여부
    """
    event_name = event_data.get('meta', {}).get('event_name', '')
    
    logger.info(f"웹훅 이벤트 수신: {event_name}")
    
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
            logger.warning(f"처리되지 않은 이벤트: {event_name}")
            return True  # 알 수 없는 이벤트는 성공으로 처리 (200 OK 반환)
            
    except Exception as e:
        logger.error(f"웹훅 이벤트 처리 중 예상치 못한 오류: {e}")
        return False


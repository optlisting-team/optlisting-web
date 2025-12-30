"""
Lemon Squeezy Webhook Handler
안정성 원칙: 모든 에러는 로깅하고 200 OK 반환 (LS 재시도 방지)
"""
import os
import hmac
import hashlib
import json
import logging
from typing import Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from .models import Profile

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 환경 변수
LS_WEBHOOK_SECRET = os.getenv("LS_WEBHOOK_SECRET", "")

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
    프로필 조회 또는 생성 (안정성: 트랜잭션 처리)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
    
    Returns:
        Profile 객체
    """
    try:
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            # 프로필이 없으면 생성
            profile = Profile(
                user_id=user_id,
                subscription_status='inactive',
                subscription_plan='free',
                total_listings_limit=PLAN_LIMITS['free']
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
            logger.info(f"새 프로필 생성: user_id={user_id}")
        
        return profile
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"프로필 조회/생성 중 DB 오류: {e}")
        raise


def handle_subscription_created(db: Session, event_data: Dict) -> bool:
    """
    subscription_created 이벤트 처리
    
    Args:
        db: 데이터베이스 세션
        event_data: 웹훅 이벤트 데이터
    
    Returns:
        처리 성공 여부
    """
    try:
        # Lemon Squeezy 웹훅 데이터 구조에서 정보 추출
        subscription = event_data.get('data', {}).get('attributes', {})
        customer_id = subscription.get('customer_id')
        subscription_id = subscription.get('id') or event_data.get('data', {}).get('id')
        
        # user_id 추출 (custom_data 또는 meta에서)
        # LS에서는 보통 custom_data에 user_id를 포함시킵니다
        custom_data = subscription.get('custom_data', {})
        user_id = custom_data.get('user_id') or subscription.get('user_id')
        
        if not user_id:
            logger.error("subscription_created: user_id를 찾을 수 없습니다")
            return False
        
        # 프로필 조회 또는 생성
        profile = get_or_create_profile(db, user_id)
        
        # 구독 정보 업데이트
        profile.ls_customer_id = str(customer_id) if customer_id else profile.ls_customer_id
        profile.ls_subscription_id = str(subscription_id) if subscription_id else profile.ls_subscription_id
        profile.subscription_status = 'active'
        profile.subscription_plan = 'pro'  # $49.99 Pro 플랜
        profile.total_listings_limit = PLAN_LIMITS['pro']
        
        db.commit()
        logger.info(f"구독 생성 완료: user_id={user_id}, subscription_id={subscription_id}")
        return True
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"subscription_created 처리 중 DB 오류: {e}")
        return False
    except Exception as e:
        logger.error(f"subscription_created 처리 중 예상치 못한 오류: {e}")
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


def handle_order_created(db: Session, event_data: Dict) -> bool:
    """
    order_created 이벤트 처리 (크레딧 팩 구매)
    
    Args:
        db: 데이터베이스 세션
        event_data: 웹훅 이벤트 데이터
    
    Returns:
        처리 성공 여부
    """
    try:
        order = event_data.get('data', {}).get('attributes', {})
        order_id = event_data.get('data', {}).get('id')
        
        # user_id 추출 (custom_data에서)
        custom_data = order.get('custom_data', {}) or {}
        
        # custom_data가 문자열이면 JSON 파싱 시도
        if isinstance(custom_data, str):
            try:
                import json
                custom_data = json.loads(custom_data)
            except:
                custom_data = {}
        
        user_id = custom_data.get('user_id')
        
        if not user_id:
            # first_order_item에서 추출 시도
            first_order_item = order.get('first_order_item', {}) or {}
            user_id = first_order_item.get('custom_data', {}).get('user_id') if isinstance(first_order_item.get('custom_data'), dict) else None
        
        if not user_id:
            logger.error(f"order_created: user_id를 찾을 수 없습니다. order_id={order_id}")
            return False
        
        # 결제 금액에서 크레딧 수 계산 (cents → credits)
        total_cents = order.get('total', 0)  # 총 결제 금액 (cents)
        
        # Variant ID로 먼저 확인
        first_order_item = order.get('first_order_item', {}) or {}
        variant_id = str(first_order_item.get('variant_id', ''))
        
        credits_to_add = 0
        
        # 1. Variant ID 매핑 확인
        if variant_id and variant_id in VARIANT_CREDITS:
            credits_to_add = VARIANT_CREDITS[variant_id]
        # 2. 가격 기반 매핑 확인
        elif total_cents in CREDIT_PACKS:
            credits_to_add = CREDIT_PACKS[total_cents]
        # 3. 근사값으로 매핑 (오차 범위 ±50 cents)
        else:
            for price_cents, credits in CREDIT_PACKS.items():
                if abs(total_cents - price_cents) <= 50:
                    credits_to_add = credits
                    break
        
        if credits_to_add <= 0:
            logger.warning(f"order_created: 알 수 없는 크레딧 팩. order_id={order_id}, total={total_cents}")
            # 안전을 위해 기본값 설정 (최소 팩)
            credits_to_add = 300
        
        # 프로필 조회 또는 생성
        profile = get_or_create_profile(db, user_id)
        
        # 크레딧 추가
        profile.purchased_credits = (profile.purchased_credits or 0) + credits_to_add
        
        # LS 고객 ID 저장 (없는 경우)
        customer_id = order.get('customer_id')
        if customer_id and not profile.ls_customer_id:
            profile.ls_customer_id = str(customer_id)
        
        db.commit()
        
        logger.info(f"크레딧 팩 구매 완료: user_id={user_id}, credits={credits_to_add}, order_id={order_id}")
        return True
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"order_created 처리 중 DB 오류: {e}")
        return False
    except Exception as e:
        logger.error(f"order_created 처리 중 예상치 못한 오류: {e}")
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
        else:
            logger.warning(f"처리되지 않은 이벤트: {event_name}")
            return True  # 알 수 없는 이벤트는 성공으로 처리 (200 OK 반환)
            
    except Exception as e:
        logger.error(f"웹훅 이벤트 처리 중 예상치 못한 오류: {e}")
        return False


"""
eBay API 레이트리밋 관리 모듈.

두 가지 계층을 관리한다:
  1. 전역 일일 호출 총량 (앱 전체 공유, eBay가 App ID 단위로 매기는 한도)
     - Trading API: 기본 5,000콜/일
     - Analytics API (traffic_report): 기본 100콜/일
     한도의 90%에 도달하면 신규 호출을 선제적으로 차단한다 (eBay가 직접 차단하기 전에 우리가 먼저 멈춤).

  2. 스토어(user_id)별 429 백오프
     - 특정 스토어가 429를 받으면 그 스토어만 지수적으로 증가하는 쿨다운(30분→1h→2h→4h, 이후 4h 유지)이 걸린다.
     - 다른 스토어의 호출에는 영향을 주지 않는다.

  3. 스토어별 동기화 쿨다운
     - 풀싱크(Trading API)는 스토어당 24시간에 1회로 제한 (최초 연결 시 수동 1회는 예외)
     - 트래픽(Analytics API) 갱신은 하루 최대 400개 리스팅, 콜당 최대 200개 → 스토어당 하루 최대 2콜
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import EbayApiCallLog, EbayApiCallState, Listing

logger = logging.getLogger(__name__)

# ---- 전역 일일 한도 (eBay 기본값 기준; 확장 신청 승인되면 여기 값만 올리면 됨) ----
DAILY_LIMITS = {
    "trading": 5000,
    "analytics": 100,
}
SAFETY_MARGIN = 0.9  # 한도의 90% 도달 시 차단

# ---- 429 백오프 스케줄 (분 단위): backoff_level 1,2,3,4+ ----
BACKOFF_SCHEDULE_MINUTES = [30, 60, 120, 240]  # 4단계 이후는 240분(4시간) 유지

# ---- 스토어별 하루 트래픽 갱신 리스팅 수 ----
TRAFFIC_DAILY_LISTING_CAP = 400
TRAFFIC_ITEMS_PER_CALL = 200  # traffic_report 1콜당 최대 리스팅 수 (Trading API와 동일 가정 — 실측 필요)

# ---- 풀싱크 쿨다운 ----
FULL_SYNC_COOLDOWN_HOURS = 24


class RateLimitBlocked(Exception):
    """호출이 레이트리밋에 걸려 차단됐을 때 발생시키는 예외."""
    def __init__(self, reason: str, retry_after: Optional[datetime] = None):
        self.reason = reason
        self.retry_after = retry_after
        super().__init__(reason)


def check_global_budget(db: Session, api_type: str) -> None:
    """오늘(UTC 자정 기준) 누적 호출 수가 한도의 90%를 넘었으면 RateLimitBlocked를 발생시킨다.
    api_type: 'trading' | 'analytics'
    """
    limit = DAILY_LIMITS.get(api_type)
    if not limit:
        return  # 알 수 없는 타입은 체크 생략 (fail-open, 로직 실수로 전체 차단되는 것 방지)

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    used = db.query(func.count(EbayApiCallLog.id)).filter(
        EbayApiCallLog.api_type == api_type,
        EbayApiCallLog.called_at >= today_start,
    ).scalar() or 0

    threshold = int(limit * SAFETY_MARGIN)
    if used >= threshold:
        logger.warning(f"⛔ [RATE LIMIT] Global {api_type} budget exhausted: {used}/{limit} (threshold {threshold})")
        raise RateLimitBlocked(
            reason=f"Global {api_type} API daily budget reached ({used}/{limit}, safety margin {threshold}). Try again tomorrow.",
        )


def check_store_cooldown(db: Session, user_id: str) -> None:
    """이 스토어가 429 백오프 쿨다운 중이면 RateLimitBlocked를 발생시킨다."""
    state = db.query(EbayApiCallState).filter(EbayApiCallState.user_id == user_id).first()
    if state and state.cooldown_until and state.cooldown_until > datetime.utcnow():
        logger.warning(f"⛔ [RATE LIMIT] Store {user_id} in 429 cooldown until {state.cooldown_until}")
        raise RateLimitBlocked(
            reason=f"This store is temporarily rate-limited by eBay. Retry after {state.cooldown_until.isoformat()}.",
            retry_after=state.cooldown_until,
        )


def record_call(db: Session, user_id: str, api_type: str, endpoint: str, status_code: int) -> None:
    """호출 결과를 로그에 남기고, 429면 해당 스토어의 백오프를 escalate한다. 200이면 백오프를 리셋한다."""
    try:
        db.add(EbayApiCallLog(
            user_id=user_id,
            api_type=api_type,
            endpoint=endpoint,
            status_code=status_code,
            called_at=datetime.utcnow(),
        ))

        state = db.query(EbayApiCallState).filter(EbayApiCallState.user_id == user_id).first()
        if not state:
            state = EbayApiCallState(user_id=user_id, backoff_level=0)
            db.add(state)

        if status_code == 429:
            state.backoff_level = (state.backoff_level or 0) + 1
            idx = min(state.backoff_level - 1, len(BACKOFF_SCHEDULE_MINUTES) - 1)
            cooldown_minutes = BACKOFF_SCHEDULE_MINUTES[idx]
            state.cooldown_until = datetime.utcnow() + timedelta(minutes=cooldown_minutes)
            logger.warning(f"⚠️ [429] Store {user_id} backoff_level={state.backoff_level}, cooldown {cooldown_minutes}min until {state.cooldown_until}")
        elif status_code == 200:
            # Successful call: reset backoff so a past 429 doesn't linger forever once eBay recovers
            if state.backoff_level:
                logger.info(f"✅ [RECOVERY] Store {user_id} backoff reset after successful call")
            state.backoff_level = 0
            state.cooldown_until = None

        state.updated_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        logger.error(f"❌ [RATE LIMIT] Failed to record call: {e}")
        db.rollback()


def check_full_sync_cooldown(db: Session, user_id: str) -> None:
    """스토어당 24시간에 1회 풀싱크 제한. 최초 연결(아직 한 번도 싱크 안 함)은 예외로 통과."""
    state = db.query(EbayApiCallState).filter(EbayApiCallState.user_id == user_id).first()
    if not state or not state.last_full_sync_at:
        return  # 최초 연결: 통과

    elapsed = datetime.utcnow() - state.last_full_sync_at
    cooldown = timedelta(hours=FULL_SYNC_COOLDOWN_HOURS)
    if elapsed < cooldown:
        retry_after = state.last_full_sync_at + cooldown
        logger.info(f"⏳ [SYNC COOLDOWN] Store {user_id} synced {elapsed} ago, next allowed at {retry_after}")
        raise RateLimitBlocked(
            reason=f"Full sync is limited to once per {FULL_SYNC_COOLDOWN_HOURS}h per store. Next sync available at {retry_after.isoformat()}.",
            retry_after=retry_after,
        )


def mark_full_sync_complete(db: Session, user_id: str) -> None:
    """풀싱크 완료 시각 기록 (24시간 쿨다운 기준점)."""
    try:
        state = db.query(EbayApiCallState).filter(EbayApiCallState.user_id == user_id).first()
        if not state:
            state = EbayApiCallState(user_id=user_id)
            db.add(state)
        state.last_full_sync_at = datetime.utcnow()
        state.updated_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        logger.error(f"❌ [RATE LIMIT] Failed to mark full sync complete: {e}")
        db.rollback()


def mark_traffic_sync_complete(db: Session, user_id: str) -> None:
    """트래픽(Analytics) 갱신 완료 시각 기록."""
    try:
        state = db.query(EbayApiCallState).filter(EbayApiCallState.user_id == user_id).first()
        if not state:
            state = EbayApiCallState(user_id=user_id)
            db.add(state)
        state.last_traffic_sync_at = datetime.utcnow()
        state.updated_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        logger.error(f"❌ [RATE LIMIT] Failed to mark traffic sync complete: {e}")
        db.rollback()


def select_listings_for_traffic_refresh(db: Session, user_id: str, limit: int = TRAFFIC_DAILY_LISTING_CAP):
    """오늘 트래픽을 갱신할 리스팅 최대 `limit`개를 고른다 — 가장 오래 갱신 안 된 것부터 (회전식),
    한 번도 갱신 안 된 것(NULL)을 최우선으로.
    """
    return (
        db.query(Listing)
        .filter(Listing.user_id == user_id, Listing.platform.ilike("ebay"))
        .order_by(Listing.last_traffic_synced_at.asc().nullsfirst())
        .limit(limit)
        .all()
    )

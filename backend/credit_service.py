"""
OptListing Credit Service
=========================
3-Way Hybrid Pricing을 위한 크레딧 관리 서비스

주요 기능:
- 원자적(Atomic) 크레딧 차감 (동시성 안전)
- 크레딧 잔액 조회
- 크레딧 충전 (결제 연동용)
- FastAPI 의존성 주입 지원
"""

import uuid
from datetime import datetime
from typing import Optional, Tuple, Dict, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, Depends, status

from .models import Profile, get_db


# =============================================
# 상수 및 설정
# =============================================

class PlanType(str, Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class TransactionType(str, Enum):
    PURCHASE = "purchase"
    CONSUME = "consume"
    REFUND = "refund"
    BONUS = "bonus"


# 플랜별 기본 크레딧 (가입 시 부여)
PLAN_DEFAULT_CREDITS = {
    PlanType.FREE: 100,
    PlanType.STARTER: 500,
    PlanType.PRO: 2000,
    PlanType.ENTERPRISE: 10000,
}

# 무료티어 설정
FREE_TIER_MAX_COUNT = 3  # 최대 무료 사용 횟수


# =============================================
# 응답 데이터 클래스
# =============================================

@dataclass
class CreditCheckResult:
    """크레딧 검사 결과"""
    success: bool
    available_credits: int
    requested_credits: int
    message: str


@dataclass
class CreditDeductResult:
    """크레딧 차감 결과"""
    success: bool
    remaining_credits: int
    deducted_amount: int
    message: str
    transaction_id: Optional[str] = None


@dataclass
class CreditAddResult:
    """크레딧 추가 결과"""
    success: bool
    total_credits: int
    added_amount: int
    message: str
    transaction_id: Optional[str] = None


# =============================================
# 핵심 크레딧 함수
# =============================================

def get_available_credits(db: Session, user_id: str) -> int:
    """
    사용자의 잔여 크레딧 조회
    
    Returns:
        int: 잔여 크레딧 (purchased_credits - consumed_credits)
    """
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    
    if not profile:
        return 0
    
    return max(0, profile.purchased_credits - profile.consumed_credits)


def check_credits(
    db: Session, 
    user_id: str, 
    required_credits: int
) -> CreditCheckResult:
    """
    크레딧 충분 여부 검사 (차감 없음)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        required_credits: 필요한 크레딧 수
        
    Returns:
        CreditCheckResult: 검사 결과
    """
    available = get_available_credits(db, user_id)
    
    if available >= required_credits:
        return CreditCheckResult(
            success=True,
            available_credits=available,
            requested_credits=required_credits,
            message="Sufficient credits available"
        )
    else:
        return CreditCheckResult(
            success=False,
            available_credits=available,
            requested_credits=required_credits,
            message=f"Insufficient credits: available={available}, required={required_credits}"
        )


def deduct_credits_atomic(
    db: Session,
    user_id: str,
    amount: int,
    description: Optional[str] = None,
    reference_id: Optional[str] = None
) -> CreditDeductResult:
    """
    원자적 크레딧 차감 (동시성 안전)
    
    무료티어가 남아있으면 크레딧 차감 없이 진행하고 무료티어 카운트 증가
    무료티어가 모두 사용되면 일반 크레딧 차감 로직 사용
    
    PostgreSQL의 원자적 UPDATE를 사용하여 Race Condition 방지
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        amount: 차감할 크레딧 수
        description: 트랜잭션 설명
        reference_id: 참조 ID (분석 작업 ID 등)
        
    Returns:
        CreditDeductResult: 차감 결과 (무료티어 사용 시 deducted_amount=0)
    """
    if amount <= 0:
        return CreditDeductResult(
            success=False,
            remaining_credits=get_available_credits(db, user_id),
            deducted_amount=0,
            message="Amount must be positive"
        )
    
    try:
        # 무료티어 확인 및 사용 (원자적 UPDATE)
        # free_tier_count < FREE_TIER_MAX_COUNT인 경우 증가
        free_tier_result = db.execute(
            text("""
                UPDATE profiles
                SET free_tier_count = free_tier_count + 1,
                    updated_at = NOW()
                WHERE user_id = :user_id
                  AND free_tier_count < :max_free_tier
                RETURNING 
                    free_tier_count,
                    purchased_credits,
                    consumed_credits,
                    (purchased_credits - consumed_credits) as remaining
            """),
            {"user_id": user_id, "max_free_tier": FREE_TIER_MAX_COUNT}
        )
        
        free_tier_row = free_tier_result.fetchone()
        
        if free_tier_row is not None:
            # 무료티어 사용 성공 - 크레딧 차감 없이 진행
            remaining_credits = free_tier_row.remaining
            free_tier_used = free_tier_row.free_tier_count
            
            # 트랜잭션 이력 기록 (무료티어 사용으로 기록)
            try:
                db.execute(
                    text("""
                        INSERT INTO credit_transactions 
                        (user_id, transaction_type, amount, balance_after, description, reference_id)
                        VALUES (:user_id, 'consume', :amount, :balance, :description, :reference_id)
                    """),
                    {
                        "user_id": user_id,
                        "amount": 0,  # 무료티어는 0 크레딧
                        "balance": remaining_credits,
                        "description": description or f"Free tier usage ({free_tier_used}/{FREE_TIER_MAX_COUNT})",
                        "reference_id": reference_id or str(uuid.uuid4())
                    }
                )
            except SQLAlchemyError:
                pass
            
            db.commit()
            
            return CreditDeductResult(
                success=True,
                remaining_credits=remaining_credits,
                deducted_amount=0,  # 무료티어는 차감 없음
                message=f"Free tier used ({free_tier_used}/{FREE_TIER_MAX_COUNT})",
                transaction_id=str(uuid.uuid4())
            )
        
        # 무료티어가 모두 사용됨 - 일반 크레딧 차감 로직 진행
        # ✅ 원자적 UPDATE (동시성 안전)
        # WHERE 절에서 잔액 검사를 함께 수행하여 Race Condition 방지
        result = db.execute(
            text("""
                UPDATE profiles
                SET consumed_credits = consumed_credits + :amount,
                    updated_at = NOW()
                WHERE user_id = :user_id
                  AND (purchased_credits - consumed_credits) >= :amount
                RETURNING 
                    purchased_credits, 
                    consumed_credits,
                    (purchased_credits - consumed_credits) as remaining
            """),
            {"user_id": user_id, "amount": amount}
        )
        
        row = result.fetchone()
        
        if row is None:
            # 업데이트 실패 - 잔액 부족 또는 사용자 없음
            available = get_available_credits(db, user_id)
            
            if available == 0:
                # 사용자가 없거나 크레딧이 0
                profile = db.query(Profile).filter(Profile.user_id == user_id).first()
                if not profile:
                    return CreditDeductResult(
                        success=False,
                        remaining_credits=0,
                        deducted_amount=0,
                        message="User not found"
                    )
            
            return CreditDeductResult(
                success=False,
                remaining_credits=available,
                deducted_amount=0,
                message=f"Insufficient credits: available={available}, requested={amount}"
            )
        
        remaining_credits = row.remaining
        
        # 트랜잭션 이력 기록 (credit_transactions 테이블이 있는 경우)
        transaction_id = str(uuid.uuid4())
        try:
            db.execute(
                text("""
                    INSERT INTO credit_transactions 
                    (user_id, transaction_type, amount, balance_after, description, reference_id)
                    VALUES (:user_id, 'consume', :amount, :balance, :description, :reference_id)
                """),
                {
                    "user_id": user_id,
                    "amount": -amount,  # 차감은 음수
                    "balance": remaining_credits,
                    "description": description or f"Deducted {amount} credits",
                    "reference_id": reference_id or transaction_id
                }
            )
        except SQLAlchemyError:
            # credit_transactions 테이블이 없으면 무시
            pass
        
        db.commit()
        
        return CreditDeductResult(
            success=True,
            remaining_credits=remaining_credits,
            deducted_amount=amount,
            message="Credits deducted successfully",
            transaction_id=transaction_id
        )
        
    except SQLAlchemyError as e:
        db.rollback()
        return CreditDeductResult(
            success=False,
            remaining_credits=get_available_credits(db, user_id),
            deducted_amount=0,
            message=f"Database error: {str(e)}"
        )


def add_credits(
    db: Session,
    user_id: str,
    amount: int,
    transaction_type: TransactionType = TransactionType.PURCHASE,
    description: Optional[str] = None,
    reference_id: Optional[str] = None
) -> CreditAddResult:
    """
    크레딧 추가 (구매, 보너스, 환불 등)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        amount: 추가할 크레딧 수
        transaction_type: 트랜잭션 유형
        description: 트랜잭션 설명
        reference_id: 참조 ID (결제 ID 등)
        
    Returns:
        CreditAddResult: 추가 결과
    """
    if amount <= 0:
        return CreditAddResult(
            success=False,
            total_credits=get_available_credits(db, user_id),
            added_amount=0,
            message="Amount must be positive"
        )
    
    try:
        # 원자적 UPDATE
        result = db.execute(
            text("""
                UPDATE profiles
                SET purchased_credits = purchased_credits + :amount,
                    updated_at = NOW()
                WHERE user_id = :user_id
                RETURNING 
                    purchased_credits,
                    consumed_credits,
                    (purchased_credits - consumed_credits) as remaining
            """),
            {"user_id": user_id, "amount": amount}
        )
        
        row = result.fetchone()
        
        if row is None:
            return CreditAddResult(
                success=False,
                total_credits=0,
                added_amount=0,
                message="User not found"
            )
        
        total_credits = row.remaining
        transaction_id = str(uuid.uuid4())
        
        # 트랜잭션 이력 기록
        try:
            db.execute(
                text("""
                    INSERT INTO credit_transactions 
                    (user_id, transaction_type, amount, balance_after, description, reference_id)
                    VALUES (:user_id, :type, :amount, :balance, :description, :reference_id)
                """),
                {
                    "user_id": user_id,
                    "type": transaction_type.value,
                    "amount": amount,  # 추가는 양수
                    "balance": total_credits,
                    "description": description or f"Added {amount} credits ({transaction_type.value})",
                    "reference_id": reference_id or transaction_id
                }
            )
        except SQLAlchemyError:
            pass
        
        db.commit()
        
        return CreditAddResult(
            success=True,
            total_credits=total_credits,
            added_amount=amount,
            message="Credits added successfully",
            transaction_id=transaction_id
        )
        
    except SQLAlchemyError as e:
        db.rollback()
        return CreditAddResult(
            success=False,
            total_credits=get_available_credits(db, user_id),
            added_amount=0,
            message=f"Database error: {str(e)}"
        )


def initialize_user_credits(
    db: Session,
    user_id: str,
    plan: PlanType = PlanType.FREE
) -> CreditAddResult:
    """
    신규 사용자 크레딧 초기화
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        plan: 플랜 유형
        
    Returns:
        CreditAddResult: 초기화 결과
    """
    default_credits = PLAN_DEFAULT_CREDITS.get(plan, 100)
    
    # 프로필 생성 또는 업데이트
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    
    if not profile:
        # 새 프로필 생성
        profile = Profile(
            user_id=user_id,
            purchased_credits=default_credits,
            consumed_credits=0,
            current_plan=plan.value
        )
        db.add(profile)
        db.commit()
        
        return CreditAddResult(
            success=True,
            total_credits=default_credits,
            added_amount=default_credits,
            message=f"User initialized with {default_credits} credits ({plan.value} plan)"
        )
    else:
        # 기존 프로필 - 크레딧이 0인 경우에만 초기화
        if profile.purchased_credits == 0:
            return add_credits(
                db, user_id, default_credits,
                TransactionType.BONUS,
                f"Welcome bonus for {plan.value} plan"
            )
        
        return CreditAddResult(
            success=True,
            total_credits=profile.purchased_credits - profile.consumed_credits,
            added_amount=0,
            message="User already has credits"
        )


# =============================================
# FastAPI 의존성 주입
# =============================================

class CreditChecker:
    """
    FastAPI 의존성 - 크레딧 검사 및 차감
    
    사용 예시:
        @app.post("/api/analysis/start")
        async def start_analysis(
            request: AnalysisRequest,
            credit_check: CreditDeductResult = Depends(CreditChecker(auto_deduct=True))
        ):
            # credit_check.success가 False면 이미 HTTPException 발생
            ...
    """
    
    def __init__(
        self, 
        auto_deduct: bool = False,
        credits_per_listing: int = 1
    ):
        """
        Args:
            auto_deduct: True면 검사 성공 시 자동 차감
            credits_per_listing: 리스팅당 필요 크레딧 수
        """
        self.auto_deduct = auto_deduct
        self.credits_per_listing = credits_per_listing
    
    async def __call__(
        self,
        user_id: str,
        listing_count: int,
        db: Session = Depends(get_db)
    ) -> CreditCheckResult | CreditDeductResult:
        """
        크레딧 검사 (및 선택적 차감)
        
        Args:
            user_id: 사용자 ID (요청 헤더 또는 토큰에서 추출)
            listing_count: 분석할 리스팅 수
            db: DB 세션
            
        Raises:
            HTTPException: 크레딧 부족 시 402 Payment Required
        """
        required_credits = listing_count * self.credits_per_listing
        
        if self.auto_deduct:
            # 검사 + 차감 동시 수행
            result = deduct_credits_atomic(
                db, user_id, required_credits,
                description=f"Analysis of {listing_count} listings"
            )
            
            if not result.success:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail={
                        "error": "insufficient_credits",
                        "message": result.message,
                        "available_credits": result.remaining_credits,
                        "required_credits": required_credits
                    }
                )
            
            return result
        else:
            # 검사만 수행
            result = check_credits(db, user_id, required_credits)
            
            if not result.success:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail={
                        "error": "insufficient_credits",
                        "message": result.message,
                        "available_credits": result.available_credits,
                        "required_credits": required_credits
                    }
                )
            
            return result


def require_credits(amount: int):
    """
    고정 크레딧 요구 데코레이터 스타일 의존성
    
    사용 예시:
        @app.post("/api/some-feature")
        async def some_feature(
            credits: CreditDeductResult = Depends(require_credits(10))
        ):
            ...
    """
    async def dependency(
        user_id: str,
        db: Session = Depends(get_db)
    ) -> CreditDeductResult:
        result = deduct_credits_atomic(db, user_id, amount)
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "error": "insufficient_credits",
                    "message": result.message,
                    "available_credits": result.remaining_credits,
                    "required_credits": amount
                }
            )
        
        return result
    
    return dependency


# =============================================
# 유틸리티 함수
# =============================================

def get_credit_summary(db: Session, user_id: str) -> Dict[str, Any]:
    """
    사용자 크레딧 요약 정보
    
    Returns:
        dict: 크레딧 요약 정보
    """
    try:
        # Use raw SQL to safely check if column exists and get data
        from sqlalchemy import inspect
        from sqlalchemy import text
        from .models import engine
        
        # Check if free_tier_count column exists
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('profiles')]
        has_free_tier_column = 'free_tier_count' in columns
        
        if has_free_tier_column:
            # Column exists, use normal query
            profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        else:
            # Column doesn't exist, use raw SQL to get other columns
            result = db.execute(
                text("""
                    SELECT user_id, purchased_credits, consumed_credits, current_plan
                    FROM profiles
                    WHERE user_id = :user_id
                    LIMIT 1
                """),
                {"user_id": user_id}
            ).first()
            
            if not result:
                profile = None
            else:
                # Create a simple object-like structure
                class SimpleProfile:
                    def __init__(self, user_id, purchased_credits, consumed_credits, current_plan):
                        self.user_id = user_id
                        self.purchased_credits = purchased_credits
                        self.consumed_credits = consumed_credits
                        self.current_plan = current_plan
                
                profile = SimpleProfile(
                    result[0], result[1], result[2], result[3] if result[3] else 'free'
                )
        
        if not profile:
            return {
                "user_id": user_id,
                "purchased_credits": 0,
                "consumed_credits": 0,
                "available_credits": 0,
                "current_plan": "free",
                "free_tier_count": 0,
                "free_tier_remaining": FREE_TIER_MAX_COUNT,
                "exists": False
            }
        
        # Get free_tier_count safely
        if has_free_tier_column:
            try:
                free_tier_count = getattr(profile, 'free_tier_count', 0) or 0
            except (AttributeError, KeyError):
                free_tier_count = 0
        else:
            free_tier_count = 0
        
        free_tier_remaining = max(0, FREE_TIER_MAX_COUNT - free_tier_count)
        
        return {
            "user_id": user_id,
            "purchased_credits": profile.purchased_credits,
            "consumed_credits": profile.consumed_credits,
            "available_credits": profile.purchased_credits - profile.consumed_credits,
            "current_plan": profile.current_plan or "free",
            "free_tier_count": free_tier_count,
            "free_tier_remaining": free_tier_remaining,
            "exists": True
        }
    except Exception as e:
        # Fallback: return default values if anything fails
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in get_credit_summary: {str(e)}")
        logger.exception(e)
        
        return {
            "user_id": user_id,
            "purchased_credits": 0,
            "consumed_credits": 0,
            "available_credits": 0,
            "current_plan": "free",
            "free_tier_count": 0,
            "free_tier_remaining": FREE_TIER_MAX_COUNT,
            "exists": False
        }


def refund_credits(
    db: Session,
    user_id: str,
    amount: int,
    reason: str,
    reference_id: Optional[str] = None
) -> CreditAddResult:
    """
    크레딧 환불 (분석 실패 시 등)
    
    consumed_credits를 감소시키는 대신 purchased_credits를 증가시킴
    (이력 추적을 위해)
    """
    return add_credits(
        db, user_id, amount,
        TransactionType.REFUND,
        description=f"Refund: {reason}",
        reference_id=reference_id
    )


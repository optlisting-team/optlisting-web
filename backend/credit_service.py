"""
OptListing Credit Service - 3-Way Hybrid Pricing.
Features: atomic credit deduct (concurrency-safe), balance query, top-up (payment), FastAPI Depends.
"""

import uuid
import logging
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
# Constants and config
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


# Default credits per plan (granted on signup)
PLAN_DEFAULT_CREDITS = {
    PlanType.FREE: 100,
    PlanType.STARTER: 500,
    PlanType.PRO: 2000,
    PlanType.ENTERPRISE: 10000,
}

# Free tier config
FREE_TIER_MAX_COUNT = 3  # Max free uses


# =============================================
# Response dataclasses
# =============================================

@dataclass
class CreditCheckResult:
    """Credit check result"""
    success: bool
    available_credits: int
    requested_credits: int
    message: str


@dataclass
class CreditDeductResult:
    """Credit deduct result"""
    success: bool
    remaining_credits: int
    deducted_amount: int
    message: str
    transaction_id: Optional[str] = None


@dataclass
class CreditAddResult:
    """Credit add result"""
    success: bool
    total_credits: int
    added_amount: int
    message: str
    transaction_id: Optional[str] = None


# =============================================
# Core credit functions
# =============================================

def get_available_credits(db: Session, user_id: str) -> int:
    """
    Get user's remaining credits.
    
    Returns:
        int: Remaining credits (purchased_credits - consumed_credits)
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
    Check if user has enough credits (no deduct).
    Args: db, user_id, required_credits. Returns: CreditCheckResult.
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
    Atomic credit deduction (concurrency-safe).
    If free tier remains, no deduction and free tier count increases; else normal deduct.
    Uses PostgreSQL atomic UPDATE to prevent race condition.
    Args: db, user_id, amount, description, reference_id.
    Returns: CreditDeductResult (deducted_amount=0 when free tier used).
    """
    if amount <= 0:
        return CreditDeductResult(
            success=False,
            remaining_credits=get_available_credits(db, user_id),
            deducted_amount=0,
            message="Amount must be positive"
        )
    
    try:
        # Check and use free tier (atomic UPDATE)
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
            # Free tier used successfully - no credit deduction
            remaining_credits = free_tier_row.remaining
            free_tier_used = free_tier_row.free_tier_count
            
            # Log transaction (free tier)
            try:
                db.execute(
                    text("""
                        INSERT INTO credit_transactions 
                        (user_id, transaction_type, amount, balance_after, description, reference_id)
                        VALUES (:user_id, 'consume', :amount, :balance, :description, :reference_id)
                    """),
                    {
                        "user_id": user_id,
                        "amount": 0,  # Free tier = 0 credits
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
                deducted_amount=0,  # Free tier = no deduct
                message=f"Free tier used ({free_tier_used}/{FREE_TIER_MAX_COUNT})",
                transaction_id=str(uuid.uuid4())
            )
        
        # Free tier exhausted - proceed with normal credit deduct
        # Atomic UPDATE (concurrency-safe); WHERE checks balance to prevent race
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
            # Update failed - insufficient balance
            available = get_available_credits(db, user_id)
            
            return CreditDeductResult(
                success=False,
                remaining_credits=available,
                deducted_amount=0,
                message=f"Insufficient credits: available={available}, requested={amount}"
            )
        
        remaining_credits = row.remaining
        
        # Log transaction (if credit_transactions table exists)
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
                    "amount": -amount,  # Deduct = negative
                    "balance": remaining_credits,
                    "description": description or f"Deducted {amount} credits",
                    "reference_id": reference_id or transaction_id
                }
            )
            except SQLAlchemyError:
                # Ignore if credit_transactions table does not exist
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
    Add credits (purchase, bonus, refund, etc). Creates Profile if missing (idempotent).
    Args: db, user_id, amount, transaction_type, description, reference_id.
    Returns: CreditAddResult.
    """
    if amount <= 0:
        return CreditAddResult(
            success=False,
            total_credits=get_available_credits(db, user_id),
            added_amount=0,
            message="Amount must be positive"
        )
    
    logger = logging.getLogger(__name__)
    logger.info(f"[add_credits] START: user_id={user_id}, amount={amount}, transaction_type={transaction_type.value}, reference_id={reference_id}")
    
    try:
        # Check profile exists; create if not (idempotent)
        logger.info(f"[add_credits] Querying profile for user_id={user_id}")
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            logger.info(f"[add_credits] Profile not found, creating new profile for user_id={user_id}")
            # Auto-create profile if not present
            try:
                logger.info(f"[add_credits] Creating Profile object for user_id={user_id}")
                profile = Profile(
                    user_id=user_id,
                    purchased_credits=0,
                    consumed_credits=0,
                    current_plan='free',
                    subscription_status='inactive',
                    subscription_plan='free',
                    total_listings_limit=100
                )
                logger.info(f"[add_credits] Adding profile to session for user_id={user_id}")
                db.add(profile)
                logger.info(f"[add_credits] Committing profile creation for user_id={user_id}")
                db.commit()
                logger.info(f"[add_credits] Refreshing profile for user_id={user_id}")
                db.refresh(profile)
                logger.info(f"[add_credits] ✅ Auto-created profile for user_id={user_id}, profile_id={profile.id}")
            except SQLAlchemyError as e:
                db.rollback()
                logger.error(f"[add_credits] ❌ Profile creation failed: user_id={user_id}, error={str(e)}", exc_info=True)
                logger.error(f"[add_credits] Error type: {type(e).__name__}, Error details: {repr(e)}")
                # Race: another process may have created; retry query
                logger.info(f"[add_credits] Retrying query after rollback for user_id={user_id}")
                profile = db.query(Profile).filter(Profile.user_id == user_id).first()
                if not profile:
                    logger.error(f"[add_credits] ❌ Profile creation and retry both failed: user_id={user_id}")
                    return CreditAddResult(
                        success=False,
                        total_credits=0,
                        added_amount=0,
                        message=f"Failed to create profile: {str(e)}"
                    )
                else:
                    logger.info(f"[add_credits] ✅ Profile found after retry: user_id={user_id}, profile_id={profile.id}")
        else:
            logger.info(f"[add_credits] ✅ Profile found: user_id={user_id}, profile_id={profile.id}, purchased_credits={profile.purchased_credits}, consumed_credits={profile.consumed_credits}")
        
        # Atomic UPDATE
        logger.info(f"[add_credits] Executing UPDATE query: user_id={user_id}, amount={amount}")
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
        logger.info(f"[add_credits] UPDATE query executed, row={row}")
        
        if row is None:
            logger.error(f"[add_credits] ❌ UPDATE returned no rows: user_id={user_id}, amount={amount}")
            # Should not happen; handle for safety
            return CreditAddResult(
                success=False,
                total_credits=get_available_credits(db, user_id),
                added_amount=0,
                message="Failed to update credits"
            )
        
        total_credits = row.remaining
        logger.info(f"[add_credits] ✅ UPDATE successful: user_id={user_id}, new_total_credits={total_credits}")
        transaction_id = str(uuid.uuid4())
        
        # Log transaction
        try:
            logger.info(f"[add_credits] Inserting credit_transaction: user_id={user_id}, amount={amount}, reference_id={reference_id}")
            db.execute(
                text("""
                    INSERT INTO credit_transactions 
                    (user_id, transaction_type, amount, balance_after, description, reference_id)
                    VALUES (:user_id, :type, :amount, :balance, :description, :reference_id)
                """),
                {
                    "user_id": user_id,
                    "type": transaction_type.value,
                    "amount": amount,  # Add = positive
                    "balance": total_credits,
                    "description": description or f"Added {amount} credits ({transaction_type.value})",
                    "reference_id": reference_id or transaction_id
                }
            )
            logger.info(f"[add_credits] ✅ credit_transaction inserted successfully: user_id={user_id}, reference_id={reference_id}")
        except SQLAlchemyError as e:
            logger.error(f"[add_credits] ❌ Failed to insert credit_transaction: user_id={user_id}, error={str(e)}", exc_info=True)
            logger.error(f"[add_credits] Error type: {type(e).__name__}, Error details: {repr(e)}")
            # Ignore if credit_transactions table does not exist (log only)
        
        logger.info(f"[add_credits] Committing transaction for user_id={user_id}")
        db.commit()
        logger.info(f"[add_credits] ✅ Transaction committed successfully: user_id={user_id}, total_credits={total_credits}")
        
        result = CreditAddResult(
            success=True,
            total_credits=total_credits,
            added_amount=amount,
            message="Credits added successfully",
            transaction_id=transaction_id
        )
        logger.info(f"[add_credits] END SUCCESS: user_id={user_id}, total_credits={total_credits}, added_amount={amount}")
        return result
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"[add_credits] ❌ SQLAlchemyError: user_id={user_id}, error={str(e)}", exc_info=True)
        logger.error(f"[add_credits] Error type: {type(e).__name__}, Error details: {repr(e)}")
        return CreditAddResult(
            success=False,
            total_credits=get_available_credits(db, user_id),
            added_amount=0,
            message=f"Database error: {str(e)}"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"[add_credits] ❌ Unexpected error: user_id={user_id}, error={str(e)}", exc_info=True)
        logger.error(f"[add_credits] Error type: {type(e).__name__}, Error details: {repr(e)}")
        return CreditAddResult(
            success=False,
            total_credits=get_available_credits(db, user_id),
            added_amount=0,
            message=f"Unexpected error: {str(e)}"
        )


def initialize_user_credits(
    db: Session,
    user_id: str,
    plan: PlanType = PlanType.FREE
) -> CreditAddResult:
    """
    Initialize credits for new user. Args: db, user_id, plan. Returns: CreditAddResult.
    """
    default_credits = PLAN_DEFAULT_CREDITS.get(plan, 100)
    
    # Create or get profile
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    
    if not profile:
        # Create new profile
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
        # Existing profile - init only if credits 0
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
# FastAPI dependency injection
# =============================================

class CreditChecker:
    """
    FastAPI dependency - credit check and deduct.
    
    Example:
        @app.post("/api/analysis/start")
        async def start_analysis(
            request: AnalysisRequest,
            credit_check: CreditDeductResult = Depends(CreditChecker(auto_deduct=True))
        ):
            # HTTPException already raised if credit_check.success is False
            ...
    """
    
    def __init__(
        self, 
        auto_deduct: bool = False,
        credits_per_listing: int = 1
    ):
        """
        Args:
            auto_deduct: If True, auto-deduct on check success
            credits_per_listing: Credits required per listing
        """
        self.auto_deduct = auto_deduct
        self.credits_per_listing = credits_per_listing
    
    async def __call__(
        self,
        user_id: str,
        listing_count: int,
        db: Session = Depends(get_db)
    ) -> CreditCheckResult | CreditDeductResult:
        """Credit check (and optional deduct). Raises 402 if insufficient."""
        required_credits = listing_count * self.credits_per_listing
        
        if self.auto_deduct:
            # Check + deduct
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
            # Check only
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
    """Fixed-amount credit dependency. Use: Depends(require_credits(10))."""
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
# Utilities
# =============================================

def get_credit_summary(db: Session, user_id: str) -> Dict[str, Any]:
    """Get user credit summary. Returns dict."""
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
            # Refresh profile to ensure real-time data accuracy before calculating available_credits
            if profile:
                db.refresh(profile)
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
    Refund credits (e.g. on analysis failure).
    Increases purchased_credits instead of decreasing consumed_credits (for audit).
    """
    return add_credits(
        db, user_id, amount,
        TransactionType.REFUND,
        description=f"Refund: {reason}",
        reference_id=reference_id
    )


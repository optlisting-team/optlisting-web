"""
OptListing Subscription Service
===============================
Premium subscription validation service for $120/month Professional Plan

Core Philosophy: High-Profit Price Policy - Premium service for professional sellers
"""

import logging
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status

from .models import Profile

logger = logging.getLogger(__name__)


def get_subscription_status(db: Session, user_id: str) -> Dict[str, Any]:
    """
    Get user subscription status
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        {
            "status": "active" | "inactive" | "cancelled" | "expired",
            "plan": "professional" | "free",
            "subscription_id": str | None,
            "expires_at": str | None
        }
    """
    try:
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            return {
                "status": "inactive",
                "plan": "free",
                "subscription_id": None,
                "expires_at": None
            }
        
        # Check subscription status
        subscription_status = profile.subscription_status or 'inactive'
        subscription_plan = profile.subscription_plan or 'free'
        
        # Professional plan is $120/month
        is_professional = (
            subscription_status == 'active' and 
            subscription_plan.lower() in ['professional', 'pro', 'premium']
        )
        
        return {
            "status": subscription_status,
            "plan": "professional" if is_professional else "free",
            "subscription_id": profile.ls_subscription_id,
            "expires_at": profile.ebay_token_expires_at.isoformat() if profile.ebay_token_expires_at else None
        }
    except Exception as e:
        logger.error(f"Error fetching subscription status: {e}")
        return {
            "status": "inactive",
            "plan": "free",
            "subscription_id": None,
            "expires_at": None
        }


def validate_active_subscription(db: Session, user_id: str) -> Tuple[bool, str]:
    """
    Validate that user has active Professional subscription
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        (is_valid: bool, error_message: str)
    """
    try:
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            return False, "User profile not found. Please complete account setup."
        
        subscription_status = profile.subscription_status or 'inactive'
        subscription_plan = profile.subscription_plan or 'free'
        
        # Check if Professional plan is active
        is_active = (
            subscription_status == 'active' and 
            subscription_plan.lower() in ['professional', 'pro', 'premium']
        )
        
        if not is_active:
            return False, (
                "Active Professional subscription required. "
                "Please subscribe to the $120/month Professional Plan to access this feature."
            )
        
        return True, ""
    except Exception as e:
        logger.error(f"Error validating subscription: {e}")
        return False, f"Subscription validation failed: {str(e)}"


def require_active_subscription(db: Session, user_id: str) -> None:
    """
    Require active subscription or raise HTTPException
    
    Args:
        db: Database session
        user_id: User ID
        
    Raises:
        HTTPException: If subscription is not active
    """
    is_valid, error_message = validate_active_subscription(db, user_id)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "subscription_required",
                "message": error_message,
                "subscription_url": "/pricing"
            }
        )

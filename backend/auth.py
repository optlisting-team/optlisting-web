"""
Auth common module. Centralized JWT token verification.
"""
import os
import logging
from starlette.requests import Request
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Supabase Auth for JWT verification
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.warning("⚠️ Supabase client not available. Install with: pip install supabase")


def get_current_user(request: Request) -> str:
    """
    FastAPI dependency: verify JWT and return user_id.
    Extracts token from Authorization: Bearer <JWT> and verifies via Supabase Auth.
    Returns: authenticated user_id (UUID).
    Raises: HTTPException 401 if token missing or invalid.
    """
    # Check Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        logger.warning("❌ [AUTH] Authorization header missing")
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing. Please provide a valid JWT token."
        )
    
    # Extract Bearer token
    try:
        scheme, token = auth_header.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid authorization scheme")
    except ValueError:
        logger.warning("❌ [AUTH] Invalid authorization header format")
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format. Expected: Bearer <token>"
        )
    
    # Create Supabase client and verify token
    if not SUPABASE_AVAILABLE:
        logger.error("❌ [AUTH] Supabase client not available")
        raise HTTPException(
            status_code=500,
            detail="Authentication service not available. Please check server configuration."
        )
    
    try:
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_key:
            logger.error("❌ [AUTH] Supabase credentials not configured")
            raise HTTPException(
                status_code=500,
                detail="Authentication service not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY."
            )
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Verify token and get user info
        user_response = supabase.auth.get_user(token)
        
        if user_response.user is None:
            logger.warning("❌ [AUTH] Invalid or expired token")
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired token. Please log in again."
            )
        
        user_id = user_response.user.id
        logger.info(f"✅ [AUTH] User authenticated: {user_id}")
        return user_id
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [AUTH] Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail=f"Token verification failed: {str(e)}"
        )

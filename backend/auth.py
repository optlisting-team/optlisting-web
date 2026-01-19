"""
인증 관련 공통 모듈
JWT 토큰 검증 로직을 중앙 관리
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
    FastAPI 의존성 함수: JWT 토큰을 검증하고 user_id를 반환합니다.
    
    Authorization: Bearer <JWT> 헤더에서 토큰을 추출하고
    Supabase Auth를 통해 검증합니다.
    
    Returns:
        str: 인증된 사용자의 user_id (UUID)
    
    Raises:
        HTTPException: 토큰이 없거나 유효하지 않은 경우 401 반환
    """
    # Authorization 헤더 확인
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        logger.warning("❌ [AUTH] Authorization header missing")
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing. Please provide a valid JWT token."
        )
    
    # Bearer 토큰 추출
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
    
    # Supabase 클라이언트 생성 및 토큰 검증
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
        
        # 토큰 검증 및 사용자 정보 조회
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

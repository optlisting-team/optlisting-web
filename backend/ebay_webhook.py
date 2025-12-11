"""
eBay Integration Handler
- OAuth 2.0 User Token Flow (원클릭 연결)
- Marketplace Account Deletion Notification
- Challenge-Response Validation

OAuth 2.0 Flow:
1. User clicks "Connect eBay" → /api/ebay/auth/start
2. User redirected to eBay login page
3. User grants permission
4. eBay redirects to /api/ebay/auth/callback with authorization code
5. Backend exchanges code for access_token & refresh_token
6. Tokens saved to database
7. User redirected to frontend with success message

Reference: 
- https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html
- https://developer.ebay.com/marketplace-account-deletion
"""

import os
import hashlib
import logging
import base64
import requests
from datetime import datetime, timedelta
from urllib.parse import urlencode, quote
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Query, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('ebay_webhook')

# Router 생성
router = APIRouter(prefix="/api/ebay", tags=["eBay Integration"])

# =====================================================
# eBay OAuth 2.0 Configuration
# =====================================================

# Environment Variables
EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID", "")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET", "")
EBAY_ENVIRONMENT = os.getenv("EBAY_ENVIRONMENT", "PRODUCTION")  # SANDBOX or PRODUCTION
EBAY_RU_NAME = os.getenv("EBAY_RU_NAME", "")  # eBay Redirect URL Name (RuName)
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://optlisting.com")

# eBay OAuth Endpoints
EBAY_AUTH_ENDPOINTS = {
    "SANDBOX": {
        "authorize": "https://auth.sandbox.ebay.com/oauth2/authorize",
        "token": "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    },
    "PRODUCTION": {
        "authorize": "https://auth.ebay.com/oauth2/authorize",
        "token": "https://api.ebay.com/identity/v1/oauth2/token"
    }
}

# OAuth Scopes (필요한 권한들)
EBAY_SCOPES = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.marketing.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.account.readonly"
]


def get_verification_secret() -> str:
    """
    환경변수에서 Verification Secret 동적으로 읽기
    (배포 후 환경변수 변경 시에도 반영됨)
    """
    secret = os.getenv("EBAY_VERIFICATION_SECRET", "")
    if secret:
        secret = secret.strip()
    return secret


def get_webhook_endpoint() -> str:
    """
    환경변수에서 Webhook Endpoint URL 동적으로 읽기
    """
    endpoint = os.getenv("EBAY_WEBHOOK_ENDPOINT", "")
    if endpoint:
        endpoint = endpoint.strip()
        # Trailing slash 제거 (eBay는 정확한 URL 일치 요구)
        endpoint = endpoint.rstrip('/')
    return endpoint


def compute_challenge_response(challenge_code: str, verification_token: str, endpoint_url: str) -> str:
    """
    eBay Challenge Response 계산
    
    ⚠️ eBay 공식 문서 기준 정확한 계산:
    1. hash_input = challenge_code + verification_token + endpoint_url
    2. challenge_response = SHA256(hash_input).hexdigest()
    
    순서: challenge_code → verification_token → endpoint_url
    인코딩: UTF-8
    """
    
    # 1. 문자열 결합 (순서 중요!)
    hash_input = f"{challenge_code}{verification_token}{endpoint_url}"
    
    # 2. UTF-8 인코딩 후 SHA256 해시 계산
    hash_bytes = hash_input.encode('utf-8')
    hash_object = hashlib.sha256(hash_bytes)
    challenge_response = hash_object.hexdigest()
    
    # 디버그 로깅 (프로덕션에서는 민감정보 마스킹)
    logger.info(f"🔐 Challenge Response Calculation:")
    logger.info(f"   challenge_code: {challenge_code}")
    logger.info(f"   verification_token: {verification_token[:10]}...{verification_token[-4:] if len(verification_token) > 14 else ''}")
    logger.info(f"   endpoint_url: {endpoint_url}")
    logger.info(f"   hash_input length: {len(hash_input)}")
    logger.info(f"   challenge_response: {challenge_response[:16]}...")
    
    return challenge_response


@router.get("/deletion")
async def ebay_deletion_challenge(
    request: Request,
    challenge_code: Optional[str] = Query(None, description="eBay Challenge Code")
):
    """
    eBay Marketplace Account Deletion - Challenge Validation (GET)
    
    eBay sends this request to validate the endpoint before activation.
    We must respond with the correct challengeResponse hash.
    """
    
    logger.info("=" * 60)
    logger.info("📥 eBay Challenge Request Received (GET)")
    logger.info(f"   Full URL: {request.url}")
    logger.info(f"   Query params: {dict(request.query_params)}")
    logger.info(f"   Headers: {dict(request.headers)}")
    
    # Challenge code 확인
    if not challenge_code:
        logger.warning("⚠️ No challenge_code in request - returning ready status")
        return JSONResponse(
            status_code=200,
            content={"status": "ok", "message": "eBay Webhook endpoint ready"}
        )
    
    # 환경변수에서 동적으로 읽기
    verification_secret = get_verification_secret()
    webhook_endpoint = get_webhook_endpoint()
    
    logger.info(f"🔧 Configuration:")
    logger.info(f"   EBAY_VERIFICATION_SECRET configured: {bool(verification_secret)}")
    logger.info(f"   EBAY_WEBHOOK_ENDPOINT configured: {bool(webhook_endpoint)}")
    
    # Verification Secret 확인
    if not verification_secret:
        logger.error("❌ EBAY_VERIFICATION_SECRET not configured!")
        raise HTTPException(
            status_code=500,
            detail="Webhook verification not configured"
        )
    
    # Endpoint URL 결정
    if webhook_endpoint:
        endpoint_url = webhook_endpoint
        logger.info(f"   Using configured endpoint: {endpoint_url}")
    else:
        # Request에서 URL 추출 (fallback)
        endpoint_url = str(request.url).split("?")[0].rstrip('/')
        logger.info(f"   Using request URL as endpoint: {endpoint_url}")
    
    # Challenge Response 계산
    challenge_response = compute_challenge_response(
        challenge_code=challenge_code,
        verification_token=verification_secret,
        endpoint_url=endpoint_url
    )
    
    logger.info(f"✅ Returning challenge response")
    logger.info("=" * 60)
    
    # eBay가 요구하는 정확한 응답 형식
    return JSONResponse(
        status_code=200,
        content={"challengeResponse": challenge_response}
    )


@router.post("/deletion")
async def ebay_deletion_notification(request: Request):
    """
    eBay Marketplace Account Deletion - Notification Handler (POST)
    
    Handles both:
    1. Challenge validation (if challenge_code in body)
    2. Actual deletion notifications
    """
    
    logger.info("=" * 60)
    logger.info("📥 eBay Request Received (POST)")
    
    try:
        # Request body 읽기
        body = await request.body()
        body_str = body.decode('utf-8')
        
        logger.info(f"   Body length: {len(body_str)}")
        logger.info(f"   Body preview: {body_str[:500]}...")
        
        # JSON 파싱
        try:
            data = await request.json()
        except Exception as json_err:
            logger.warning(f"   JSON parse error: {json_err}")
            data = {}
        
        # Challenge code 확인 (POST body에 있는 경우)
        challenge_code = data.get("challenge_code") or data.get("challengeCode")
        
        if challenge_code:
            logger.info("🔐 Challenge code found in POST body")
            
            verification_secret = get_verification_secret()
            webhook_endpoint = get_webhook_endpoint()
            
            if not verification_secret:
                logger.error("❌ EBAY_VERIFICATION_SECRET not configured!")
                raise HTTPException(status_code=500, detail="Verification not configured")
            
            if webhook_endpoint:
                endpoint_url = webhook_endpoint
            else:
                endpoint_url = str(request.url).split("?")[0].rstrip('/')
            
            challenge_response = compute_challenge_response(
                challenge_code=challenge_code,
                verification_token=verification_secret,
                endpoint_url=endpoint_url
            )
            
            logger.info(f"✅ Returning challenge response (POST)")
            logger.info("=" * 60)
            
            return JSONResponse(
                status_code=200,
                content={"challengeResponse": challenge_response}
            )
        
        # 실제 Deletion Notification 처리
        notification_type = data.get("metadata", {}).get("topic", "unknown")
        ebay_user_id = data.get("notification", {}).get("data", {}).get("userId", "unknown")
        
        logger.info(f"📋 Deletion Notification:")
        logger.info(f"   Type: {notification_type}")
        logger.info(f"   eBay User ID: {ebay_user_id}")
        
        # 실제 사용자 데이터 삭제 로직 구현
        from .models import get_db, Profile, Listing, DeletionLog
        
        db = next(get_db())
        try:
            # 1. profiles 테이블에서 ebay_user_id로 검색
            profile = db.query(Profile).filter(Profile.ebay_user_id == ebay_user_id).first()
            
            if not profile:
                logger.warning(f"⚠️ Profile not found for eBay User ID: {ebay_user_id}")
                return JSONResponse(
                    status_code=200,
                    content={
                        "status": "success",
                        "message": "Deletion notification received (no profile found)"
                    }
                )
            
            user_id = profile.user_id
            logger.info(f"   Found profile: user_id={user_id}")
            
            # 2. 해당 사용자의 모든 listings 조회
            user_listings = db.query(Listing).filter(Listing.user_id == user_id).all()
            listing_count = len(user_listings)
            
            logger.info(f"   Found {listing_count} listings for user {user_id}")
            
            if listing_count > 0:
                # 3. deletion_logs 기록 (삭제 전에 스냅샷 저장)
                deletion_logs = []
                for listing in user_listings:
                    # Extract supplier_name
                    supplier = listing.supplier_name or listing.supplier or listing.source or "Unknown"
                    
                    # Extract platform/marketplace
                    platform = listing.platform or listing.marketplace or "eBay"
                    
                    # Create snapshot JSONB with full listing data
                    snapshot_data = {
                        "supplier_name": supplier,
                        "supplier_id": listing.supplier_id,
                        "platform": platform,
                        "title": listing.title,
                        "price": listing.price,
                        "sold_qty": listing.sold_qty,
                        "watch_count": listing.watch_count,
                        "ebay_item_id": listing.ebay_item_id,
                        "sku": listing.sku,
                        "date_listed": listing.date_listed.isoformat() if listing.date_listed else None,
                        "metrics": listing.metrics if listing.metrics else {},
                        "analysis_meta": listing.analysis_meta if listing.analysis_meta else {},
                        "deletion_reason": "eBay Account Deletion",
                        "ebay_user_id": ebay_user_id
                    }
                    
                    log_entry = DeletionLog(
                        item_id=listing.ebay_item_id or listing.item_id or str(listing.id),
                        title=listing.title,
                        platform=platform,
                        source=supplier  # Use source field (supplier_name)
                    )
                    deletion_logs.append(log_entry)
                
                # Bulk insert deletion logs
                db.bulk_save_objects(deletion_logs)
                logger.info(f"   Created {len(deletion_logs)} deletion log entries")
                
                # 4. 관련 listings 삭제
                for listing in user_listings:
                    db.delete(listing)
                logger.info(f"   Deleted {listing_count} listings")
                
                # 5. Profile도 삭제 (선택사항 - 또는 비활성화만 할 수도 있음)
                # 여기서는 삭제하지 않고, 필요시 나중에 정리할 수 있도록 남겨둠
                # db.delete(profile)
                
                db.commit()
                logger.info(f"✅ Successfully deleted {listing_count} listings and created deletion logs")
            else:
                logger.info(f"   No listings found for user {user_id}")
                db.commit()
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Error processing deletion: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            # 에러가 발생해도 eBay에 성공 응답을 보내야 함 (재시도 방지)
            return JSONResponse(
                status_code=200,
                content={
                    "status": "error",
                    "message": f"Deletion notification received but processing failed: {str(e)}"
                }
            )
        finally:
            db.close()
        
        logger.info(f"✅ Deletion notification acknowledged")
        logger.info("=" * 60)
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Deletion notification received and processed",
                "deleted_listings": listing_count if 'listing_count' in locals() else 0
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        logger.info("=" * 60)
        
        # eBay는 200 OK를 기대하므로, 에러가 나도 200 반환
        return JSONResponse(
            status_code=200,
            content={
                "status": "received",
                "message": "Notification received, processing queued"
            }
        )


@router.get("/health")
async def ebay_webhook_health():
    """
    eBay Webhook Health Check - 설정 상태 확인용
    """
    verification_secret = get_verification_secret()
    webhook_endpoint = get_webhook_endpoint()
    
    return {
        "status": "ok",
        "service": "eBay Webhook Handler",
        "version": "1.2.0",
        "verification_configured": bool(verification_secret),
        "verification_secret_length": len(verification_secret) if verification_secret else 0,
        "endpoint_configured": bool(webhook_endpoint),
        "endpoint_url": webhook_endpoint if webhook_endpoint else "not configured"
    }


@router.get("/test-challenge")
async def test_challenge(
    challenge_code: str = Query("test123", description="Test challenge code")
):
    """
    Challenge Response 테스트 엔드포인트
    - 디버그용: 설정된 환경변수로 challenge response 계산 테스트
    """
    verification_secret = get_verification_secret()
    webhook_endpoint = get_webhook_endpoint()
    
    if not verification_secret:
        return {
            "error": "EBAY_VERIFICATION_SECRET not configured",
            "configured": False
        }
    
    if not webhook_endpoint:
        return {
            "error": "EBAY_WEBHOOK_ENDPOINT not configured",
            "configured": False
        }
    
    challenge_response = compute_challenge_response(
        challenge_code=challenge_code,
        verification_token=verification_secret,
        endpoint_url=webhook_endpoint
    )
    
    return {
        "challenge_code": challenge_code,
        "verification_token_preview": f"{verification_secret[:10]}...{verification_secret[-4:]}",
        "endpoint_url": webhook_endpoint,
        "challenge_response": challenge_response,
        "configured": True
    }


# =====================================================
# eBay OAuth 2.0 Endpoints - 원클릭 연결
# =====================================================

@router.get("/auth/start")
async def ebay_auth_start(
    user_id: str = Query(..., description="User ID to associate with eBay account"),
    state: Optional[str] = Query(None, description="Optional state parameter for CSRF protection")
):
    """
    🚀 eBay OAuth 시작 - "Connect eBay" 버튼 클릭 시 호출
    
    1. Authorization URL 생성
    2. 사용자를 eBay 로그인 페이지로 리다이렉트
    
    프론트엔드에서 호출 방법:
    window.location.href = `${API_URL}/api/ebay/auth/start?user_id=${userId}`
    """
    logger.info("=" * 60)
    logger.info("🚀 eBay OAuth Start Request")
    logger.info(f"   user_id: {user_id}")
    
    # 환경변수 확인
    if not EBAY_CLIENT_ID:
        logger.error("❌ EBAY_CLIENT_ID not configured!")
        raise HTTPException(status_code=500, detail="eBay Client ID not configured")
    
    if not EBAY_RU_NAME:
        logger.error("❌ EBAY_RU_NAME not configured!")
        raise HTTPException(status_code=500, detail="eBay RuName not configured")
    
    # Environment 선택
    env = EBAY_ENVIRONMENT if EBAY_ENVIRONMENT in EBAY_AUTH_ENDPOINTS else "PRODUCTION"
    auth_url_base = EBAY_AUTH_ENDPOINTS[env]["authorize"]
    
    # State 파라미터 생성 (user_id 포함)
    state_value = state or f"user_{user_id}_{datetime.now().timestamp()}"
    
    # Scope 조합
    scope_string = " ".join(EBAY_SCOPES)
    
    # Authorization URL 파라미터
    auth_params = {
        "client_id": EBAY_CLIENT_ID,
        "redirect_uri": EBAY_RU_NAME,
        "response_type": "code",
        "scope": scope_string,
        "state": state_value
    }
    
    # Full Authorization URL
    auth_url = f"{auth_url_base}?{urlencode(auth_params, quote_via=quote)}"
    
    logger.info(f"✅ Authorization URL generated")
    logger.info(f"   Redirecting to: {auth_url[:100]}...")
    logger.info("=" * 60)
    
    # eBay 로그인 페이지로 리다이렉트
    return RedirectResponse(url=auth_url, status_code=302)


@router.get("/auth/callback")
async def ebay_auth_callback(
    request: Request,
    code: Optional[str] = Query(None, description="Authorization code from eBay"),
    state: Optional[str] = Query(None, description="State parameter"),
    error: Optional[str] = Query(None, description="Error code if authorization failed"),
    error_description: Optional[str] = Query(None, description="Error description")
):
    """
    🔐 eBay OAuth Callback - eBay 로그인 후 리다이렉트되는 엔드포인트
    
    1. Authorization code 수신
    2. Code를 Access Token + Refresh Token으로 교환
    3. 토큰을 DB에 저장
    4. 프론트엔드로 리다이렉트 (성공/실패 메시지)
    """
    logger.info("=" * 60)
    logger.info("🔐 eBay OAuth Callback Received")
    logger.info(f"   code: {code[:20] if code else 'None'}...")
    logger.info(f"   state: {state}")
    logger.info(f"   error: {error}")
    
    # 에러 처리
    if error:
        logger.error(f"❌ OAuth Error: {error} - {error_description}")
        error_redirect = f"{FRONTEND_URL}/settings?ebay_error={error}&message={error_description or 'Authorization failed'}"
        return RedirectResponse(url=error_redirect, status_code=302)
    
    # Authorization code 확인
    if not code:
        logger.error("❌ No authorization code received")
        error_redirect = f"{FRONTEND_URL}/settings?ebay_error=no_code&message=No authorization code received"
        return RedirectResponse(url=error_redirect, status_code=302)
    
    # State에서 user_id 추출
    user_id = "default-user"
    if state and state.startswith("user_"):
        try:
            parts = state.split("_")
            if len(parts) >= 2:
                user_id = parts[1]
        except:
            pass
    
    logger.info(f"   Extracted user_id: {user_id}")
    
    # 환경변수 확인
    if not EBAY_CLIENT_ID or not EBAY_CLIENT_SECRET:
        logger.error("❌ eBay credentials not configured!")
        error_redirect = f"{FRONTEND_URL}/settings?ebay_error=config&message=eBay credentials not configured"
        return RedirectResponse(url=error_redirect, status_code=302)
    
    try:
        # Token Exchange: Authorization Code → Access Token
        env = EBAY_ENVIRONMENT if EBAY_ENVIRONMENT in EBAY_AUTH_ENDPOINTS else "PRODUCTION"
        token_url = EBAY_AUTH_ENDPOINTS[env]["token"]
        
        # Basic Auth Header
        credentials = f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {encoded_credentials}"
        }
        
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": EBAY_RU_NAME
        }
        
        logger.info(f"   Exchanging code for tokens at: {token_url}")
        
        response = requests.post(token_url, headers=headers, data=data, timeout=30)
        
        if response.status_code != 200:
            logger.error(f"❌ Token exchange failed: {response.status_code}")
            logger.error(f"   Response: {response.text}")
            error_redirect = f"{FRONTEND_URL}/settings?ebay_error=token_exchange&message=Failed to get access token"
            return RedirectResponse(url=error_redirect, status_code=302)
        
        token_data = response.json()
        
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 7200)  # 기본 2시간
        
        logger.info(f"✅ Tokens received successfully")
        logger.info(f"   access_token: {access_token[:20] if access_token else 'None'}...")
        logger.info(f"   refresh_token: {'Yes' if refresh_token else 'No'}")
        logger.info(f"   expires_in: {expires_in} seconds")
        
        # 토큰 만료 시간 계산
        token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        # DB에 토큰 저장
        from .models import Profile, get_db
        db = next(get_db())
        
        try:
            # 프로필 조회 또는 생성
            profile = db.query(Profile).filter(Profile.user_id == user_id).first()
            
            if not profile:
                # 새 프로필 생성
                profile = Profile(
                    user_id=user_id,
                    ebay_access_token=access_token,
                    ebay_refresh_token=refresh_token,
                    ebay_token_expires_at=token_expires_at,
                    ebay_token_updated_at=datetime.utcnow()
                )
                db.add(profile)
            else:
                # 기존 프로필 업데이트
                profile.ebay_access_token = access_token
                profile.ebay_refresh_token = refresh_token
                profile.ebay_token_expires_at = token_expires_at
                profile.ebay_token_updated_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"✅ Tokens saved to database for user: {user_id}")
            
        except Exception as e:
            db.rollback()
            logger.error(f"❌ Failed to save tokens to database: {e}")
            error_redirect = f"{FRONTEND_URL}/settings?ebay_error=db_save&message=Failed to save tokens"
            return RedirectResponse(url=error_redirect, status_code=302)
        
        # DB 저장 로직 (간단 버전)
        try:
            from .models import get_db, Profile
            
            # DB 세션 생성
            db = next(get_db())
            
            # 사용자 프로필 찾기 또는 생성
            profile = db.query(Profile).filter(Profile.user_id == user_id).first()
            
            if not profile:
                # 새 프로필 생성
                profile = Profile(
                    user_id=user_id,
                    ebay_access_token=access_token,
                    ebay_refresh_token=refresh_token,
                    ebay_token_expires_at=token_expires_at,
                    ebay_token_updated_at=datetime.utcnow()
                )
                db.add(profile)
            else:
                # 기존 프로필 업데이트
                profile.ebay_access_token = access_token
                profile.ebay_refresh_token = refresh_token
                profile.ebay_token_expires_at = token_expires_at
                profile.ebay_token_updated_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"✅ Tokens saved to database for user: {user_id}")
            
        except Exception as db_err:
            logger.error(f"⚠️ DB save error (non-fatal): {db_err}")
            # DB 저장 실패해도 성공으로 처리 (토큰은 받았으니)
        
        # 성공! 프론트엔드로 리다이렉트
        success_redirect = f"{FRONTEND_URL}/settings?ebay_connected=true&message=eBay account connected successfully"
        logger.info(f"✅ OAuth complete! Redirecting to: {success_redirect}")
        logger.info("=" * 60)
        
        return RedirectResponse(url=success_redirect, status_code=302)
        
    except Exception as e:
        logger.error(f"❌ OAuth callback error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        error_redirect = f"{FRONTEND_URL}/settings?ebay_error=unknown&message={str(e)}"
        return RedirectResponse(url=error_redirect, status_code=302)


@router.get("/auth/status")
async def ebay_auth_status(
    user_id: str = Query(..., description="User ID to check")
):
    """
    📊 eBay 연결 상태 확인
    
    사용자의 eBay 연결 상태 및 토큰 유효성 확인
    """
    logger.info(f"📊 Checking eBay auth status for user: {user_id}")
    
    try:
        from .models import get_db, Profile
        
        db = next(get_db())
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            return {
                "connected": False,
                "message": "No profile found"
            }
        
        if not profile.ebay_access_token:
            return {
                "connected": False,
                "message": "No eBay token found"
            }
        
        # 토큰 만료 확인
        is_expired = False
        if profile.ebay_token_expires_at:
            is_expired = profile.ebay_token_expires_at < datetime.utcnow()
        
        return {
            "connected": True,
            "user_id": user_id,
            "ebay_user_id": profile.ebay_user_id,
            "token_expires_at": profile.ebay_token_expires_at.isoformat() if profile.ebay_token_expires_at else None,
            "is_expired": is_expired,
            "has_refresh_token": bool(profile.ebay_refresh_token),
            "last_updated": profile.ebay_token_updated_at.isoformat() if profile.ebay_token_updated_at else None
        }
        
    except Exception as e:
        logger.error(f"❌ Status check error: {str(e)}")
        return {
            "connected": False,
            "error": str(e)
        }


@router.get("/oauth/config")
async def ebay_oauth_config():
    """
    🔧 eBay OAuth 설정 상태 확인 (디버그용)
    """
    return {
        "client_id_configured": bool(EBAY_CLIENT_ID),
        "client_secret_configured": bool(EBAY_CLIENT_SECRET),
        "ru_name_configured": bool(EBAY_RU_NAME),
        "environment": EBAY_ENVIRONMENT,
        "frontend_url": FRONTEND_URL,
        "scopes": EBAY_SCOPES
    }


# =====================================================
# eBay Listings API - 리스팅 가져오기
# =====================================================

# eBay API Base URLs
EBAY_API_ENDPOINTS = {
    "SANDBOX": {
        "sell_inventory": "https://api.sandbox.ebay.com/sell/inventory/v1",
        "sell_analytics": "https://api.sandbox.ebay.com/sell/analytics/v1",
        "trading": "https://api.sandbox.ebay.com/ws/api.dll"
    },
    "PRODUCTION": {
        "sell_inventory": "https://api.ebay.com/sell/inventory/v1",
        "sell_analytics": "https://api.ebay.com/sell/analytics/v1",
        "trading": "https://api.ebay.com/ws/api.dll"
    }
}


def get_user_access_token(user_id: str) -> Optional[str]:
    """
    DB에서 사용자의 eBay access token 가져오기
    토큰이 만료됐으면 refresh token으로 갱신
    """
    try:
        from .models import get_db, Profile
        
        db = next(get_db())
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile or not profile.ebay_access_token:
            return None
        
        # 토큰 만료 확인
        if profile.ebay_token_expires_at and profile.ebay_token_expires_at < datetime.utcnow():
            # 토큰 갱신 필요
            if profile.ebay_refresh_token:
                new_token = refresh_access_token(profile.ebay_refresh_token)
                if new_token:
                    # DB 업데이트
                    profile.ebay_access_token = new_token["access_token"]
                    profile.ebay_token_expires_at = datetime.utcnow() + timedelta(seconds=new_token.get("expires_in", 7200))
                    profile.ebay_token_updated_at = datetime.utcnow()
                    db.commit()
                    return new_token["access_token"]
            return None
        
        return profile.ebay_access_token
        
    except Exception as e:
        logger.error(f"Error getting access token: {e}")
        return None


def refresh_access_token(refresh_token: str) -> Optional[Dict]:
    """
    Refresh token으로 새 access token 발급
    """
    try:
        env = EBAY_ENVIRONMENT if EBAY_ENVIRONMENT in EBAY_AUTH_ENDPOINTS else "PRODUCTION"
        token_url = EBAY_AUTH_ENDPOINTS[env]["token"]
        
        credentials = f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {encoded_credentials}"
        }
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "scope": " ".join(EBAY_SCOPES)
        }
        
        response = requests.post(token_url, headers=headers, data=data, timeout=30)
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        return None


@router.get("/listings")
async def get_ebay_listings(
    user_id: str = Query(..., description="User ID"),
    limit: int = Query(100, description="Number of listings to fetch", ge=1, le=500),
    offset: int = Query(0, description="Offset for pagination", ge=0)
):
    """
    📦 eBay Active Listings 가져오기
    
    사용자의 eBay 스토어에서 활성 리스팅 목록을 가져옵니다.
    - 제목, 가격, SKU, 수량
    - 등록일, 조회수, 관심목록 수
    """
    logger.info("=" * 60)
    logger.info(f"📦 Fetching eBay listings for user: {user_id}")
    
    # Access Token 가져오기
    access_token = get_user_access_token(user_id)
    
    if not access_token:
        logger.error("❌ No valid access token found")
        raise HTTPException(
            status_code=401,
            detail="eBay not connected or token expired. Please reconnect your eBay account."
        )
    
    try:
        # eBay Sell Inventory API 호출
        env = EBAY_ENVIRONMENT if EBAY_ENVIRONMENT in EBAY_API_ENDPOINTS else "PRODUCTION"
        inventory_url = f"{EBAY_API_ENDPOINTS[env]['sell_inventory']}/inventory_item"
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        params = {
            "limit": limit,
            "offset": offset
        }
        
        logger.info(f"   Calling: {inventory_url}")
        response = requests.get(inventory_url, headers=headers, params=params, timeout=30)
        
        if response.status_code == 401:
            logger.error("❌ Access token invalid or expired")
            raise HTTPException(status_code=401, detail="eBay token expired. Please reconnect.")
        
        if response.status_code != 200:
            logger.error(f"❌ eBay API error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"eBay API error: {response.text}")
        
        data = response.json()
        
        # 리스팅 데이터 변환
        listings = []
        inventory_items = data.get("inventoryItems", [])
        
        for item in inventory_items:
            sku = item.get("sku", "")
            product = item.get("product", {})
            availability = item.get("availability", {})
            
            listing = {
                "sku": sku,
                "title": product.get("title", ""),
                "description": product.get("description", ""),
                "brand": product.get("brand", ""),
                "condition": item.get("condition", ""),
                "quantity": availability.get("shipToLocationAvailability", {}).get("quantity", 0),
                "images": product.get("imageUrls", []),
                "aspects": product.get("aspects", {}),
            }
            listings.append(listing)
        
        logger.info(f"✅ Retrieved {len(listings)} listings")
        logger.info("=" * 60)
        
        return {
            "success": True,
            "total": data.get("total", len(listings)),
            "offset": offset,
            "limit": limit,
            "listings": listings
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching listings: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/listings/active")
async def get_active_listings_trading_api(
    user_id: str = Query(..., description="User ID"),
    page: int = Query(1, description="Page number", ge=1),
    entries_per_page: int = Query(100, description="Entries per page", ge=1, le=200)
):
    """
    📦 eBay Active Listings (Trading API 방식)
    
    GetMyeBaySelling API를 사용하여 더 상세한 판매 데이터를 가져옵니다.
    - 조회수 (ViewCount)
    - 관심목록 수 (WatchCount)
    - 판매 수량 (QuantitySold)
    - 노출 횟수 (ImpressionCount)
    """
    logger.info("=" * 60)
    logger.info(f"📦 Fetching active listings (Trading API) for user: {user_id}")
    
    access_token = get_user_access_token(user_id)
    
    if not access_token:
        raise HTTPException(status_code=401, detail="eBay not connected. Please connect your eBay account.")
    
    try:
        env = EBAY_ENVIRONMENT if EBAY_ENVIRONMENT in EBAY_API_ENDPOINTS else "PRODUCTION"
        trading_url = EBAY_API_ENDPOINTS[env]["trading"]
        
        # GetMyeBaySelling XML Request
        xml_request = f"""<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
    <RequesterCredentials>
        <eBayAuthToken>{access_token}</eBayAuthToken>
    </RequesterCredentials>
    <ActiveList>
        <Include>true</Include>
        <Pagination>
            <EntriesPerPage>{entries_per_page}</EntriesPerPage>
            <PageNumber>{page}</PageNumber>
        </Pagination>
    </ActiveList>
    <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>"""
        
        headers = {
            "X-EBAY-API-SITEID": "0",  # US site
            "X-EBAY-API-COMPATIBILITY-LEVEL": "1225",
            "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
            "X-EBAY-API-IAF-TOKEN": access_token,
            "Content-Type": "text/xml"
        }
        
        logger.info(f"   Calling Trading API: {trading_url}")
        response = requests.post(trading_url, headers=headers, data=xml_request, timeout=60)
        
        if response.status_code != 200:
            logger.error(f"❌ Trading API error: {response.status_code}")
            raise HTTPException(status_code=response.status_code, detail="eBay Trading API error")
        
        # XML 파싱
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        
        # Namespace 처리
        ns = {"ebay": "urn:ebay:apis:eBLBaseComponents"}
        
        # 에러 체크
        ack = root.find(".//ebay:Ack", ns)
        if ack is not None and ack.text != "Success":
            errors = root.findall(".//ebay:Errors/ebay:ShortMessage", ns)
            error_msg = errors[0].text if errors else "Unknown error"
            logger.error(f"❌ eBay API Error: {error_msg}")
            raise HTTPException(status_code=400, detail=f"eBay Error: {error_msg}")
        
        # 리스팅 파싱
        listings = []
        active_list = root.find(".//ebay:ActiveList", ns)
        
        if active_list is not None:
            items = active_list.findall(".//ebay:Item", ns)
            
            for item in items:
                # 기본 정보
                item_id = item.findtext("ebay:ItemID", "", ns)
                title = item.findtext("ebay:Title", "", ns)
                
                # 가격
                current_price = item.find("ebay:SellingStatus/ebay:CurrentPrice", ns)
                price = float(current_price.text) if current_price is not None and current_price.text else 0
                
                # 수량
                quantity = int(item.findtext("ebay:QuantityAvailable", "0", ns))
                quantity_sold = int(item.findtext("ebay:SellingStatus/ebay:QuantitySold", "0", ns))
                
                # 통계
                watch_count = int(item.findtext("ebay:WatchCount", "0", ns))
                hit_count = int(item.findtext("ebay:HitCount", "0", ns))  # 조회수
                
                # 날짜
                start_time = item.findtext("ebay:ListingDetails/ebay:StartTime", "", ns)
                end_time = item.findtext("ebay:ListingDetails/ebay:EndTime", "", ns)
                
                # SKU
                sku = item.findtext("ebay:SKU", "", ns)
                
                # 이미지 - 썸네일 이미지 URL 추출
                picture_details = item.find("ebay:PictureDetails", ns)
                picture_url = ""
                thumbnail_url = ""
                
                if picture_details is not None:
                    # 모든 PictureURL 찾기 (여러 이미지 지원)
                    picture_urls = picture_details.findall("ebay:PictureURL", ns)
                    
                    if picture_urls and len(picture_urls) > 0:
                        # 첫 번째 PictureURL을 메인 이미지로 사용
                        first_picture = picture_urls[0]
                        if first_picture is not None and first_picture.text:
                            picture_url = first_picture.text.strip()
                            
                            # eBay 이미지 URL을 썸네일로 변환
                            # eBay 이미지 URL 패턴: https://i.ebayimg.com/images/g/.../s-l500.jpg
                            # 썸네일 버전: s-l500 -> s-l225 (더 작은 크기)
                            thumbnail_url = picture_url
                            
                            # eBay 이미지 URL에서 썸네일 버전 생성
                            if "s-l" in thumbnail_url:
                                # s-l500, s-l140 등을 s-l225로 변경 (썸네일 크기)
                                import re
                                thumbnail_url = re.sub(r's-l\d+', 's-l225', thumbnail_url)
                            elif thumbnail_url and "ebayimg.com" in thumbnail_url:
                                # eBay 이미지 URL이지만 크기 파라미터가 없는 경우
                                # URL 끝에 썸네일 크기 추가
                                if "?" in thumbnail_url:
                                    thumbnail_url = f"{thumbnail_url}&s-l225"
                                else:
                                    # .jpg, .png 등 확장자 앞에 썸네일 크기 추가
                                    if thumbnail_url.endswith(('.jpg', '.jpeg', '.png', '.gif')):
                                        base_url = thumbnail_url.rsplit('.', 1)[0]
                                        ext = thumbnail_url.rsplit('.', 1)[1]
                                        thumbnail_url = f"{base_url}_s-l225.{ext}"
                                    else:
                                        thumbnail_url = f"{thumbnail_url}?s-l225"
                
                listing = {
                    "item_id": item_id,
                    "ebay_item_id": item_id,
                    "sell_item_id": item_id,  # Sell Item ID 명시적으로 추가
                    "title": title,
                    "price": price,
                    "quantity_available": quantity,
                    "quantity_sold": quantity_sold,
                    "watch_count": watch_count,
                    "view_count": hit_count,
                    "impressions": 0,  # Trading API에서는 제공 안 됨, Analytics API 필요
                    "sku": sku,
                    "start_time": start_time,
                    "end_time": end_time,
                    "picture_url": picture_url,  # 메인 이미지 URL
                    "thumbnail_url": thumbnail_url,  # 썸네일 이미지 URL (좀비 SKU 리포트용)
                    "days_listed": 0  # 계산 필요
                }
                
                # days_listed 계산
                if start_time:
                    try:
                        from dateutil import parser
                        start_date = parser.parse(start_time)
                        listing["days_listed"] = (datetime.utcnow() - start_date.replace(tzinfo=None)).days
                    except:
                        pass
                
                listings.append(listing)
        
        # 페이지네이션 정보
        pagination = active_list.find("ebay:PaginationResult", ns) if active_list is not None else None
        total_entries = int(pagination.findtext("ebay:TotalNumberOfEntries", "0", ns)) if pagination is not None else len(listings)
        total_pages = int(pagination.findtext("ebay:TotalNumberOfPages", "1", ns)) if pagination is not None else 1
        
        logger.info(f"✅ Retrieved {len(listings)} active listings (Page {page}/{total_pages})")
        logger.info("=" * 60)
        
        return {
            "success": True,
            "total": total_entries,
            "page": page,
            "total_pages": total_pages,
            "entries_per_page": entries_per_page,
            "listings": listings
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

"""
eBay Integration Handler
- OAuth 2.0 User Token Flow (One-click connection)
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
import time as time_module  # time.sleep과 구분
import requests
import asyncio
from datetime import datetime, timedelta, date
from urllib.parse import urlencode, quote
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Query, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from starlette.requests import Request as StarletteRequest
from .auth import get_current_user

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('ebay_webhook')

# Create router
router = APIRouter(prefix="/api/ebay", tags=["eBay Integration"])

# =====================================================
# eBay OAuth 2.0 Configuration
# =====================================================

# Environment Variables
EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID", "")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET", "")
EBAY_ENVIRONMENT = os.getenv("EBAY_ENVIRONMENT", "PRODUCTION")  # SANDBOX or PRODUCTION
EBAY_RU_NAME = os.getenv("EBAY_RU_NAME", "")  # eBay Redirect URL Name (RuName)
# FRONTEND_URL: Must match Supabase Site URL
# Default: optlisting.com (Supabase Site URL)
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://optlisting.com")
logger.info(f"🌐 FRONTEND_URL configured: {FRONTEND_URL}")

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

# OAuth Scopes (required permissions)
EBAY_SCOPES = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.marketing.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.account.readonly"
]


def get_verification_secret() -> str:
    """
    Dynamically read Verification Secret from environment variables
    (Reflected even after deployment when environment variables are changed)
    """
    secret = os.getenv("EBAY_VERIFICATION_SECRET", "")
    if secret:
        secret = secret.strip()
    return secret


def get_webhook_endpoint() -> str:
    """
    Dynamically read Webhook Endpoint URL from environment variables
    """
    endpoint = os.getenv("EBAY_WEBHOOK_ENDPOINT", "")
    if endpoint:
        endpoint = endpoint.strip()
        # Remove trailing slash (eBay requires exact URL match)
        endpoint = endpoint.rstrip('/')
    return endpoint


def compute_challenge_response(challenge_code: str, verification_token: str, endpoint_url: str) -> str:
    """
    Calculate eBay Challenge Response
    
    ⚠️ Accurate calculation based on eBay official documentation:
    1. hash_input = challenge_code + verification_token + endpoint_url
    2. challenge_response = SHA256(hash_input).hexdigest()
    
    Order: challenge_code → verification_token → endpoint_url
    Encoding: UTF-8
    """
    
    # 1. String concatenation (order is important!)
    hash_input = f"{challenge_code}{verification_token}{endpoint_url}"
    
    # 2. Calculate SHA256 hash after UTF-8 encoding
    hash_bytes = hash_input.encode('utf-8')
    hash_object = hashlib.sha256(hash_bytes)
    challenge_response = hash_object.hexdigest()
    
    # Debug logging (mask sensitive info in production)
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
    
    # Check challenge code
    if not challenge_code:
        logger.warning("⚠️ No challenge_code in request - returning ready status")
        return JSONResponse(
            status_code=200,
            content={"status": "ok", "message": "eBay Webhook endpoint ready"}
        )
    
    # Dynamically read from environment variables
    verification_secret = get_verification_secret()
    webhook_endpoint = get_webhook_endpoint()
    
    logger.info(f"🔧 Configuration:")
    logger.info(f"   EBAY_VERIFICATION_SECRET configured: {bool(verification_secret)}")
    logger.info(f"   EBAY_WEBHOOK_ENDPOINT configured: {bool(webhook_endpoint)}")
    
    # Check Verification Secret
    if not verification_secret:
        logger.error("❌ EBAY_VERIFICATION_SECRET not configured!")
        raise HTTPException(
            status_code=500,
            detail="Webhook verification not configured"
        )
    
    # Determine Endpoint URL
    if webhook_endpoint:
        endpoint_url = webhook_endpoint
        logger.info(f"   Using configured endpoint: {endpoint_url}")
    else:
        # Extract URL from request (fallback)
        endpoint_url = str(request.url).split("?")[0].rstrip('/')
        logger.info(f"   Using request URL as endpoint: {endpoint_url}")
    
    # Calculate Challenge Response
    challenge_response = compute_challenge_response(
        challenge_code=challenge_code,
        verification_token=verification_secret,
        endpoint_url=endpoint_url
    )
    
    logger.info(f"✅ Returning challenge response")
    logger.info("=" * 60)
    
    # Exact response format required by eBay
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

@router.post("/auth/start")
async def ebay_auth_start(
    request: Request,
    # JWT 인증으로 user_id 추출 (쿼리 파라미터 제거)
    user_id: str = Depends(get_current_user),
    state: Optional[str] = Query(None, description="Optional state parameter for CSRF protection")
):
    """
    🚀 eBay OAuth 시작 - "Connect eBay" 버튼 클릭 시 호출
    
    1. JWT 토큰에서 user_id 추출 (Authorization 헤더)
    2. Authorization URL 생성
    3. 사용자를 eBay 로그인 페이지로 리다이렉트
    
    프론트엔드에서 호출 방법:
    - apiClient를 사용하여 JWT 토큰이 자동으로 헤더에 추가됨
    - window.location.href = `${API_URL}/api/ebay/auth/start`
    """
    logger.info("=" * 60)
    logger.info("🚀 eBay OAuth Start Request")
    logger.info(f"   user_id: {user_id} (from JWT)")
    logger.info(f"   state: {state}")
    logger.info(f"   Request headers: {dict(request.headers)}")
    
    # 환경변수 확인
    if not EBAY_CLIENT_ID:
        logger.error("❌ EBAY_CLIENT_ID not configured!")
        logger.error(f"   EBAY_CLIENT_ID value: {EBAY_CLIENT_ID[:10] if EBAY_CLIENT_ID else 'None'}...")
        raise HTTPException(status_code=500, detail="eBay Client ID not configured")
    
    if not EBAY_RU_NAME:
        logger.error("❌ EBAY_RU_NAME not configured!")
        logger.error(f"   EBAY_RU_NAME value: {EBAY_RU_NAME[:20] if EBAY_RU_NAME else 'None'}...")
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
    logger.info(f"   URL: {auth_url[:100]}...")
    logger.info("=" * 60)
    
    # Return JSON response with URL instead of redirect to avoid CORS issues with AJAX
    # Frontend will handle the redirect using window.location.href
    return JSONResponse(
        status_code=200,
        content={
            "url": auth_url,
            "success": True,
            "message": "Authorization URL generated successfully"
        }
    )


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
    logger.info(f"   Request URL: {str(request.url)}")
    logger.info(f"   Query params: {dict(request.query_params)}")
    logger.info(f"   code: {code[:20] if code else 'None'}...")
    logger.info(f"   state: {state}")
    logger.info(f"   error: {error}")
    logger.info(f"   error_description: {error_description}")
    
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
    # State 형식: "user_{user_id}_{timestamp}"
    # CRITICAL: 'default-user'는 절대 사용하지 않음 - 실제 로그인 유저 ID만 허용
    user_id = None
    if state:
        logger.info(f"   Raw state parameter: {state}")
        if state.startswith("user_"):
            try:
                # "user_{user_id}_{timestamp}" -> ["user", "{user_id}", "{timestamp}"]
                parts = state.split("_")
                logger.info(f"   State parts: {parts}")
                if len(parts) >= 2:
                    extracted_user_id = parts[1]  # 실제 user_id 추출
                    if extracted_user_id:
                        user_id = extracted_user_id
                        logger.info(f"   ✅ Extracted valid user_id from state: {user_id}")
                    else:
                        logger.error(f"   ❌ Invalid user_id extracted: '{extracted_user_id}' (must be valid UUID)")
                else:
                    logger.warning(f"   State format unexpected, parts count: {len(parts)}")
            except Exception as e:
                logger.error(f"   Error parsing state: {e}")
        else:
            logger.warning(f"   State does not start with 'user_': {state[:50]}")
    
    # user_id 검증 - None이면 에러 반환
    if not user_id:
        logger.error(f"❌ Invalid user_id: '{user_id}' - Cannot save token without valid user_id")
        error_redirect = f"{FRONTEND_URL}/dashboard?ebay_error=invalid_user&message=User ID is required. Please log in and try again."
        return RedirectResponse(url=error_redirect, status_code=302)
    
    logger.info(f"   ✅ Final user_id to use: {user_id} (validated)")
    
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
        
        # 토큰 만료 시간 계산 (UTC 기준)
        # eBay 토큰은 UTC 시간으로 만료 시간을 제공하므로 UTC로 저장
        token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        token_updated_at = datetime.utcnow()
        
        logger.info(f"📅 Token expiration calculation:")
        logger.info(f"   Current UTC time: {datetime.utcnow().isoformat()}")
        logger.info(f"   Expires in: {expires_in} seconds ({expires_in / 3600:.2f} hours)")
        logger.info(f"   Token expires at (UTC): {token_expires_at.isoformat()}")
        
        # 🔥 eBay User ID 가져오기 (Trading API GetUser 사용)
        ebay_user_id = None
        try:
            logger.info("🔍 Fetching eBay User ID from Trading API...")
            env = EBAY_ENVIRONMENT if EBAY_ENVIRONMENT in EBAY_API_ENDPOINTS else "PRODUCTION"
            trading_url = EBAY_API_ENDPOINTS[env]["trading"]
            
            # GetUser XML Request
            get_user_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents">
    <RequesterCredentials>
        <eBayAuthToken>{access_token}</eBayAuthToken>
    </RequesterCredentials>
    <DetailLevel>ReturnAll</DetailLevel>
</GetUserRequest>"""
            
            headers = {
                "X-EBAY-API-SITEID": "0",  # US site
                "X-EBAY-API-COMPATIBILITY-LEVEL": "1225",
                "X-EBAY-API-CALL-NAME": "GetUser",
                "X-EBAY-API-IAF-TOKEN": access_token,
                "Content-Type": "text/xml"
            }
            
            user_response = requests.post(trading_url, headers=headers, data=get_user_xml, timeout=30)
            
            if user_response.status_code == 200:
                import xml.etree.ElementTree as ET
                user_root = ET.fromstring(user_response.text)
                user_ns = {"ebay": "urn:ebay:apis:eBLBaseComponents"}
                
                # 에러 체크
                ack = user_root.find(".//ebay:Ack", user_ns)
                if ack is not None and ack.text == "Success":
                    # UserID 추출
                    user_id_elem = user_root.find(".//ebay:User", user_ns)
                    if user_id_elem is not None:
                        ebay_user_id = user_id_elem.findtext("ebay:UserID", "", user_ns)
                        logger.info(f"✅ eBay User ID retrieved: {ebay_user_id}")
                    else:
                        logger.warning("⚠️ User element not found in GetUser response")
                else:
                    errors = user_root.findall(".//ebay:Errors/ebay:ShortMessage", user_ns)
                    error_msg = errors[0].text if errors else "Unknown error"
                    logger.warning(f"⚠️ GetUser API error: {error_msg}")
            else:
                logger.warning(f"⚠️ GetUser API request failed: {user_response.status_code}")
        except Exception as user_err:
            logger.warning(f"⚠️ Failed to get eBay User ID: {user_err}")
            # eBay User ID 가져오기 실패해도 계속 진행 (토큰 저장은 성공)
        
        # DB에 토큰 저장
        from .models import Profile, get_db
        db = None
        db_verify = None
        
        try:
            db = next(get_db())
            
            # 프로필 조회 (free_tier_count 컬럼이 없을 수 있으므로 raw SQL 사용)
            from sqlalchemy import text
            query = text("""
                SELECT id, user_id
                FROM profiles
                WHERE user_id = :user_id
                LIMIT 1
            """)
            result = db.execute(query, {"user_id": user_id})
            row = result.fetchone()
            profile_exists = row is not None
            
            if not profile_exists:
                # 새 프로필 생성 (free_tier_count 컬럼이 없어도 동작하도록 raw SQL 사용)
                insert_query = text("""
                    INSERT INTO profiles (user_id, ebay_access_token, ebay_refresh_token, 
                                          ebay_token_expires_at, ebay_token_updated_at, ebay_user_id)
                    VALUES (:user_id, :access_token, :refresh_token, :expires_at, :updated_at, :ebay_user_id)
                """)
                db.execute(insert_query, {
                    "user_id": user_id,
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "expires_at": token_expires_at,
                    "updated_at": token_updated_at,
                    "ebay_user_id": ebay_user_id
                })
                logger.info(f"📝 Creating new profile for user: {user_id} (eBay User ID: {ebay_user_id})")
            else:
                # 기존 프로필 업데이트 (free_tier_count 컬럼이 없어도 동작하도록 raw SQL 사용)
                update_query = text("""
                    UPDATE profiles
                    SET ebay_access_token = :access_token,
                        ebay_refresh_token = :refresh_token,
                        ebay_token_expires_at = :expires_at,
                        ebay_token_updated_at = :updated_at,
                        ebay_user_id = :ebay_user_id
                    WHERE user_id = :user_id
                """)
                db.execute(update_query, {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "expires_at": token_expires_at,
                    "updated_at": token_updated_at,
                    "ebay_user_id": ebay_user_id,
                    "user_id": user_id
                })
                logger.info(f"📝 Updating existing profile for user: {user_id} (eBay User ID: {ebay_user_id})")
            
            # 트랜잭션 커밋 (Race condition 방지: 커밋 완료 후 리다이렉트)
            db.commit()
            logger.info(f"✅ Tokens saved to database for user: {user_id}")
            logger.info(f"   Access token length: {len(access_token)}")
            logger.info(f"   Refresh token exists: {bool(refresh_token)}")
            logger.info(f"   Token expires at: {token_expires_at.isoformat()}")
            
            # Race condition 방지: DB 커밋 후 약간의 지연 (토큰 저장 완료 보장)
            time_module.sleep(0.1)  # 100ms 지연으로 DB 쓰기 완료 보장
            
            # 저장 후 즉시 확인 (검증) - 새 세션으로 다시 조회
            db.close()
            db = None
            
            # 새 세션으로 검증 (free_tier_count 컬럼이 없을 수 있으므로 안전하게 처리)
            db_verify = next(get_db())
            
            # Raw SQL 사용 (free_tier_count 컬럼이 없어도 동작)
            from sqlalchemy import text
            query = text("""
                SELECT 
                    id, user_id, ebay_access_token, ebay_refresh_token, 
                    ebay_token_expires_at, ebay_token_updated_at, ebay_user_id
                FROM profiles
                WHERE user_id = :user_id
                LIMIT 1
            """)
            result = db_verify.execute(query, {"user_id": user_id})
            row = result.fetchone()
            if row:
                # Raw SQL 결과를 객체처럼 사용하기 위해 간단한 클래스 생성
                class ProfileVerify:
                    def __init__(self, row):
                        self.id = row[0]
                        self.user_id = row[1]
                        self.ebay_access_token = row[2]
                        self.ebay_refresh_token = row[3]
                        self.ebay_token_expires_at = row[4]
                        self.ebay_token_updated_at = row[5]
                        self.ebay_user_id = row[6] if len(row) > 6 else None
                profile_verify = ProfileVerify(row)
            else:
                profile_verify = None
            
            if profile_verify and profile_verify.ebay_access_token:
                logger.info(f"✅ Token verification: Access token exists in DB")
                logger.info(f"   User ID: {user_id}")
                logger.info(f"   Token length: {len(profile_verify.ebay_access_token)}")
                logger.info(f"   Refresh token exists: {bool(profile_verify.ebay_refresh_token)}")
                logger.info(f"   Token expires at (DB): {profile_verify.ebay_token_expires_at.isoformat() if profile_verify.ebay_token_expires_at else 'None'}")
                logger.info(f"   Token updated at (DB): {profile_verify.ebay_token_updated_at.isoformat() if profile_verify.ebay_token_updated_at else 'None'}")
                
                # 만료 시간 검증
                if profile_verify.ebay_token_expires_at:
                    time_until_expiry = (profile_verify.ebay_token_expires_at - datetime.utcnow()).total_seconds()
                    logger.info(f"   Time until expiry: {time_until_expiry:.0f} seconds ({time_until_expiry / 3600:.2f} hours)")
            else:
                logger.error(f"❌ Token verification failed: Access token not found after save!")
                logger.error(f"   Profile exists: {bool(profile_verify)}")
                if profile_verify:
                    logger.error(f"   Has access token: {bool(profile_verify.ebay_access_token)}")
                    logger.error(f"   Profile user_id: {profile_verify.user_id}")
                # 검증 실패해도 계속 진행 (DB에 저장은 되었을 수 있음)
            
            if db_verify:
                db_verify.close()
                db_verify = None
            
            # Race condition 방지: 검증 완료 후 추가 지연 (토큰이 완전히 저장되었음을 보장)
            time_module.sleep(0.05)  # 50ms 추가 지연
            
        except Exception as e:
            if db:
                db.rollback()
                db.close()
            if db_verify:
                db_verify.close()
            logger.error(f"❌ Failed to save tokens to database: {e}")
            import traceback
            logger.error(traceback.format_exc())
            error_redirect = f"{FRONTEND_URL}/dashboard?ebay_error=db_save&message=Failed to save tokens: {str(e)}"
            return RedirectResponse(url=error_redirect, status_code=302)
        
        # ✅ CRITICAL: OAuth callback must complete successfully even if sync fails later
        # Profile and tokens are now saved, redirect to dashboard
        # Any listing sync errors will be handled separately and won't cause redirect loop
        logger.info("=" * 60)
        logger.info(f"✅ OAuth callback completed successfully")
        logger.info(f"   - User ID: {user_id}")
        logger.info(f"   - eBay User ID: {ebay_user_id}")
        logger.info(f"   - Profile saved: Yes")
        logger.info(f"   - Tokens saved: Yes")
        logger.info("=" * 60)
        
        # 성공! 프론트엔드로 리다이렉트
        # Dashboard로 리다이렉트 (settings 대신)
        success_redirect = f"{FRONTEND_URL}/dashboard?ebay_connected=true&message=eBay account connected successfully"
        logger.info(f"✅ OAuth complete! Redirecting to: {success_redirect}")
        logger.info("=" * 60)
        
        response = RedirectResponse(url=success_redirect, status_code=302)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
        
    except Exception as e:
        logger.error(f"❌ OAuth callback error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        error_redirect = f"{FRONTEND_URL}/dashboard?ebay_error=unknown&message={str(e)}"
        return RedirectResponse(url=error_redirect, status_code=302)


def check_token_status(user_id: str, db: Session = None) -> Dict[str, Any]:
    """
    🔍 경량화된 토큰 상태 확인 함수
    
    DB에서 토큰 존재 여부와 만료 상태만 확인 (API 호출 없음)
    자동 갱신은 백그라운드 워커가 처리
    
    Returns:
        {
            "has_valid_token": bool,  # 유효한 토큰이 있는지
            "is_expired": bool,        # 토큰이 만료되었는지
            "has_refresh_token": bool,  # Refresh token이 있는지
            "expires_at": str,          # 만료 시간 (ISO format)
            "needs_refresh": bool       # 갱신이 필요한지 (1시간 이내 만료)
        }
    """
    close_db = False
    if db is None:
        from .models import get_db, Profile
        db = next(get_db())
        close_db = True
    
    try:
        from .models import Profile
        
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile or not profile.ebay_access_token:
            return {
                "has_valid_token": False,
                "is_expired": True,
                "has_refresh_token": False,
                "expires_at": None,
                "needs_refresh": False
            }
        
        # 토큰 만료 확인
        is_expired = False
        needs_refresh = False
        expires_at = None
        
        if profile.ebay_token_expires_at:
            expires_at = profile.ebay_token_expires_at.isoformat()
            now = datetime.utcnow()
            is_expired = profile.ebay_token_expires_at < now
            # 만료 1시간 전부터 갱신 필요로 표시
            refresh_threshold = profile.ebay_token_expires_at - timedelta(hours=1)
            needs_refresh = now >= refresh_threshold
        
        return {
            "has_valid_token": True,
            "is_expired": is_expired,
            "has_refresh_token": bool(profile.ebay_refresh_token),
            "expires_at": expires_at,
            "needs_refresh": needs_refresh
        }
        
    except Exception as e:
        logger.error(f"❌ Token status check error for user {user_id}: {e}")
        return {
            "has_valid_token": False,
            "is_expired": True,
            "has_refresh_token": False,
            "expires_at": None,
            "needs_refresh": False
        }
    finally:
        if close_db and db:
            db.close()


@router.get("/auth/status")
async def ebay_auth_status(
    user_id: str = Depends(get_current_user)  # JWT 인증으로 user_id 추출
):
    """
    📊 eBay 연결 상태 확인 (경량화된 버전)
    
    DB에서 토큰 상태만 확인 (API 호출 없음)
    자동 갱신은 백그라운드 워커가 처리
    """
    import traceback
    logger.info("=" * 60)
    logger.info(f"📊 [STATUS] Checking eBay token status for user: {user_id}")
    
    try:
        from .models import get_db, Profile
        
        db = next(get_db())
        
        # 프로필 조회 및 상세 로깅
        logger.info(f"📊 [STATUS] Querying Profile table for user_id: {user_id}")
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            logger.warning(f"⚠️ [STATUS] Profile not found for user_id: {user_id}")
            logger.info(f"📊 [STATUS] Resolved user_id: {user_id}")
            logger.info(f"📊 [STATUS] Profile exists: False")
            logger.info(f"📊 [STATUS] ebay_token row exists: False")
            logger.info(f"📊 [STATUS] connected decision: False (no profile)")
            return {
                "connected": False,
                "user_id": user_id,
                "message": "No profile found for user",
                "token_status": {
                    "has_valid_token": False,
                    "is_expired": True,
                    "has_refresh_token": False,
                    "expires_at": None,
                    "needs_refresh": False
                }
            }
        
        logger.info(f"📊 [STATUS] Profile found: id={profile.id}, user_id={profile.user_id}")
        logger.info(f"📊 [STATUS] ebay_access_token exists: {bool(profile.ebay_access_token)}")
        logger.info(f"📊 [STATUS] ebay_access_token length: {len(profile.ebay_access_token) if profile.ebay_access_token else 0}")
        logger.info(f"📊 [STATUS] ebay_refresh_token exists: {bool(profile.ebay_refresh_token)}")
        logger.info(f"📊 [STATUS] ebay_token_expires_at: {profile.ebay_token_expires_at}")
        logger.info(f"📊 [STATUS] ebay_user_id: {profile.ebay_user_id}")
        
        # 경량화된 토큰 상태 확인
        token_status = check_token_status(user_id, db)
        
        logger.info(f"📊 [STATUS] Token status check result:")
        logger.info(f"   - has_valid_token: {token_status['has_valid_token']}")
        logger.info(f"   - is_expired: {token_status['is_expired']}")
        logger.info(f"   - has_refresh_token: {token_status['has_refresh_token']}")
        logger.info(f"   - expires_at: {token_status['expires_at']}")
        logger.info(f"   - needs_refresh: {token_status['needs_refresh']}")
        
        # connected 판단 로직
        has_valid_token = token_status["has_valid_token"]
        is_expired = token_status["is_expired"]
        connected = has_valid_token and not is_expired
        
        logger.info(f"📊 [STATUS] Connection decision logic:")
        logger.info(f"   - has_valid_token: {has_valid_token}")
        logger.info(f"   - is_expired: {is_expired}")
        logger.info(f"   - connected = has_valid_token && !is_expired = {connected}")
        
        if not connected:
            logger.warning(f"⚠️ [STATUS] No valid token for user: {user_id}")
            logger.info(f"📊 [STATUS] Reason: has_valid_token={has_valid_token}, is_expired={is_expired}")
            return {
                "connected": False,
                "user_id": user_id,
                "message": "No valid eBay token found",
                "token_status": token_status,
                "debug": {
                    "profile_exists": True,
                    "has_access_token": bool(profile.ebay_access_token),
                    "has_refresh_token": bool(profile.ebay_refresh_token),
                    "expires_at": profile.ebay_token_expires_at.isoformat() if profile.ebay_token_expires_at else None,
                    "is_expired": is_expired
                }
            }
        
        logger.info(f"✅ [STATUS] Valid token found for user: {user_id} (expired: {is_expired}, needs_refresh: {token_status['needs_refresh']})")
        return {
            "connected": True,
            "user_id": user_id,
            "ebay_user_id": profile.ebay_user_id,
            "token_expires_at": token_status["expires_at"],
            "is_expired": token_status["is_expired"],
            "has_refresh_token": token_status["has_refresh_token"],
            "needs_refresh": token_status["needs_refresh"],
            "last_updated": profile.ebay_token_updated_at.isoformat() if profile.ebay_token_updated_at else None,
            "token_status": token_status
        }
        
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"❌ [STATUS] Status check error: {str(e)}")
        logger.error(f"❌ [STATUS] Stack trace:\n{error_trace}")
        return {
            "connected": False,
            "error": str(e),
            "user_id": user_id,
            "token_status": {
                "has_valid_token": False,
                "is_expired": True,
                "has_refresh_token": False,
                "expires_at": None,
                "needs_refresh": False
            }
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


@router.get("/debug/tokens")
async def debug_tokens(
    user_id: str = Depends(get_current_user)  # JWT 인증으로 user_id 추출
):
    """
    🔍 디버그: 모든 토큰 정보 확인 (긴급 디버깅용)
    """
    try:
        from .models import get_db, Profile
        
        db = next(get_db())
        
        # 모든 프로필 조회
        all_profiles = db.query(Profile).all()
        
        # 특정 user_id의 프로필
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        result = {
            "total_profiles": len(all_profiles),
            "all_user_ids": [p.user_id for p in all_profiles],
            "requested_user_id": user_id,
            "profile_found": bool(profile),
        }
        
        if profile:
            result.update({
                "has_access_token": bool(profile.ebay_access_token),
                "has_refresh_token": bool(profile.ebay_refresh_token),
                "token_length": len(profile.ebay_access_token) if profile.ebay_access_token else 0,
                "token_expires_at": profile.ebay_token_expires_at.isoformat() if profile.ebay_token_expires_at else None,
                "token_updated_at": profile.ebay_token_updated_at.isoformat() if profile.ebay_token_updated_at else None,
                "is_expired": profile.ebay_token_expires_at < datetime.utcnow() if profile.ebay_token_expires_at else None,
                "token_preview": profile.ebay_access_token[:20] + "..." if profile.ebay_access_token else None
            })
        else:
            result["message"] = f"No profile found for user_id: {user_id}"
        
        db.close()
        return result
        
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
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
    logger.info("=" * 60)
    logger.info(f"🔑 [TOKEN] get_user_access_token 호출:")
    logger.info(f"   - user_id: {user_id} (type: {type(user_id).__name__})")
    
    db = None
    try:
        from .models import get_db, Profile
        
        db = next(get_db())
        logger.info(f"   - DB 연결 성공")
        
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            logger.error(f"❌ [TOKEN] Profile not found for user_id: {user_id}")
            logger.error(f"   - 가능한 원인: eBay OAuth 연결이 완료되지 않음")
            logger.error(f"   - 해결 방법: Dashboard에서 'Connect eBay' 버튼을 클릭하여 다시 연결하세요")
            logger.info("=" * 60)
            return None
        
        logger.info(f"✅ [TOKEN] Profile found for user_id: {user_id}")
        logger.info(f"   - Profile ID: {profile.id if hasattr(profile, 'id') else 'N/A'}")
        logger.info(f"   - eBay User ID: {profile.ebay_user_id if hasattr(profile, 'ebay_user_id') else 'N/A'}")
        
        if not profile.ebay_access_token:
            logger.error(f"❌ [TOKEN] No access token found for user_id: {user_id}")
            logger.error(f"   - Profile은 존재하지만 ebay_access_token이 NULL")
            logger.error(f"   - 가능한 원인: OAuth 토큰 저장 실패 또는 토큰이 삭제됨")
            logger.error(f"   - 해결 방법: Dashboard에서 'Connect eBay' 버튼을 클릭하여 다시 연결하세요")
            logger.info("=" * 60)
            return None
        
        # 토큰 만료 확인
        token_expires_at = profile.ebay_token_expires_at if hasattr(profile, 'ebay_token_expires_at') else None
        if token_expires_at:
            now = datetime.utcnow()
            is_expired = token_expires_at < now
            time_until_expiry = (token_expires_at - now).total_seconds() if not is_expired else 0
            
            logger.info(f"📅 [TOKEN] Token expiry check:")
            logger.info(f"   - Token expires at: {token_expires_at.isoformat()}")
            logger.info(f"   - Current time: {now.isoformat()}")
            logger.info(f"   - Is expired: {is_expired}")
            if not is_expired:
                logger.info(f"   - Time until expiry: {time_until_expiry:.0f} seconds ({time_until_expiry / 3600:.2f} hours)")
            
            if is_expired:
                logger.warning(f"⚠️ [TOKEN] Token expired for user_id: {user_id}, attempting refresh...")
                # 토큰 갱신 필요
                refresh_token = profile.ebay_refresh_token if hasattr(profile, 'ebay_refresh_token') else None
                if refresh_token:
                    logger.info(f"   - Refresh token exists, attempting refresh...")
                    new_token = refresh_access_token(refresh_token)
                    if new_token:
                        # DB 업데이트
                        profile.ebay_access_token = new_token["access_token"]
                        profile.ebay_token_expires_at = datetime.utcnow() + timedelta(seconds=new_token.get("expires_in", 7200))
                        profile.ebay_token_updated_at = datetime.utcnow()
                        db.commit()
                        logger.info(f"✅ [TOKEN] Token refreshed successfully for user_id: {user_id}")
                        logger.info(f"   - New token expires in: {new_token.get('expires_in', 7200)} seconds")
                        logger.info("=" * 60)
                        return new_token["access_token"]
                    else:
                        logger.error(f"❌ [TOKEN] Token refresh failed for user_id: {user_id}")
                        logger.error(f"   - refresh_access_token 함수가 None을 반환함")
                        logger.error(f"   - 해결 방법: Dashboard에서 'Connect eBay' 버튼을 클릭하여 다시 연결하세요")
                        logger.info("=" * 60)
                else:
                    logger.error(f"❌ [TOKEN] No refresh token available for user_id: {user_id}")
                    logger.error(f"   - ebay_refresh_token이 NULL")
                    logger.error(f"   - 해결 방법: Dashboard에서 'Connect eBay' 버튼을 클릭하여 다시 연결하세요")
                    logger.info("=" * 60)
                return None
        
        # 토큰 유효성 확인
        token_preview = f"{profile.ebay_access_token[:10]}...{profile.ebay_access_token[-4:]}" if len(profile.ebay_access_token) > 14 else "***"
        logger.info(f"✅ [TOKEN] Valid access token found for user_id: {user_id}")
        logger.info(f"   - Token preview: {token_preview}")
        logger.info(f"   - Token length: {len(profile.ebay_access_token)}")
        logger.info("=" * 60)
        return profile.ebay_access_token
        
    except Exception as e:
        logger.error(f"❌ Error getting access token for user_id {user_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None
    finally:
        if db:
            db.close()


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
    user_id: str = Depends(get_current_user),  # JWT 인증으로 user_id 추출
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


async def _sync_ebay_listings_background(
    request: Request,
    user_id: str
):
    """
    Actual sync logic executed in background
    Wrapped in comprehensive error handling to prevent silent failures
    """
    import traceback
    from datetime import datetime as dt
    
    sync_start_time = dt.utcnow()
    try:
        logger.info("=" * 60)
        logger.info(f"🔄 [SYNC BACKGROUND] Starting sync for user_id: {user_id}")
        logger.info(f"   - Start time: {sync_start_time.isoformat()}")
        logger.info("=" * 60)
        # Get ebay_user_id from profile for logging and validation
        ebay_user_id = None
        profile = None
        try:
            from .models import get_db, Profile
            db = next(get_db())
            profile = db.query(Profile).filter(Profile.user_id == user_id).first()
            
            if not profile:
                logger.error(f"❌ [SYNC] Profile not found for Supabase user_id: {user_id}")
                logger.error(f"   - This means the eBay OAuth connection was not completed")
                logger.error(f"   - User must click 'Connect eBay' button to complete OAuth flow")
                db.close()
                return
            
            ebay_user_id = profile.ebay_user_id if hasattr(profile, 'ebay_user_id') else None
            
            # DEBUG: Log user_id and ebay_user_id mapping
            logger.info(f"🔍 [SYNC] DEBUG: Attempting sync for Supabase User {user_id} with stored eBay ID {ebay_user_id}")
            
            if not ebay_user_id:
                logger.error(f"❌ [SYNC] eBay account not fully linked in database")
                logger.error(f"   - Profile exists for user_id: {user_id}")
                logger.error(f"   - But ebay_user_id is NULL")
                logger.error(f"   - This means the OAuth callback did not save the eBay User ID")
                logger.error(f"   - User must reconnect eBay account to fix this")
                db.close()
                return
            
            logger.info(f"✅ [SYNC] Profile found: user_id={user_id}, ebay_user_id={ebay_user_id}")
            db.close()
        except Exception as e:
            logger.error(f"❌ [SYNC] Error querying profile: {e}")
            import traceback
            logger.error(traceback.format_exc())
            if db:
                db.close()
            return
        
        # ✅ 2. Auto cleanup logic: Clean invalid user_id data and fix platform
        try:
            from .models import get_db, Listing, Profile
            from sqlalchemy import func, text
            db = next(get_db())
            try:
                # 2-1. Delete listings with invalid user_id (default-user, None, or user_id not in Profile)
                invalid_count = db.execute(
                    text("""
                        DELETE FROM listings 
                        WHERE user_id IS NULL 
                        OR user_id = 'default-user'
                        OR user_id NOT IN (SELECT user_id FROM profiles WHERE user_id IS NOT NULL)
                    """)
                ).rowcount
                
                if invalid_count > 0:
                    logger.info(f"🧹 [CLEANUP] Deleted {invalid_count} listings with invalid user_id")
                    db.commit()
                
                # 2-2. Platform fix: Update "ebay" (lowercase) to "eBay"
                platform_fixed = db.execute(
                    text("""
                        UPDATE listings 
                        SET platform = 'eBay', updated_at = NOW()
                        WHERE user_id = :user_id 
                        AND LOWER(platform) = 'ebay'
                        AND platform != 'eBay'
                    """),
                    {"user_id": user_id}
                ).rowcount
                
                if platform_fixed > 0:
                    logger.info(f"🔧 [CLEANUP] platform 보정: {platform_fixed}개 listings 업데이트됨")
                    db.commit()
            except Exception as cleanup_err:
                logger.warning(f"⚠️ [CLEANUP] 정리 로직 실행 중 오류: {cleanup_err}")
                db.rollback()
            finally:
                db.close()
        except Exception as db_err:
            logger.warning(f"⚠️ [CLEANUP] DB 연결 실패: {db_err}")
            pass
        
        try:
            logger.info("=" * 60)
            logger.info(f"🔄 [SYNC BACKGROUND] CRITICAL: Starting fetch_and_store_listings for user_id: {user_id}")
            logger.info(f"   - eBay User ID: {ebay_user_id}")
            logger.info("=" * 60)
            
            # 기존 get_active_listings_trading_api 로직 재사용
            # 첫 페이지부터 모든 페이지를 순회하며 동기화
            page = 1
            entries_per_page = 200  # 최대값 사용
            total_fetched = 0
            total_upserted = 0
            total_pages = 1
            page_stats = []  # 각 페이지별 통계
            
            while page <= total_pages:
                # get_active_listings_trading_api의 로직을 직접 호출
                result = await get_active_listings_trading_api_internal(
                    request=request,
                    user_id=user_id,
                    page=page,
                    entries_per_page=entries_per_page
                )
                
                if result and result.get("success"):
                    fetched_count = len(result.get("listings", []))
                    upserted_count = result.get("upserted", 0)
                    total_entries = result.get("total", 0)
                    total_pages = result.get("total_pages", 1)
                    
                    total_fetched += fetched_count
                    total_upserted += upserted_count
                    
                    page_stat = {
                        "page": page,
                        "fetched": fetched_count,
                        "upserted": upserted_count,
                        "total_entries": total_entries
                    }
                    page_stats.append(page_stat)
                    
                    # 다음 페이지로
                    page += 1
                else:
                    break
            
            # ✅ 3. last_sync_at 강제 업데이트: Sync 완료 후 해당 user_id의 listings의 last_synced_at을 현재 시간으로 강제 업데이트 및 commit
            sync_timestamp = datetime.utcnow()
            if total_upserted > 0:
                try:
                    from .models import get_db, Listing
                    from sqlalchemy import func
                    db = next(get_db())
                    try:
                        # Case-insensitive로 platform="eBay"인 listings의 last_synced_at 업데이트
                        updated_count = db.query(Listing).filter(
                            Listing.user_id == user_id,
                            func.lower(Listing.platform) == func.lower("eBay")
                        ).update(
                            {"last_synced_at": sync_timestamp},
                            synchronize_session=False
                        )
                        db.commit()
                    except Exception as update_err:
                        db.rollback()
                    finally:
                        db.close()
                except Exception as db_err:
                    pass
            
            # Standardized verification log: Only three lines remain
            logger.info(f"[FETCH] Collected {total_fetched} items from eBay.")
            logger.info(f"[STORE] Saved/updated {total_upserted} products for user {user_id} to DB.")
            logger.info("=" * 60)
            logger.info(f"✅ [SYNC BACKGROUND] Sync completed successfully for user_id: {user_id}")
            logger.info("=" * 60)
            
        except Exception as e:
            logger.error("=" * 60)
            logger.error(f"❌ [SYNC BACKGROUND] CRITICAL ERROR during sync for user {user_id}")
            logger.error(f"   - Error type: {type(e).__name__}")
            logger.error(f"   - Error message: {str(e)}")
            logger.error(f"   - Total fetched before error: {total_fetched}")
            logger.error(f"   - Total upserted before error: {total_upserted}")
            logger.error("   - Full traceback:")
            logger.error(traceback.format_exc())
            logger.error("=" * 60)
            # Re-raise to ensure error is logged to Railway
            raise
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"❌ [SYNC BACKGROUND] FATAL ERROR in background sync for user {user_id}")
        logger.error(f"   - Error type: {type(e).__name__}")
        logger.error(f"   - Error message: {str(e)}")
        logger.error("   - Full traceback:")
        logger.error(traceback.format_exc())
        logger.error("=" * 60)
        # Re-raise to ensure error is logged to Railway
        raise


@router.post("/listings/sync")
async def sync_ebay_listings(
    request: Request,
    user_id: str = Depends(get_current_user)  # Extract user_id from JWT authentication
):
    """
    🔄 eBay Listings Sync - Automatically fetch listings and save to DB after eBay connection
    
    Fire and Forget pattern: Immediately return 202 Accepted and execute sync job in background.
    - Async processing to bypass Vercel timeout (30 seconds) issue
    - Actual sync runs in background, frontend does not wait for response
    - Fetch active listings using Trading API
    - Upsert to DB (update on duplicate)
    - Frontend needs to call fetchSummaryStats() again to refresh summary stats
    """
    # Validate user_id - must be valid UUID
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_user_id",
                "message": "User ID is required. Please log in and try again."
            }
        )
    
    # Start sync job in background (Fire and Forget)
    asyncio.create_task(_sync_ebay_listings_background(request, user_id))
    
    # Immediately return 202 Accepted (job continues running in background)
    return JSONResponse(
        status_code=202,
        content={
            "success": True,
            "message": "Sync job started in background",
            "user_id": user_id,
            "status": "accepted"
        }
    )


async def get_active_listings_trading_api_internal(
    request: Request,
    user_id: str,
    page: int = 1,
    entries_per_page: int = 200
):
    """
    내부 함수: Trading API를 사용하여 활성 listings를 가져와 DB에 저장
    (get_active_listings_trading_api와 동일한 로직, 재사용을 위해 분리)
    """
    # ✅ user_id 검증: 유효한 UUID여야 함
    if not user_id:
        logger.error(f"❌ [INTERNAL] Invalid user_id: {user_id}")
        raise HTTPException(status_code=400, detail=f"Invalid user_id: {user_id}. User must be logged in.")
    
    # RequestId 추출 (헤더에서)
    request_id = request.headers.get("X-Request-Id", f"server_{datetime.now().timestamp()}_{user_id}")
    
    t0 = datetime.utcnow()
    logger.info(f"📦 [t0] Request received [RequestId: {request_id}]")
    logger.info(f"   User ID: {user_id}")
    logger.info(f"   Page: {page}, Entries per page: {entries_per_page}")
    
    t1 = datetime.utcnow()
    logger.info(f"🔍 [TOKEN] Fetching access token for user_id: {user_id} (type: {type(user_id).__name__})")
    access_token = get_user_access_token(user_id)
    t1_duration = (datetime.utcnow() - t1).total_seconds() * 1000
    
    if access_token:
        # 토큰의 일부만 로깅 (보안)
        token_preview = f"{access_token[:10]}...{access_token[-4:]}" if len(access_token) > 14 else "***"
        logger.info(f"📋 [t1] Token retrieved [RequestId: {request_id}] - Duration: {t1_duration:.2f}ms")
        logger.info(f"   ✅ Access token found: {token_preview} (length: {len(access_token)})")
    else:
        logger.error(f"📋 [t1] Token retrieval failed [RequestId: {request_id}] - Duration: {t1_duration:.2f}ms")
        logger.error(f"   ❌ No valid access token found for user_id: {user_id}")
        logger.error(f"   가능한 원인:")
        logger.error(f"   1. Profile이 DB에 없음")
        logger.error(f"   2. ebay_access_token이 없음")
        logger.error(f"   3. 토큰이 만료되었고 refresh도 실패함")
        raise HTTPException(
            status_code=401,
            detail="eBay not connected or token expired. Please reconnect your eBay account."
        )
    
    # eBay Trading API 호출
    env = EBAY_ENVIRONMENT if EBAY_ENVIRONMENT in EBAY_API_ENDPOINTS else "PRODUCTION"
    trading_url = EBAY_API_ENDPOINTS[env]["trading"]
    
    # ✅ 3. 데이터 강제 싱크 테스트: API 파라미터 확인 및 로깅
    logger.info("=" * 60)
    logger.info(f"📋 [API PARAMS] eBay Trading API 요청 파라미터:")
    logger.info(f"   - PageNumber: {page}")
    logger.info(f"   - EntriesPerPage: {entries_per_page}")
    logger.info(f"   - DetailLevel: ReturnAll")
    logger.info(f"   - ActiveList Include: true")
    logger.info("=" * 60)
    
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
        <DetailLevel>ReturnAll</DetailLevel>
    </ActiveList>
</GetMyeBaySellingRequest>"""
    
    headers = {
        "X-EBAY-API-SITEID": "0",  # US site
        "X-EBAY-API-COMPATIBILITY-LEVEL": "1225",
        "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
        "X-EBAY-API-IAF-TOKEN": access_token,
        "Content-Type": "text/xml"
    }
    
    t2 = datetime.utcnow()
    logger.info(f"🌐 [API CALL] Calling eBay Trading API:")
    logger.info(f"   - URL: {trading_url}")
    logger.info(f"   - User ID: {user_id}")
    logger.info(f"   - Page: {page}, Entries per page: {entries_per_page}")
    logger.info(f"   - Request XML length: {len(xml_request)} bytes")
    logger.info(f"   - Access token length: {len(access_token)}")
    logger.info(f"   - Access token preview: {access_token[:20]}...{access_token[-10:]}")
    
    try:
        response = requests.post(trading_url, headers=headers, data=xml_request, timeout=60)
        t2_duration = (datetime.utcnow() - t2).total_seconds() * 1000
        logger.info(f"📡 [t2] Trading API response [RequestId: {request_id}] - Status: {response.status_code}, Duration: {t2_duration:.2f}ms")
        logger.info(f"   - Response length: {len(response.text)} bytes")
        
        if response.status_code != 200:
            logger.error(f"❌ [RequestId: {request_id}] Trading API HTTP error: {response.status_code}")
            logger.error(f"   - Response headers: {dict(response.headers)}")
            logger.error(f"   - Response text (first 1000 chars): {response.text[:1000]}")
            logger.error(f"   - Full response text: {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"eBay Trading API error: {response.status_code}")
    except requests.exceptions.Timeout as e:
        logger.error(f"❌ [RequestId: {request_id}] Trading API timeout error: {e}")
        raise HTTPException(status_code=504, detail=f"eBay Trading API timeout: {str(e)}")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"❌ [RequestId: {request_id}] Trading API connection error: {e}")
        raise HTTPException(status_code=503, detail=f"eBay Trading API connection error: {str(e)}")
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ [RequestId: {request_id}] Trading API request error: {e}")
        import traceback
        logger.error(f"   Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"eBay Trading API request error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ [RequestId: {request_id}] Unexpected error during API call: {e}")
        import traceback
        logger.error(f"   Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    
    # XML 파싱
    t3 = datetime.utcnow()
    try:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        t3_duration = (datetime.utcnow() - t3).total_seconds() * 1000
        logger.info(f"📊 [t3] XML parsed [RequestId: {request_id}] - Duration: {t3_duration:.2f}ms")
    except ET.ParseError as e:
        logger.error(f"❌ [RequestId: {request_id}] XML parsing error: {e}")
        logger.error(f"   - Response text (first 2000 chars): {response.text[:2000]}")
        raise HTTPException(status_code=500, detail=f"Invalid XML response from eBay API: {str(e)}")
    except Exception as e:
        logger.error(f"❌ [RequestId: {request_id}] Unexpected XML parsing error: {e}")
        import traceback
        logger.error(f"   Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"XML parsing error: {str(e)}")
    
    # Namespace 처리
    ns = {"ebay": "urn:ebay:apis:eBLBaseComponents"}
    
    # 에러 체크 및 상세 로깅
    ack = root.find(".//ebay:Ack", ns)
    ack_text = ack.text if ack is not None else "Unknown"
    logger.info(f"🔍 [API RESPONSE] Ack status: {ack_text}")
    
    # ✅ 3. 데이터 강제 싱크 테스트: API 응답 상세 분석
    logger.info("=" * 60)
    logger.info(f"📊 [API RESPONSE] eBay Trading API 응답 분석:")
    logger.info(f"   - Ack: {ack_text}")
    
    # TotalNumberOfEntries 추출 (fetched=0 케이스 진단용)
    pagination_result = root.find(".//ebay:PaginationResult", ns)
    total_entries_from_api = None
    total_pages_from_api = None
    
    if pagination_result is not None:
        total_entries_elem = pagination_result.find("ebay:TotalNumberOfEntries", ns)
        if total_entries_elem is not None:
            total_entries_from_api = int(total_entries_elem.text) if total_entries_elem.text else 0
        
        total_pages_elem = pagination_result.find("ebay:TotalNumberOfPages", ns)
        if total_pages_elem is not None:
            total_pages_from_api = int(total_pages_elem.text) if total_pages_elem.text else 1
        
        logger.info(f"   - TotalNumberOfEntries: {total_entries_from_api}")
        logger.info(f"   - TotalNumberOfPages: {total_pages_from_api}")
        logger.info(f"   - Requested PageNumber: {page}")
        logger.info(f"   - Requested EntriesPerPage: {entries_per_page}")
        
        if total_entries_from_api == 0:
            logger.warning(f"⚠️ [API RESPONSE] TotalNumberOfEntries=0 - eBay 계정에 활성 listings가 없거나 API 권한 문제")
            logger.warning(f"   - 가능한 원인:")
            logger.warning(f"     1. eBay 계정에 활성 listings가 실제로 없음")
            logger.warning(f"     2. API 권한 부족 (필요한 scope: https://api.ebay.com/oauth/api_scope/sell.marketing.readonly)")
            logger.warning(f"     3. Access Token이 유효하지 않음 (401 에러가 아닌 경우)")
    else:
        logger.warning(f"⚠️ [API RESPONSE] PaginationResult가 응답에 없음")
    
    logger.info("=" * 60)
    
    if ack is not None and ack.text != "Success":
        errors = root.findall(".//ebay:Errors/ebay:ShortMessage", ns)
        error_codes = root.findall(".//ebay:Errors/ebay:ErrorCode", ns)
        long_messages = root.findall(".//ebay:Errors/ebay:LongMessage", ns)
        error_msg = errors[0].text if errors else "Unknown error"
        error_code = error_codes[0].text if error_codes else "Unknown"
        long_msg = long_messages[0].text if long_messages else None
        
        logger.error(f"❌ [INTERNAL] eBay API Error:")
        logger.error(f"   - ErrorCode: {error_code}")
        logger.error(f"   - ShortMessage: {error_msg}")
        if long_msg:
            logger.error(f"   - LongMessage: {long_msg}")
        logger.error(f"   - TotalNumberOfEntries: {total_entries_from_api}")
        logger.error(f"   - User ID: {user_id}")
        logger.error(f"   - Access token preview: {access_token[:20]}...{access_token[-10:]}")
        
        # 전체 에러 XML 로깅
        errors_elem = root.find(".//ebay:Errors", ns)
        if errors_elem is not None:
            import xml.etree.ElementTree as ET
            errors_xml = ET.tostring(errors_elem, encoding='unicode')
            logger.error(f"   - Full Errors XML: {errors_xml}")
        
        # fetched=0 케이스 진단을 위한 추가 정보
        if total_entries_from_api == 0:
            logger.warning(f"⚠️ [INTERNAL] TotalNumberOfEntries=0 - 가능한 원인:")
            logger.warning(f"   1. eBay 계정에 활성 listings가 없음")
            logger.warning(f"   2. API 권한 부족 (필요한 scope: https://api.ebay.com/oauth/api_scope/sell.marketing.readonly)")
            logger.warning(f"   3. 필터 조건에 맞는 listings가 없음")
            logger.warning(f"   4. Access Token이 유효하지 않음 (토큰 재검증 필요)")
        
        raise HTTPException(status_code=400, detail=f"eBay Error ({error_code}): {error_msg}")
    
    # Success인 경우에도 TotalNumberOfEntries 로깅
    if total_entries_from_api is not None:
        logger.info(f"✅ [INTERNAL] Trading API Success - TotalNumberOfEntries: {total_entries_from_api}")
    
    # 리스팅 파싱 (기존 로직과 동일)
    listings = []
    active_list = root.find(".//ebay:ActiveList", ns)
    
    # 🔍 STEP 1: eBay API fetch 응답 데이터 개수 로깅
    logger.info("=" * 60)
    logger.info(f"🔍 [FETCH DEBUG] eBay API 응답 분석:")
    logger.info(f"   - User ID: {user_id}")
    logger.info(f"   - Page: {page}, Entries per page: {entries_per_page}")
    logger.info(f"   - TotalNumberOfEntries (from API): {total_entries_from_api}")
    
    if active_list is not None:
        items = active_list.findall(".//ebay:Item", ns)
        logger.info(f"📊 [FETCH COUNT] eBay API 응답에서 파싱된 Item 개수: {len(items)}")
        logger.info(f"   - TotalNumberOfEntries (from API): {total_entries_from_api}")
        logger.info(f"   - Page: {page}, Entries per page: {entries_per_page}")
        
        if len(items) == 0 and total_entries_from_api and total_entries_from_api > 0:
            logger.warning(f"⚠️ [FETCH COUNT] 파싱된 Item이 0개인데 TotalNumberOfEntries는 {total_entries_from_api}개입니다!")
            logger.warning(f"   - XML 파싱 문제 가능성")
            logger.warning(f"   - Response XML 일부: {response.text[:1000]}")
        elif len(items) == 0 and (not total_entries_from_api or total_entries_from_api == 0):
            logger.warning(f"⚠️ [FETCH COUNT] eBay 계정에 활성 listings가 없습니다.")
            logger.warning(f"   - TotalNumberOfEntries: {total_entries_from_api}")
            logger.warning(f"   - User ID: {user_id}")
        
        for item in items:
            # 기존 get_active_listings_trading_api와 동일한 파싱 로직
            item_id = item.findtext("ebay:ItemID", "", ns)
            title = item.findtext("ebay:Title", "", ns)
            
            current_price = item.find("ebay:SellingStatus/ebay:CurrentPrice", ns)
            price = float(current_price.text) if current_price is not None and current_price.text else 0
            
            quantity = int(item.findtext("ebay:QuantityAvailable", "0", ns))
            quantity_sold = int(item.findtext("ebay:SellingStatus/ebay:QuantitySold", "0", ns))
            
            watch_count = int(item.findtext("ebay:WatchCount", "0", ns))
            hit_count = int(item.findtext("ebay:HitCount", "0", ns))
            
            start_time = item.findtext("ebay:ListingDetails/ebay:StartTime", "", ns)
            sku = item.findtext("ebay:SKU", "", ns)
            
            # 이미지 처리 (기존 로직과 동일)
            picture_url = ""
            thumbnail_url = ""
            
            picture_details = item.find("ebay:PictureDetails", ns)
            if picture_details is not None:
                picture_urls = picture_details.findall("ebay:PictureURL", ns)
                if picture_urls and len(picture_urls) > 0:
                    picture_url = picture_urls[0].text.strip() if picture_urls[0].text else ""
                    thumbnail_url = picture_url
                    if "s-l" in thumbnail_url:
                        import re
                        thumbnail_url = re.sub(r's-l\d+', 's-l225', thumbnail_url)
            
            if not picture_url:
                gallery_url = item.findtext("ebay:GalleryURL", "", ns)
                if gallery_url and gallery_url.strip():
                    picture_url = gallery_url.strip()
                    thumbnail_url = gallery_url.strip()
            
            # Supplier 정보 추출
            from .services import extract_supplier_info
            supplier_name, supplier_id = extract_supplier_info(
                sku=sku,
                image_url=picture_url or thumbnail_url,
                title=title,
                brand="",
                upc=""
            )
            
            listing = {
                "item_id": item_id,
                "ebay_item_id": item_id,
                "title": title,
                "price": price,
                "quantity_available": quantity,
                "quantity_sold": quantity_sold,
                "watch_count": watch_count,
                "view_count": hit_count,
                "impressions": 0,
                "sku": sku,
                "start_time": start_time,
                "picture_url": picture_url,
                "thumbnail_url": thumbnail_url,
                "image_url": picture_url or thumbnail_url,
                "days_listed": 0,
                "supplier_name": supplier_name,
                "supplier_id": supplier_id
            }
            
            if start_time:
                try:
                    from dateutil import parser
                    start_date = parser.parse(start_time)
                    listing["days_listed"] = (datetime.utcnow() - start_date.replace(tzinfo=None)).days
                except:
                    pass
            
            listings.append(listing)
    else:
        logger.error(f"❌ [FETCH COUNT] active_list가 None입니다!")
        logger.error(f"   - XML 응답에 ActiveList 요소가 없음")
        logger.error(f"   - Response XML 일부: {response.text[:1000]}")
    logger.info("=" * 60)
    
    # 페이지네이션 정보
    pagination = active_list.find("ebay:PaginationResult", ns) if active_list is not None else None
    total_entries = int(pagination.findtext("ebay:TotalNumberOfEntries", "0", ns)) if pagination is not None else len(listings)
    total_pages = int(pagination.findtext("ebay:TotalNumberOfPages", "1", ns)) if pagination is not None else 1
    
    # DB에 리스팅 저장
    logger.info("=" * 60)
    logger.info(f"💾 [DB SAVE] Preparing to save listings to DB:")
    logger.info(f"   - User ID: {user_id} (type: {type(user_id).__name__})")
    logger.info(f"   - Parsed listings count: {len(listings)}")
    logger.info(f"   - Total entries from API: {total_entries_from_api}")
    
    t4 = datetime.utcnow()
    upserted_count = 0
    try:
        from .models import get_db, Listing
        from .services import upsert_listings
        from dateutil import parser
        
        db = next(get_db())
        try:
            # DB 저장 전 개수 확인
            before_count = db.query(Listing).filter(Listing.user_id == user_id).count()
            logger.info(f"   - DB에 저장된 기존 listings 개수 (user_id='{user_id}'): {before_count}")
            
            # Use consolidated parser utility
            from .listing_parser import parse_listing_from_data
            
            listing_objects = []
            for listing_data in listings:
                try:
                    listing_obj = parse_listing_from_data(listing_data, user_id, platform="eBay")
                    listing_objects.append(listing_obj)
                except ValueError as e:
                    logger.error(f"❌ [DB SAVE] Failed to parse listing: {e}")
                    logger.error(f"   - item_id: {listing_data.get('item_id')}")
                    continue  # Skip invalid listings
            
            if listing_objects:
                # ✅ 2단계: 저장 ID 일치화 - 명확한 로깅
                logger.info("=" * 60)
                logger.info(f"💾 [DB SAVE] Saving for user: {user_id}")
                logger.info(f"   - Total listings to save: {len(listing_objects)}개")
                logger.info(f"   - Platform: eBay (강제 설정)")
                logger.info(f"   - user_id type: {type(user_id).__name__}")
                logger.info(f"   - user_id value: '{user_id}'")
                logger.info("=" * 60)
                
                # user_id 일치 확인 (샘플 검증)
                sample_user_ids = set()
                for listing_obj in listing_objects[:5]:  # 처음 5개만 확인
                    sample_user_ids.add(getattr(listing_obj, 'user_id', None))
                if sample_user_ids:
                    if len(sample_user_ids) == 1 and list(sample_user_ids)[0] == user_id:
                        logger.info(f"✅ [DB SAVE] user_id 일치 확인: {user_id}")
                    else:
                        logger.error(f"❌ [DB SAVE] user_id 불일치! expected={user_id}, found={sample_user_ids}")
                
                # ✅ DB 저장: upsert_listings 호출 (user_id 전달)
                logger.info(f"💾 [DB SAVE] upsert_listings 호출 시작...")
                logger.info(f"   - Total listing objects to save: {len(listing_objects)}")
                upserted_count = upsert_listings(db, listing_objects, expected_user_id=user_id)
                logger.info(f"✅ [DB SAVE] upsert_listings completed: {upserted_count} items processed")
                
                # ✅ Verify actual database count after save
                after_count = db.query(Listing).filter(Listing.user_id == user_id).count()
                logger.info(f"✅ [DB SAVE] Database verification: {after_count} listings now in DB for user_id='{user_id}'")
                
                if after_count == 0 and upserted_count > 0:
                    logger.error(f"❌ [DB SAVE] CRITICAL: upsert_listings reported {upserted_count} items, but DB count is 0!")
                    logger.error(f"   - This indicates a database transaction or commit issue")
                
                # ✅ 추가 commit 확인 (batch processing already commits, but ensure final state)
                try:
                    db.flush()
                    db.commit()
                    logger.info(f"✅ [DB SAVE] Final commit successful")
                except Exception as extra_commit_err:
                    logger.warning(f"⚠️ [SYNC] 추가 commit 실패: {extra_commit_err}")
                    db.rollback()
                
                # ✅ 저장 결과 확인
                from sqlalchemy import text
                after_count = db.query(Listing).filter(
                    Listing.user_id == user_id,
                    Listing.platform == "eBay"
                ).count()
                
                sync_end_time = dt.utcnow()
                sync_duration = (sync_end_time - sync_start_time).total_seconds()
                
                logger.info(f"✅ [SYNC] 저장 완료: upserted={upserted_count}, DB count={after_count} (user_id={user_id}, platform=eBay)")
                logger.info(f"⏱️ [SYNC] Execution time: {sync_duration:.2f} seconds ({sync_duration/60:.2f} minutes)")
                
                if after_count == 0 and upserted_count > 0:
                    logger.error(f"❌ [SYNC] CRITICAL: upserted={upserted_count}개 처리했지만 DB count=0!")
                elif after_count > before_count:
                    logger.info(f"✅ [SYNC] {after_count - before_count}개 추가 저장됨")
                elif after_count == before_count and upserted_count > 0:
                    logger.info(f"ℹ️ [SYNC] 모든 레코드 업데이트됨 (신규 추가 없음)")
                
                t4_duration = (datetime.utcnow() - t4).total_seconds() * 1000
                logger.info(f"💾 [t4] Saved {upserted_count} listings to database [RequestId: {request_id}] - Duration: {t4_duration:.2f}ms")
                logger.info(f"📊 [DB UPSERT] DB Upsert 결과:")
                logger.info(f"   - user_id (used in upsert): {user_id}")
                logger.info(f"   - platform (used in upsert): eBay")
                logger.info(f"   - item_id field: used for conflict resolution")
                logger.info(f"   - listings processed: {len(listing_objects)}")
                logger.info(f"   - upserted count (returned): {upserted_count}")
                
                # 🔍 DB에 실제로 저장된 레코드 수 확인 (user_id 일치)
                try:
                    from .models import Listing
                    actual_saved_count = db.query(Listing).filter(
                        Listing.user_id == user_id,
                        Listing.platform == "eBay"
                    ).count()
                    logger.info(f"📊 [DB VERIFY] DB에 실제 저장된 레코드 수 확인:")
                    logger.info(f"   - Query: WHERE user_id='{user_id}' AND platform='eBay'")
                    logger.info(f"   - Actual count in DB: {actual_saved_count}")
                    if actual_saved_count > 0 and upserted_count != actual_saved_count:
                        logger.warn(f"   ⚠️ upserted_count({upserted_count})와 DB 실제 count({actual_saved_count}) 불일치")
                        logger.warn(f"   가능한 원인: 이전에 저장된 레코드가 포함되어 있거나 upsert 로직 문제")
                except Exception as verify_err:
                    logger.warning(f"⚠️ [DB VERIFY] DB 확인 중 오류 (무시): {verify_err}")
            else:
                logger.warning(f"⚠️ [RequestId: {request_id}] No listing objects to upsert")
                upserted_count = 0
        except Exception as db_err:
            db.rollback()
            logger.error(f"❌ [RequestId: {request_id}] Database save error: {db_err}")
            import traceback
            logger.error(traceback.format_exc())
            upserted_count = 0
        finally:
            db.close()
    except Exception as save_err:
        logger.warning(f"⚠️ [RequestId: {request_id}] Failed to save listings to database: {save_err}")
        upserted_count = 0
    
    # 검증 로그 표준화: 세 줄만 남김 (페이지별 상세 로그 제거)
    
    return {
        "success": True,
        "total": total_entries,
        "page": page,
        "total_pages": total_pages,
        "entries_per_page": entries_per_page,
        "listings": listings,
        "upserted": upserted_count,
        "request_id": request_id
    }


@router.get("/listings/active")
async def get_active_listings_trading_api(
    request: Request,
    user_id: str = Depends(get_current_user),  # JWT 인증으로 user_id 추출
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
    # RequestId 추출 (헤더에서)
    request_id = request.headers.get("X-Request-Id", f"server_{datetime.now().timestamp()}_{user_id}")
    
    t0 = datetime.utcnow()
    logger.info("=" * 60)
    logger.info(f"📦 [t0] Request received [RequestId: {request_id}]")
    logger.info(f"   User ID: {user_id}")
    logger.info(f"   Page: {page}, Entries per page: {entries_per_page}")
    logger.info(f"   t0: {t0.isoformat()}")
    
    t1 = datetime.utcnow()
    access_token = get_user_access_token(user_id)
    t1_duration = (datetime.utcnow() - t1).total_seconds() * 1000
    logger.info(f"📋 [t1] Token retrieved [RequestId: {request_id}] - Duration: {t1_duration:.2f}ms")
    
    if not access_token:
        logger.error(f"❌ [RequestId: {request_id}] No access token found for user_id: {user_id}")
        # 디버그 정보 추가
        try:
            from .models import get_db, Profile
            db = next(get_db())
            profile = db.query(Profile).filter(Profile.user_id == user_id).first()
            debug_info = {
                "profile_exists": bool(profile),
                "has_access_token": bool(profile.ebay_access_token) if profile else False,
                "has_refresh_token": bool(profile.ebay_refresh_token) if profile else False,
                "token_expires_at": profile.ebay_token_expires_at.isoformat() if profile and profile.ebay_token_expires_at else None,
                "is_expired": profile.ebay_token_expires_at < datetime.utcnow() if profile and profile.ebay_token_expires_at else None
            }
            db.close()
            logger.error(f"   [RequestId: {request_id}] Debug info: {debug_info}")
        except Exception as debug_err:
            logger.error(f"   [RequestId: {request_id}] Debug info error: {debug_err}")
        
        raise HTTPException(
            status_code=401, 
            detail="eBay not connected. Please connect your eBay account."
        )
    
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
        
        t2 = datetime.utcnow()
        logger.info(f"🌐 [t2] Calling Trading API [RequestId: {request_id}]: {trading_url}")
        response = requests.post(trading_url, headers=headers, data=xml_request, timeout=60)
        t2_duration = (datetime.utcnow() - t2).total_seconds() * 1000
        logger.info(f"📡 [t2] Trading API response [RequestId: {request_id}] - Status: {response.status_code}, Duration: {t2_duration:.2f}ms")
        
        if response.status_code != 200:
            logger.error(f"❌ [RequestId: {request_id}] Trading API error: {response.status_code}")
            logger.error(f"   [RequestId: {request_id}] Response: {response.text[:500]}")
            raise HTTPException(status_code=response.status_code, detail="eBay Trading API error")
        
        # XML 파싱
        t3 = datetime.utcnow()
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        t3_duration = (datetime.utcnow() - t3).total_seconds() * 1000
        logger.info(f"📊 [t3] XML parsed [RequestId: {request_id}] - Duration: {t3_duration:.2f}ms")
        
        # 디버깅: 첫 번째 Item의 XML 구조 확인 (이미지 관련)
        first_item = root.find(".//{urn:ebay:apis:eBLBaseComponents}Item")
        if first_item is not None:
            logger.info("🔍 First Item XML structure check:")
            picture_details = first_item.find(".//{urn:ebay:apis:eBLBaseComponents}PictureDetails")
            gallery_url = first_item.find(".//{urn:ebay:apis:eBLBaseComponents}GalleryURL")
            logger.info(f"   PictureDetails found: {picture_details is not None}")
            logger.info(f"   GalleryURL found: {gallery_url is not None}")
            if picture_details is not None:
                picture_urls = picture_details.findall(".//{urn:ebay:apis:eBLBaseComponents}PictureURL")
                logger.info(f"   PictureURL count: {len(picture_urls)}")
                if picture_urls:
                    logger.info(f"   First PictureURL: {picture_urls[0].text[:80] if picture_urls[0].text else 'None'}...")
            if gallery_url is not None:
                logger.info(f"   GalleryURL: {gallery_url.text[:80] if gallery_url.text else 'None'}...")
        
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
                
                # 이미지 - 썸네일 이미지 URL 추출 (여러 방법 시도)
                picture_url = ""
                thumbnail_url = ""
                
                # 방법 1: PictureDetails에서 PictureURL 찾기
                picture_details = item.find("ebay:PictureDetails", ns)
                if picture_details is not None:
                    # 모든 PictureURL 찾기 (여러 이미지 지원)
                    picture_urls = picture_details.findall("ebay:PictureURL", ns)
                    
                    if picture_urls and len(picture_urls) > 0:
                        # 첫 번째 PictureURL을 메인 이미지로 사용
                        first_picture = picture_urls[0]
                        if first_picture is not None and first_picture.text:
                            picture_url = first_picture.text.strip()
                            logger.info(f"   📷 Image found (PictureURL): {picture_url[:50]}...")
                            
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
                    else:
                        logger.warning(f"   ⚠️ No PictureURL found in PictureDetails for item {item_id}")
                else:
                    logger.warning(f"   ⚠️ No PictureDetails found for item {item_id}")
                
                # 방법 2: GalleryURL 시도 (PictureDetails가 없을 때)
                if not picture_url:
                    gallery_url = item.findtext("ebay:GalleryURL", "", ns)
                    if gallery_url and gallery_url.strip():
                        picture_url = gallery_url.strip()
                        thumbnail_url = gallery_url.strip()
                        logger.info(f"   📷 Using GalleryURL as fallback: {picture_url[:50]}...")
                
                # 방법 3: ListingDetails에서 GalleryURL 시도
                if not picture_url:
                    listing_details = item.find("ebay:ListingDetails", ns)
                    if listing_details is not None:
                        gallery_url = listing_details.findtext("ebay:GalleryURL", "", ns)
                        if gallery_url and gallery_url.strip():
                            picture_url = gallery_url.strip()
                            thumbnail_url = gallery_url.strip()
                            logger.info(f"   📷 Using ListingDetails GalleryURL: {picture_url[:50]}...")
                
                # 방법 4: ItemID로 eBay 이미지 URL 생성 (fallback)
                # eBay 표준 이미지 URL 패턴: https://i.ebayimg.com/images/g/{item_id}/s-l500.jpg
                if not picture_url and item_id:
                    # eBay Gallery URL 패턴 시도
                    try:
                        # 일반적인 eBay 이미지 URL 패턴
                        # 패턴 1: https://i.ebayimg.com/images/g/{item_id}/s-l500.jpg
                        # 패턴 2: https://i.ebayimg.com/00/s/{width}x{height}/z/{hash}/file.jpg
                        # 간단한 방법: Gallery URL 패턴 사용
                        gallery_url_pattern = f"https://i.ebayimg.com/images/g/{item_id}/s-l500.jpg"
                        picture_url = gallery_url_pattern
                        thumbnail_url = gallery_url_pattern.replace("s-l500", "s-l225")
                        logger.info(f"   📷 Using fallback eBay image URL pattern for item {item_id}")
                    except Exception as fallback_err:
                        logger.warning(f"   ⚠️ Fallback image URL generation failed for item {item_id}: {fallback_err}")
                
                # Supplier 정보 추출 (SKU, 이미지 URL, 제목 기반)
                from .services import extract_supplier_info
                supplier_name, supplier_id = extract_supplier_info(
                    sku=sku,
                    image_url=picture_url or thumbnail_url,
                    title=title,
                    brand="",  # Trading API에서 brand 정보는 별도로 가져와야 함
                    upc=""  # Trading API에서 UPC 정보는 별도로 가져와야 함
                )
                
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
                    "image_url": picture_url or thumbnail_url,  # 프론트엔드 호환성을 위한 필드 (메인 이미지 우선, 없으면 썸네일)
                    "days_listed": 0,  # 계산 필요
                    "supplier_name": supplier_name,  # 추출된 공급처 이름
                    "supplier_id": supplier_id  # 추출된 공급처 ID (예: ASIN, Walmart ID 등)
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
        
        logger.info(f"✅ [RequestId: {request_id}] Retrieved {len(listings)} active listings (Page {page}/{total_pages})")
        
        # MVP: 이미지 정보는 프론트엔드에서 사용하지 않으므로 GetMultipleItems API 호출 제거
        # 성능 최적화: 이미지 관련 API 호출을 생략하여 응답 시간 단축
        for listing in listings:
            # 이미지 필드는 빈 문자열로 설정 (기존 코드와의 호환성 유지)
            listing.setdefault("picture_url", "")
            listing.setdefault("thumbnail_url", "")
            listing.setdefault("image_url", "")
        
        logger.info(f"✅ [RequestId: {request_id}] Image fetching skipped for performance (MVP optimization)")
        
        # 첫 번째 리스팅의 이미지 정보 로깅
        if listings and len(listings) > 0:
            first_listing = listings[0]
            logger.info(f"🔍 [RequestId: {request_id}] First listing image data (Item ID: {first_listing.get('item_id', 'N/A')}):")
            logger.info(f"   picture_url: {first_listing.get('picture_url', 'MISSING')[:80] if first_listing.get('picture_url') else 'MISSING'}")
            logger.info(f"   thumbnail_url: {first_listing.get('thumbnail_url', 'MISSING')[:80] if first_listing.get('thumbnail_url') else 'MISSING'}")
            logger.info(f"   image_url: {first_listing.get('image_url', 'MISSING')[:80] if first_listing.get('image_url') else 'MISSING'}")
        
        # 🔥 DB에 리스팅 저장 (supplier_id 포함)
        t4 = datetime.utcnow()
        t4_duration = 0
        upserted_count = 0
        try:
            from .models import get_db, Listing
            from .services import upsert_listings
            from dateutil import parser
            
            db = next(get_db())
            try:
                # Listing 객체로 변환
                listing_objects = []
                for listing_data in listings:
                    # date_listed 계산
                    date_listed = date.today()
                    if listing_data.get("start_time"):
                        try:
                            start_date = parser.parse(listing_data["start_time"])
                            date_listed = start_date.date()
                        except:
                            pass
                    
                    # Listing 객체 생성
                    # Use consolidated parser utility
                    from .listing_parser import parse_listing_from_data
                    listing_obj = parse_listing_from_data(listing_data, user_id, platform="eBay")
                    listing_objects.append(listing_obj)
                
                # Upsert (중복 시 업데이트)
                if listing_objects:
                    upserted_count = upsert_listings(db, listing_objects)
                    db.commit()
                    t4_duration = (datetime.utcnow() - t4).total_seconds() * 1000
                    logger.info(f"💾 [t4] Saved {upserted_count} listings to database [RequestId: {request_id}] - Duration: {t4_duration:.2f}ms")
                else:
                    logger.warning(f"⚠️ [RequestId: {request_id}] No listings to save to database")
            except Exception as db_err:
                db.rollback()
                t4_duration = (datetime.utcnow() - t4).total_seconds() * 1000
                logger.error(f"❌ [RequestId: {request_id}] Database save error (Duration: {t4_duration:.2f}ms): {db_err}")
                import traceback
                logger.error(traceback.format_exc())
            finally:
                db.close()
        except Exception as save_err:
            t4_duration = (datetime.utcnow() - t4).total_seconds() * 1000
            logger.warning(f"⚠️ [RequestId: {request_id}] Failed to save listings to database (Duration: {t4_duration:.2f}ms): {save_err}")
            # DB 저장 실패해도 API 응답은 반환
        
        # 전체 타임라인 로깅
        t_end = datetime.utcnow()
        total_duration = (t_end - t0).total_seconds() * 1000
        logger.info(f"⏱️ [RequestId: {request_id}] Total timeline:")
        logger.info(f"   t0: Request received - {t0.isoformat()}")
        logger.info(f"   t1: Token retrieved - {t1_duration:.2f}ms")
        logger.info(f"   t2: Trading API call - {t2_duration:.2f}ms (Status: {response.status_code})")
        logger.info(f"   t3: XML parsing - {t3_duration:.2f}ms")
        logger.info(f"   t4: DB upsert - {t4_duration:.2f}ms (if attempted)")
        logger.info(f"   Total duration: {total_duration:.2f}ms")
        logger.info("=" * 60)
        
        return {
            "success": True,
            "total": total_entries,
            "page": page,
            "total_pages": total_pages,
            "entries_per_page": entries_per_page,
            "listings": listings,
            "request_id": request_id  # Response에 requestId 포함
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# 백그라운드 sync를 위한 헬퍼 함수
async def start_background_sync(request: Request, user_id: str):
    """백그라운드에서 eBay listings sync 시작"""
    try:
        logger.info(f"🔄 [BG-SYNC] Starting background sync for user {user_id}")
        await sync_ebay_listings(request, user_id)
        logger.info(f"✅ [BG-SYNC] Background sync completed for user {user_id}")
    except Exception as e:
        logger.error(f"❌ [BG-SYNC] Background sync failed for user {user_id}: {e}")

@router.get("/summary")
async def get_ebay_summary(
    request: Request,
    user_id: str = Depends(get_current_user),  # JWT 인증으로 user_id 추출
    filters: Optional[str] = Query(None, description="Optional filter JSON for low-performing calculation")
):
    """
    📊 eBay Listings Summary (경량화된 통계 API)
    
    Dashboard 초기 로딩 시 카운트만 가져오는 경량 API
    - Active listings count
    - Low-performing count (필터 기준)
    - Last sync timestamp
    - Queue count (선택)
    
    성능 최적화:
    - 데이터가 없을 경우 즉시 빈 값 반환
    - DB 쿼리 최적화 (인덱스 활용)
    - 비동기 처리로 응답 시간 단축
    """
    import traceback
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    
    # Validate user_id - 유효한 UUID여야 함
    if not user_id:
        return {
            "success": False,
            "error": "invalid_user_id",
            "message": "User ID is required. Please log in and try again.",
            "user_id": user_id,
            "active_count": 0,
            "low_performing_count": 0,
            "queue_count": 0,
            "last_sync_at": None
        }
    
    try:
        from .models import get_db, Listing
        from datetime import date as date_type
        
        db = next(get_db())
        try:
            # ✅ 성능 최적화: 즉시 빈 값 반환 (데이터가 없을 경우)
            # 먼저 빠른 존재 여부 확인 (LIMIT 1 사용, 인덱스 활용)
            from sqlalchemy import func
            has_listings = db.query(Listing).filter(
                Listing.user_id == user_id
            ).limit(1).first()
            
            if not has_listings:
                # ✅ 초기 로딩 최적화: 데이터가 없으면 백그라운드에서 자동 sync 시작
                # 첫 로그인 시 자동으로 eBay API에서 데이터 가져오기
                logger.info(f"🔄 [AUTO-SYNC] No listings found for user {user_id}, starting background sync...")
                
                # 백그라운드 태스크로 sync 시작 (응답 지연 없음)
                # FastAPI의 async 함수에서는 get_running_loop()를 사용해야 함
                try:
                    import asyncio
                    # 현재 실행 중인 이벤트 루프 가져오기 (FastAPI async context)
                    loop = asyncio.get_running_loop()
                    # 백그라운드 태스크 생성 (fire-and-forget)
                    loop.create_task(start_background_sync(request, user_id))
                    logger.info(f"✅ [AUTO-SYNC] Background sync task created for user {user_id}")
                except RuntimeError:
                    # 실행 중인 루프가 없는 경우 (일반적으로 발생하지 않음)
                    logger.warning(f"⚠️ [AUTO-SYNC] No running event loop found, skipping background sync")
                except Exception as bg_err:
                    logger.warning(f"⚠️ [AUTO-SYNC] Failed to start background sync: {bg_err}")
                    # 백그라운드 태스크 실패해도 응답은 정상 반환
                
                # 데이터가 없어도 즉시 빈 값 반환 (백그라운드 sync는 별도로 진행)
                return {
                    "success": True,
                    "user_id": user_id,
                    "active_count": 0,
                    "low_performing_count": 0,
                    "queue_count": 0,
                    "last_sync_at": None,
                    "filters_applied": {},
                    "auto_sync_started": True  # 프론트엔드에서 알림 표시용
                }
            
            # ✅ 최적화된 쿼리: 인덱스 활용 (user_id, platform)
            active_query = db.query(Listing).filter(
                Listing.user_id == user_id,
                func.lower(Listing.platform) == func.lower("eBay")
            )
            active_count = active_query.count()
            
            # ✅ Last sync timestamp (가장 최근 last_synced_at) - 인덱스 활용
            last_listing = db.query(Listing).filter(
                Listing.user_id == user_id,
                func.lower(Listing.platform) == func.lower("eBay")
            ).order_by(Listing.last_synced_at.desc()).limit(1).first()
            
            last_sync_at = last_listing.last_synced_at.isoformat() if last_listing and last_listing.last_synced_at else None
            
            # Low-performing count (기본 필터: 7일, 0 판매, 0 관심, 10 이하 조회수)
            # 필터가 제공되면 사용, 없으면 기본값
            default_filters = {
                "analytics_period_days": 7,
                "max_sales": 0,
                "max_watches": 0,
                "max_views": 10,
                "max_impressions": 100
            }
            
            filter_params = default_filters
            if filters:
                try:
                    import json
                    parsed_filters = json.loads(filters)
                    filter_params = {**default_filters, **parsed_filters}
                    
                    # 필터 키 매핑: market_place_filter와 marketplace_filter 둘 다 체크
                    marketplace_filter = parsed_filters.get("market_place_filter") or parsed_filters.get("marketplace_filter")
                    if marketplace_filter and marketplace_filter.lower() != "ebay":
                        logger.warn(f"⚠️ [SUMMARY] marketplace_filter가 'eBay'가 아님: {marketplace_filter}")
                except Exception as filter_err:
                    logger.warn(f"⚠️ [FILTER] 필터 파싱 실패: {filter_err}")
                    pass
            
            # ✅ 3-1. filters_applied에 platform 정보 추가 (대소문자 통일)
            filter_params["marketplace_filter"] = "eBay"  # 정규화된 값으로 통일
            filter_params["platform"] = "eBay"  # 추가 정보
            
            # Low-performing 계산 (DB에서 직접 필터링)
            # Note: view_count와 impressions는 Listing 모델에 직접 필드가 없으므로 metrics JSONB에서 확인 필요
            # 간단한 통계를 위해 date_listed, sold_qty, watch_count만 필터링
            min_days = filter_params.get("analytics_period_days", 7)
            max_sales = filter_params.get("max_sales", 0)
            max_watches = filter_params.get("max_watches", 0)
            
            # 날짜 기준 필터: min_days 이상 등록된 것 (cutoff_date 이전에 등록된 것)
            cutoff_date = date_type.today() - timedelta(days=min_days)
            
            # 기본 필터: date_listed, sold_qty, watch_count만 사용
            # view_count와 impressions는 metrics JSONB에 저장되므로 전체 listings 조회 시 필터링
            # ✅ 1. 플랫폼 대소문자 통일: Case-insensitive 검색 사용
            low_performing_query = db.query(Listing).filter(
                Listing.user_id == user_id,
                func.lower(Listing.platform) == func.lower("eBay"),  # Case-insensitive
                Listing.date_listed <= cutoff_date,
                Listing.sold_qty <= max_sales,
                Listing.watch_count <= max_watches
            )
            
            low_performing_count = low_performing_query.count()
            
            # Queue count는 DeletionLog에서 가져오지 않고, 클라이언트에서 관리하는 것으로 가정
            # 필요시 별도 API로 제공
            queue_count = 0
            
            # 검증 로그 표준화: 세 줄만 남김
            logger.info(f"[DASHBOARD] 현재 활성 상품 수: {active_count}개.")
            
            return {
                "success": True,
                "user_id": user_id,
                "active_count": active_count,
                "low_performing_count": low_performing_count,
                "queue_count": queue_count,
                "last_sync_at": last_sync_at,
                "filters_applied": filter_params
            }
            
        except Exception as db_err:
            logger.error(f"❌ Database error in summary: {db_err}")
            import traceback
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_err)}")
        finally:
            db.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching summary: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

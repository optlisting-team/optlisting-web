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
import time as time_module  # distinguish from time.sleep
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
        # Read request body
        body = await request.body()
        body_str = body.decode('utf-8')
        
        logger.info(f"   Body length: {len(body_str)}")
        logger.info(f"   Body preview: {body_str[:500]}...")
        
        # JSON parse
        try:
            data = await request.json()
        except Exception as json_err:
            logger.warning(f"   JSON parse error: {json_err}")
            data = {}
        
        # Check challenge code (when present in POST body)
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
        
        # Handle Deletion Notification
        notification_type = data.get("metadata", {}).get("topic", "unknown")
        ebay_user_id = data.get("notification", {}).get("data", {}).get("userId", "unknown")
        
        logger.info(f"📋 Deletion Notification:")
        logger.info(f"   Type: {notification_type}")
        logger.info(f"   eBay User ID: {ebay_user_id}")
        
        # User data deletion logic
        from .models import get_db, Profile, Listing, DeletionLog
        
        db = next(get_db())
        try:
            # 1. Find profile by ebay_user_id
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
            
            # 2. Query all listings for this user
            user_listings = db.query(Listing).filter(Listing.user_id == user_id).all()
            listing_count = len(user_listings)
            
            logger.info(f"   Found {listing_count} listings for user {user_id}")
            
            if listing_count > 0:
                # 3. Write deletion_logs (snapshot before delete)
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
                
                # 4. Delete related listings
                for listing in user_listings:
                    db.delete(listing)
                logger.info(f"   Deleted {listing_count} listings")
                
                # 5. Profile delete optional; leave as-is for later cleanup
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
            # Return 200 to eBay even on error (avoid retry)
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
        
        # eBay expects 200; return 200 even on error
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
    eBay Webhook Health Check - verify configuration
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
    Test endpoint for challenge response.
    Debug: test challenge response calculation with configured env vars.
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
# eBay OAuth 2.0 Endpoints - one-click connect
# =====================================================

@router.post("/auth/start")
async def ebay_auth_start(
    request: Request,
    # user_id from JWT (no query param)
    user_id: str = Depends(get_current_user),
    state: Optional[str] = Query(None, description="Optional state parameter for CSRF protection")
):
    """
    eBay OAuth start - called when user clicks "Connect eBay".
    1. Extract user_id from JWT (Authorization header)
    2. Build authorization URL
    3. Redirect to eBay login
    Frontend: use apiClient so JWT is auto-added;
    - window.location.href = `${API_URL}/api/ebay/auth/start`
    """
    logger.info("=" * 60)
    logger.info("🚀 eBay OAuth Start Request")
    logger.info(f"   user_id: {user_id} (from JWT)")
    logger.info(f"   state: {state}")
    logger.info(f"   Request headers: {dict(request.headers)}")
    
    # Check env vars
    if not EBAY_CLIENT_ID:
        logger.error("❌ EBAY_CLIENT_ID not configured!")
        logger.error(f"   EBAY_CLIENT_ID value: {EBAY_CLIENT_ID[:10] if EBAY_CLIENT_ID else 'None'}...")
        raise HTTPException(status_code=500, detail="eBay Client ID not configured")
    
    if not EBAY_RU_NAME:
        logger.error("❌ EBAY_RU_NAME not configured!")
        logger.error(f"   EBAY_RU_NAME value: {EBAY_RU_NAME[:20] if EBAY_RU_NAME else 'None'}...")
        raise HTTPException(status_code=500, detail="eBay RuName not configured")
    
    # Select environment
    env = EBAY_ENVIRONMENT if EBAY_ENVIRONMENT in EBAY_AUTH_ENDPOINTS else "PRODUCTION"
    auth_url_base = EBAY_AUTH_ENDPOINTS[env]["authorize"]
    
    # Build state param (include user_id)
    state_value = state or f"user_{user_id}_{datetime.now().timestamp()}"
    
    # Scope string
    scope_string = " ".join(EBAY_SCOPES)
    
    # Authorization URL params
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
    eBay OAuth Callback - redirected here after eBay login.
    1. Receive authorization code
    2. Exchange code for access + refresh token
    3. Save tokens to DB
    4. Redirect to frontend (success/failure message)
    """
    logger.info("=" * 60)
    logger.info("🔐 eBay OAuth Callback Received")
    logger.info(f"   Request URL: {str(request.url)}")
    logger.info(f"   Query params: {dict(request.query_params)}")
    logger.info(f"   code: {code[:20] if code else 'None'}...")
    logger.info(f"   state: {state}")
    logger.info(f"   error: {error}")
    logger.info(f"   error_description: {error_description}")
    
    # Error handling
    if error:
        logger.error(f"❌ OAuth Error: {error} - {error_description}")
        error_redirect = f"{FRONTEND_URL}/settings?ebay_error={error}&message={error_description or 'Authorization failed'}"
        return RedirectResponse(url=error_redirect, status_code=302)
    
    # Check authorization code
    if not code:
        logger.error("❌ No authorization code received")
        error_redirect = f"{FRONTEND_URL}/settings?ebay_error=no_code&message=No authorization code received"
        return RedirectResponse(url=error_redirect, status_code=302)
    
    # Extract user_id from state
    # State format: "user_{user_id}_{timestamp}"
    # CRITICAL: never use 'default-user' - only allow actual logged-in user ID
    user_id = None
    if state:
        logger.info(f"   Raw state parameter: {state}")
        if state.startswith("user_"):
            try:
                # "user_{user_id}_{timestamp}" -> ["user", "{user_id}", "{timestamp}"]
                parts = state.split("_")
                logger.info(f"   State parts: {parts}")
                if len(parts) >= 2:
                    extracted_user_id = parts[1]  # actual user_id
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
    
    # Validate user_id - return error if None
    if not user_id:
        logger.error(f"❌ Invalid user_id: '{user_id}' - Cannot save token without valid user_id")
        error_redirect = f"{FRONTEND_URL}/dashboard?ebay_error=invalid_user&message=User ID is required. Please log in and try again."
        return RedirectResponse(url=error_redirect, status_code=302)
    
    logger.info(f"   ✅ Final user_id to use: {user_id} (validated)")
    
    # Check env vars
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
        expires_in = token_data.get("expires_in", 7200)  # default 2h
        
        logger.info(f"✅ Tokens received successfully")
        logger.info(f"   access_token: {access_token[:20] if access_token else 'None'}...")
        logger.info(f"   refresh_token: {'Yes' if refresh_token else 'No'}")
        logger.info(f"   expires_in: {expires_in} seconds")
        
        # Token expiry (UTC). eBay provides UTC; store as UTC.
        token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        token_updated_at = datetime.utcnow()
        
        logger.info(f"📅 Token expiration calculation:")
        logger.info(f"   Current UTC time: {datetime.utcnow().isoformat()}")
        logger.info(f"   Expires in: {expires_in} seconds ({expires_in / 3600:.2f} hours)")
        logger.info(f"   Token expires at (UTC): {token_expires_at.isoformat()}")
        
        # Get eBay User ID (Trading API GetUser)
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
                
                # Error check
                ack = user_root.find(".//ebay:Ack", user_ns)
                if ack is not None and ack.text == "Success":
                    # Extract UserID
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
            # Continue even if eBay User ID fetch fails (token save still succeeds)
        
        # Save tokens to DB
        from .models import Profile, get_db
        db = None
        db_verify = None
        
        try:
            db = next(get_db())
            
            # Get profile (raw SQL if free_tier_count column missing)
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
                # Create new profile (raw SQL so it works without free_tier_count)
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
                # Update existing profile (raw SQL so it works without free_tier_count)
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
            
            # Commit (avoid race: commit before redirect)
            db.commit()
            logger.info(f"✅ Tokens saved to database for user: {user_id}")
            logger.info(f"   Access token length: {len(access_token)}")
            logger.info(f"   Refresh token exists: {bool(refresh_token)}")
            logger.info(f"   Token expires at: {token_expires_at.isoformat()}")
            
            # Small delay after commit so DB write completes
            time_module.sleep(0.1)  # 100ms
            
            # Verify immediately after save - re-query with new session
            db.close()
            db = None
            
            # Verify with new session (safe if free_tier_count missing)
            db_verify = next(get_db())
            
            # Raw SQL (works without free_tier_count)
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
                # Simple class to use raw SQL result like object
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
                
                # Expiry time verification
                if profile_verify.ebay_token_expires_at:
                    time_until_expiry = (profile_verify.ebay_token_expires_at - datetime.utcnow()).total_seconds()
                    logger.info(f"   Time until expiry: {time_until_expiry:.0f} seconds ({time_until_expiry / 3600:.2f} hours)")
            else:
                logger.error(f"❌ Token verification failed: Access token not found after save!")
                logger.error(f"   Profile exists: {bool(profile_verify)}")
                if profile_verify:
                    logger.error(f"   Has access token: {bool(profile_verify.ebay_access_token)}")
                    logger.error(f"   Profile user_id: {profile_verify.user_id}")
                # Continue even if verify fails (DB save may have succeeded)
            
            if db_verify:
                db_verify.close()
                db_verify = None
            
            # Extra delay after verify
            time_module.sleep(0.05)  # 50ms
            
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
        
        # Success - redirect to frontend (Dashboard, not settings)
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
    Lightweight token status check.
    Only checks existence and expiry in DB (no API call).
    Auto-refresh is handled by background worker.

    Returns:
        {
            "has_valid_token": bool,
            "is_expired": bool,
            "has_refresh_token": bool,
            "expires_at": str,  # ISO
            "needs_refresh": bool  # within 1h of expiry
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
        
        # Check token expiry
        is_expired = False
        needs_refresh = False
        expires_at = None
        
        if profile.ebay_token_expires_at:
            expires_at = profile.ebay_token_expires_at.isoformat()
            now = datetime.utcnow()
            is_expired = profile.ebay_token_expires_at < now
            # Mark needs_refresh within 1h of expiry
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
    user_id: str = Depends(get_current_user)  # user_id from JWT
):
    """
    eBay connection status (lightweight). DB only; refresh by background worker.
    """
    import traceback
    logger.info("=" * 60)
    logger.info(f"📊 [STATUS] Checking eBay token status for user: {user_id}")
    
    try:
        from .models import get_db, Profile
        
        db = next(get_db())
        
        # Profile lookup and detailed logging
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
        
        # Lightweight token status check
        token_status = check_token_status(user_id, db)
        
        logger.info(f"📊 [STATUS] Token status check result:")
        logger.info(f"   - has_valid_token: {token_status['has_valid_token']}")
        logger.info(f"   - is_expired: {token_status['is_expired']}")
        logger.info(f"   - has_refresh_token: {token_status['has_refresh_token']}")
        logger.info(f"   - expires_at: {token_status['expires_at']}")
        logger.info(f"   - needs_refresh: {token_status['needs_refresh']}")
        
        # connected decision logic
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
    eBay OAuth config status (debug)
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
    user_id: str = Depends(get_current_user)  # user_id from JWT
):
    """
    Debug: full token info (emergency debugging)
    """
    try:
        from .models import get_db, Profile
        
        db = next(get_db())
        
        # Get all profiles
        all_profiles = db.query(Profile).all()
        
        # Profile for given user_id
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
# eBay Listings API - fetch listings
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
    Get user's eBay access token from DB. Refresh with refresh_token if expired.
    """
    logger.info("=" * 60)
    logger.info(f"🔑 [TOKEN] get_user_access_token called:")
    logger.info(f"   - user_id: {user_id} (type: {type(user_id).__name__})")
    
    db = None
    try:
        from .models import get_db, Profile
        
        db = next(get_db())
        logger.info(f"   - DB connected")
        
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        
        if not profile:
            logger.error(f"❌ [TOKEN] Profile not found for user_id: {user_id}")
            logger.error(f"   - Possible cause: eBay OAuth not completed")
            logger.error(f"   - Fix: Click 'Connect eBay' on Dashboard")
            logger.info("=" * 60)
            return None
        
        logger.info(f"✅ [TOKEN] Profile found for user_id: {user_id}")
        logger.info(f"   - Profile ID: {profile.id if hasattr(profile, 'id') else 'N/A'}")
        logger.info(f"   - eBay User ID: {profile.ebay_user_id if hasattr(profile, 'ebay_user_id') else 'N/A'}")
        
        if not profile.ebay_access_token:
            logger.error(f"❌ [TOKEN] No access token found for user_id: {user_id}")
            logger.error(f"   - Profile exists but ebay_access_token is NULL")
            logger.error(f"   - Possible cause: OAuth token save failed or token deleted")
            logger.error(f"   - Fix: Click 'Connect eBay' on Dashboard to reconnect")
            logger.info("=" * 60)
            return None
        
        # Check token expiry
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
                # Token refresh needed
                refresh_token = profile.ebay_refresh_token if hasattr(profile, 'ebay_refresh_token') else None
                if refresh_token:
                    logger.info(f"   - Refresh token exists, attempting refresh...")
                    new_token = refresh_access_token(refresh_token)
                    if new_token:
                        # Update DB
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
                        logger.error(f"   - refresh_access_token returned None")
                        logger.error(f"   - Fix: Click 'Connect eBay' on Dashboard")
                        logger.info("=" * 60)
                else:
                    logger.error(f"❌ [TOKEN] No refresh token available for user_id: {user_id}")
                    logger.error(f"   - ebay_refresh_token is NULL")
                    logger.error(f"   - Fix: Click 'Connect eBay' on Dashboard to reconnect")
                    logger.info("=" * 60)
                return None
        
        # Verify token validity
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
    Issue new access token from refresh token
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
    user_id: str = Depends(get_current_user),  # user_id from JWT auth
    limit: int = Query(100, description="Number of listings to fetch", ge=1, le=500),
    offset: int = Query(0, description="Offset for pagination", ge=0)
):
    """
    Get eBay Active Listings. Title, price, SKU, quantity; date listed, views, watch count.
    """
    logger.info("=" * 60)
    logger.info(f"📦 Fetching eBay listings for user: {user_id}")
    
    # Get access token
    access_token = get_user_access_token(user_id)
    
    if not access_token:
        logger.error("❌ No valid access token found")
        raise HTTPException(
            status_code=401,
            detail="eBay not connected or token expired. Please reconnect your eBay account."
        )
    
    try:
        # Call eBay Sell Inventory API
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
        
        # Transform listing data
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
                    logger.info(f"🔧 [CLEANUP] platform corrected: {platform_fixed} listings updated")
                    db.commit()
            except Exception as cleanup_err:
                logger.warning(f"⚠️ [CLEANUP] Cleanup error: {cleanup_err}")
                db.rollback()
            finally:
                db.close()
        except Exception as db_err:
            logger.warning(f"⚠️ [CLEANUP] DB connection failed: {db_err}")
            pass
        
        try:
            logger.info("=" * 60)
            logger.info(f"🔄 [SYNC BACKGROUND] CRITICAL: Starting fetch_and_store_listings for user_id: {user_id}")
            logger.info(f"   - eBay User ID: {ebay_user_id}")
            logger.info("=" * 60)
            
            # Reuse get_active_listings_trading_api logic; iterate all pages
            page = 1
            entries_per_page = 200  # max
            total_fetched = 0
            total_upserted = 0
            total_pages = 1
            page_stats = []  # Stats per page
            
            while page <= total_pages:
                # Call get_active_listings_trading_api logic directly
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
                    
                    # Next page
                    page += 1
                else:
                    break
            
            # 3. Force last_sync_at update: set listings last_synced_at to now and commit
            sync_timestamp = datetime.utcnow()
            if total_upserted > 0:
                try:
                    from .models import get_db, Listing
                    from sqlalchemy import func
                    db = next(get_db())
                    try:
                        # Update last_synced_at for listings where platform="eBay" (case-insensitive)
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
    Internal: fetch active listings via Trading API and save to DB. Same logic as get_active_listings_trading_api, split for reuse.
    """
    # Validate user_id: must be valid UUID
    if not user_id:
        logger.error(f"❌ [INTERNAL] Invalid user_id: {user_id}")
        raise HTTPException(status_code=400, detail=f"Invalid user_id: {user_id}. User must be logged in.")
    
    # Extract RequestId (from header)
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
        # Log only part of token (security)
        token_preview = f"{access_token[:10]}...{access_token[-4:]}" if len(access_token) > 14 else "***"
        logger.info(f"📋 [t1] Token retrieved [RequestId: {request_id}] - Duration: {t1_duration:.2f}ms")
        logger.info(f"   ✅ Access token found: {token_preview} (length: {len(access_token)})")
    else:
        logger.error(f"📋 [t1] Token retrieval failed [RequestId: {request_id}] - Duration: {t1_duration:.2f}ms")
        logger.error(f"   ❌ No valid access token found for user_id: {user_id}")
        logger.error(f"   Possible causes:")
        logger.error(f"   1. No profile in DB")
        logger.error(f"   2. No ebay_access_token")
        logger.error(f"   3. Token expired and refresh failed")
        raise HTTPException(
            status_code=401,
            detail="eBay not connected or token expired. Please reconnect your eBay account."
        )
    
    # Call eBay Trading API
    env = EBAY_ENVIRONMENT if EBAY_ENVIRONMENT in EBAY_API_ENDPOINTS else "PRODUCTION"
    trading_url = EBAY_API_ENDPOINTS[env]["trading"]
    
    # 3. Force sync test: API params check and logging
    logger.info("=" * 60)
    logger.info(f"📋 [API PARAMS] eBay Trading API request params:")
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
    
    # XML parse
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
    
    # Namespace handling
    ns = {"ebay": "urn:ebay:apis:eBLBaseComponents"}
    
    # Error check and detailed logging
    ack = root.find(".//ebay:Ack", ns)
    ack_text = ack.text if ack is not None else "Unknown"
    logger.info(f"🔍 [API RESPONSE] Ack status: {ack_text}")
    
    # API response analysis
    logger.info("=" * 60)
    logger.info(f"📊 [API RESPONSE] eBay Trading API response analysis:")
    logger.info(f"   - Ack: {ack_text}")
    
    # Extract TotalNumberOfEntries (for diagnosing fetched=0 case)
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
            logger.warning(f"⚠️ [API RESPONSE] TotalNumberOfEntries=0 - no active listings or API permission issue")
            logger.warning(f"   - Possible causes:")
            logger.warning(f"     1. No active listings on eBay account")
            logger.warning(f"     2. API scope missing (sell.marketing.readonly)")
            logger.warning(f"     3. Invalid access token")
    else:
        logger.warning(f"⚠️ [API RESPONSE] PaginationResult missing from response")
    
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
        
        # Log full error XML
        errors_elem = root.find(".//ebay:Errors", ns)
        if errors_elem is not None:
            import xml.etree.ElementTree as ET
            errors_xml = ET.tostring(errors_elem, encoding='unicode')
            logger.error(f"   - Full Errors XML: {errors_xml}")
        
        # Extra info for diagnosing fetched=0 case
        if total_entries_from_api == 0:
            logger.warning(f"⚠️ [INTERNAL] TotalNumberOfEntries=0 - possible causes:")
            logger.warning(f"   1. No active listings on eBay account")
            logger.warning(f"   2. API scope missing")
            logger.warning(f"   3. No listings match filter")
            logger.warning(f"   4. Invalid access token (re-verify)")
        
        raise HTTPException(status_code=400, detail=f"eBay Error ({error_code}): {error_msg}")
    
    # Log TotalNumberOfEntries even on Success
    if total_entries_from_api is not None:
        logger.info(f"✅ [INTERNAL] Trading API Success - TotalNumberOfEntries: {total_entries_from_api}")
    
    # Parse listings (same as existing logic)
    listings = []
    active_list = root.find(".//ebay:ActiveList", ns)
    
    # STEP 1: Log eBay API fetch response count
    logger.info("=" * 60)
    logger.info(f"🔍 [FETCH DEBUG] eBay API response analysis:")
    logger.info(f"   - User ID: {user_id}")
    logger.info(f"   - Page: {page}, Entries per page: {entries_per_page}")
    logger.info(f"   - TotalNumberOfEntries (from API): {total_entries_from_api}")
    
    if active_list is not None:
        items = active_list.findall(".//ebay:Item", ns)
        logger.info(f"📊 [FETCH COUNT] Parsed Item count from eBay API: {len(items)}")
        logger.info(f"   - TotalNumberOfEntries (from API): {total_entries_from_api}")
        logger.info(f"   - Page: {page}, Entries per page: {entries_per_page}")
        
        if len(items) == 0 and total_entries_from_api and total_entries_from_api > 0:
            logger.warning(f"⚠️ [FETCH COUNT] Parsed 0 Items but TotalNumberOfEntries is {total_entries_from_api}!")
            logger.warning(f"   - Possible XML parsing issue")
            logger.warning(f"   - Response XML excerpt: {response.text[:1000]}")
        elif len(items) == 0 and (not total_entries_from_api or total_entries_from_api == 0):
            logger.warning(f"⚠️ [FETCH COUNT] No active listings on eBay account.")
            logger.warning(f"   - TotalNumberOfEntries: {total_entries_from_api}")
            logger.warning(f"   - User ID: {user_id}")
        
        for item in items:
            # Same parsing logic as get_active_listings_trading_api
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
            
            # Image handling (same as existing logic)
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
            
            # Extract Supplier info
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
        logger.error(f"❌ [FETCH COUNT] active_list is None!")
        logger.error(f"   - No ActiveList element in XML response")
        logger.error(f"   - Response XML sample: {response.text[:1000]}")
    logger.info("=" * 60)
    
    # Pagination info
    pagination = active_list.find("ebay:PaginationResult", ns) if active_list is not None else None
    total_entries = int(pagination.findtext("ebay:TotalNumberOfEntries", "0", ns)) if pagination is not None else len(listings)
    total_pages = int(pagination.findtext("ebay:TotalNumberOfPages", "1", ns)) if pagination is not None else 1
    
    # Save listings to DB
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
            # Count before DB save
            before_count = db.query(Listing).filter(Listing.user_id == user_id).count()
            logger.info(f"   - Existing listings count in DB (user_id='{user_id}'): {before_count}")
            
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
                # Step 2: Align saved IDs - clear logging
                logger.info("=" * 60)
                logger.info(f"💾 [DB SAVE] Saving for user: {user_id}")
                logger.info(f"   - Total listings to save: {len(listing_objects)}")
                logger.info(f"   - Platform: eBay (forced)")
                logger.info(f"   - user_id type: {type(user_id).__name__}")
                logger.info(f"   - user_id value: '{user_id}'")
                logger.info("=" * 60)
                
                # user_id match check (sample)
                sample_user_ids = set()
                for listing_obj in listing_objects[:5]:  # first 5 only
                    sample_user_ids.add(getattr(listing_obj, 'user_id', None))
                if sample_user_ids:
                    if len(sample_user_ids) == 1 and list(sample_user_ids)[0] == user_id:
                        logger.info(f"✅ [DB SAVE] user_id match confirmed: {user_id}")
                    else:
                        logger.error(f"❌ [DB SAVE] user_id mismatch! expected={user_id}, found={sample_user_ids}")
                
                # DB save: call upsert_listings (pass user_id)
                logger.info(f"💾 [DB SAVE] Calling upsert_listings...")
                logger.info(f"   - Total listing objects to save: {len(listing_objects)}")
                upserted_count = upsert_listings(db, listing_objects, expected_user_id=user_id)
                logger.info(f"✅ [DB SAVE] upsert_listings completed: {upserted_count} items processed")
                
                # ✅ Verify actual database count after save
                after_count = db.query(Listing).filter(Listing.user_id == user_id).count()
                logger.info(f"✅ [DB SAVE] Database verification: {after_count} listings now in DB for user_id='{user_id}'")
                
                if after_count == 0 and upserted_count > 0:
                    logger.error(f"❌ [DB SAVE] CRITICAL: upsert_listings reported {upserted_count} items, but DB count is 0!")
                    logger.error(f"   - This indicates a database transaction or commit issue")
                
                # Extra commit check (batch processing already commits, but ensure final state)
                try:
                    db.flush()
                    db.commit()
                    logger.info(f"✅ [DB SAVE] Final commit successful")
                except Exception as extra_commit_err:
                    logger.warning(f"⚠️ [SYNC] Extra commit failed: {extra_commit_err}")
                    db.rollback()
                
                # Verify save result
                from sqlalchemy import text
                after_count = db.query(Listing).filter(
                    Listing.user_id == user_id,
                    Listing.platform == "eBay"
                ).count()
                
                sync_end_time = dt.utcnow()
                sync_duration = (sync_end_time - sync_start_time).total_seconds()
                
                logger.info(f"✅ [SYNC] Save complete: upserted={upserted_count}, DB count={after_count} (user_id={user_id}, platform=eBay)")
                logger.info(f"⏱️ [SYNC] Execution time: {sync_duration:.2f} seconds ({sync_duration/60:.2f} minutes)")
                
                if after_count == 0 and upserted_count > 0:
                    logger.error(f"❌ [SYNC] CRITICAL: processed {upserted_count} but DB count=0!")
                elif after_count > before_count:
                    logger.info(f"✅ [SYNC] {after_count - before_count} new records saved")
                elif after_count == before_count and upserted_count > 0:
                    logger.info(f"ℹ️ [SYNC] All records updated (no new additions)")
                
                t4_duration = (datetime.utcnow() - t4).total_seconds() * 1000
                logger.info(f"💾 [t4] Saved {upserted_count} listings to database [RequestId: {request_id}] - Duration: {t4_duration:.2f}ms")
                logger.info(f"📊 [DB UPSERT] DB Upsert result:")
                logger.info(f"   - user_id (used in upsert): {user_id}")
                logger.info(f"   - platform (used in upsert): eBay")
                logger.info(f"   - item_id field: used for conflict resolution")
                logger.info(f"   - listings processed: {len(listing_objects)}")
                logger.info(f"   - upserted count (returned): {upserted_count}")
                
                # Verify actual saved record count in DB (user_id match)
                try:
                    from .models import Listing
                    actual_saved_count = db.query(Listing).filter(
                        Listing.user_id == user_id,
                        Listing.platform == "eBay"
                    ).count()
                    logger.info(f"📊 [DB VERIFY] Verifying actual saved record count in DB:")
                    logger.info(f"   - Query: WHERE user_id='{user_id}' AND platform='eBay'")
                    logger.info(f"   - Actual count in DB: {actual_saved_count}")
                    if actual_saved_count > 0 and upserted_count != actual_saved_count:
                        logger.warn(f"   ⚠️ upserted_count({upserted_count}) and DB actual count({actual_saved_count}) mismatch")
                        logger.warn(f"   Possible causes: previously saved records included or upsert logic issue")
                except Exception as verify_err:
                    logger.warning(f"⚠️ [DB VERIFY] Error during DB verify (ignored): {verify_err}")
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
    
    # Standardize validation log: keep only 3 lines (remove per-page detail logs)
    
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
    user_id: str = Depends(get_current_user),  # Extract user_id via JWT auth
    page: int = Query(1, description="Page number", ge=1),
    entries_per_page: int = Query(100, description="Entries per page", ge=1, le=200)
):
    """
    eBay Active Listings (Trading API).
    Fetches detailed selling data via GetMyeBaySelling API:
    - ViewCount, WatchCount, QuantitySold, ImpressionCount.
    """
    # Extract RequestId (from header)
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
        # Add debug info
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
        
        # XML parse
        t3 = datetime.utcnow()
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        t3_duration = (datetime.utcnow() - t3).total_seconds() * 1000
        logger.info(f"📊 [t3] XML parsed [RequestId: {request_id}] - Duration: {t3_duration:.2f}ms")
        
        # Debug: check first Item XML structure (image-related)
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
        
        # Namespace handling
        ns = {"ebay": "urn:ebay:apis:eBLBaseComponents"}
        
        # Error check
        ack = root.find(".//ebay:Ack", ns)
        if ack is not None and ack.text != "Success":
            errors = root.findall(".//ebay:Errors/ebay:ShortMessage", ns)
            error_msg = errors[0].text if errors else "Unknown error"
            logger.error(f"❌ eBay API Error: {error_msg}")
            raise HTTPException(status_code=400, detail=f"eBay Error: {error_msg}")
        
        # Parse listings
        listings = []
        active_list = root.find(".//ebay:ActiveList", ns)
        
        if active_list is not None:
            items = active_list.findall(".//ebay:Item", ns)
            
            for item in items:
                # Basic info
                item_id = item.findtext("ebay:ItemID", "", ns)
                title = item.findtext("ebay:Title", "", ns)
                
                # Price
                current_price = item.find("ebay:SellingStatus/ebay:CurrentPrice", ns)
                price = float(current_price.text) if current_price is not None and current_price.text else 0
                
                # Quantity
                quantity = int(item.findtext("ebay:QuantityAvailable", "0", ns))
                quantity_sold = int(item.findtext("ebay:SellingStatus/ebay:QuantitySold", "0", ns))
                
                # Stats
                watch_count = int(item.findtext("ebay:WatchCount", "0", ns))
                hit_count = int(item.findtext("ebay:HitCount", "0", ns))  # View count
                
                # Dates
                start_time = item.findtext("ebay:ListingDetails/ebay:StartTime", "", ns)
                end_time = item.findtext("ebay:ListingDetails/ebay:EndTime", "", ns)
                
                # SKU
                sku = item.findtext("ebay:SKU", "", ns)
                
                # Image: extract thumbnail URL (try multiple methods)
                picture_url = ""
                thumbnail_url = ""
                
                # Method 1: Find PictureURL in PictureDetails
                picture_details = item.find("ebay:PictureDetails", ns)
                if picture_details is not None:
                    picture_urls = picture_details.findall("ebay:PictureURL", ns)
                    
                    if picture_urls and len(picture_urls) > 0:
                        # Use first PictureURL as main image
                        first_picture = picture_urls[0]
                        if first_picture is not None and first_picture.text:
                            picture_url = first_picture.text.strip()
                            logger.info(f"   📷 Image found (PictureURL): {picture_url[:50]}...")
                            
                            # Convert eBay image URL to thumbnail
                            # eBay image URL pattern: https://i.ebayimg.com/images/g/.../s-l500.jpg
                            # Thumbnail: s-l500 -> s-l225
                            thumbnail_url = picture_url
                            
                            # Generate thumbnail from eBay image URL
                            if "s-l" in thumbnail_url:
                                # s-l500, s-l140 -> s-l225 (thumbnail size)
                                import re
                                thumbnail_url = re.sub(r's-l\d+', 's-l225', thumbnail_url)
                            elif thumbnail_url and "ebayimg.com" in thumbnail_url:
                                # eBay image URL but no size param: append thumbnail size
                                if "?" in thumbnail_url:
                                    thumbnail_url = f"{thumbnail_url}&s-l225"
                                else:
                                    # Add thumbnail size before extension
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
                
                # Method 2: Try GalleryURL (when PictureDetails missing)
                if not picture_url:
                    gallery_url = item.findtext("ebay:GalleryURL", "", ns)
                    if gallery_url and gallery_url.strip():
                        picture_url = gallery_url.strip()
                        thumbnail_url = gallery_url.strip()
                        logger.info(f"   📷 Using GalleryURL as fallback: {picture_url[:50]}...")
                
                # Method 3: Try GalleryURL in ListingDetails
                if not picture_url:
                    listing_details = item.find("ebay:ListingDetails", ns)
                    if listing_details is not None:
                        gallery_url = listing_details.findtext("ebay:GalleryURL", "", ns)
                        if gallery_url and gallery_url.strip():
                            picture_url = gallery_url.strip()
                            thumbnail_url = gallery_url.strip()
                            logger.info(f"   📷 Using ListingDetails GalleryURL: {picture_url[:50]}...")
                
                # Method 4: Build eBay image URL from ItemID (fallback)
                # eBay image URL pattern: https://i.ebayimg.com/images/g/{item_id}/s-l500.jpg
                if not picture_url and item_id:
                    try:
                        # Common eBay image URL patterns; use Gallery URL pattern
                        gallery_url_pattern = f"https://i.ebayimg.com/images/g/{item_id}/s-l500.jpg"
                        picture_url = gallery_url_pattern
                        thumbnail_url = gallery_url_pattern.replace("s-l500", "s-l225")
                        logger.info(f"   📷 Using fallback eBay image URL pattern for item {item_id}")
                    except Exception as fallback_err:
                        logger.warning(f"   ⚠️ Fallback image URL generation failed for item {item_id}: {fallback_err}")
                
                # Extract Supplier info (SKU, image URL, title)
                from .services import extract_supplier_info
                supplier_name, supplier_id = extract_supplier_info(
                    sku=sku,
                    image_url=picture_url or thumbnail_url,
                    title=title,
                    brand="",  # Trading API: brand fetched separately
                    upc=""  # Trading API: UPC fetched separately
                )
                
                listing = {
                    "item_id": item_id,
                    "ebay_item_id": item_id,
                    "sell_item_id": item_id,  # Explicit Sell Item ID
                    "title": title,
                    "price": price,
                    "quantity_available": quantity,
                    "quantity_sold": quantity_sold,
                    "watch_count": watch_count,
                    "view_count": hit_count,
                    "impressions": 0,  # Not in Trading API; needs Analytics API
                    "sku": sku,
                    "start_time": start_time,
                    "end_time": end_time,
                    "picture_url": picture_url,  # Main image URL
                    "thumbnail_url": thumbnail_url,  # Thumbnail URL (zombie SKU report)
                    "image_url": picture_url or thumbnail_url,  # Frontend compat (main then thumbnail)
                    "days_listed": 0,  # Computed
                    "supplier_name": supplier_name,  # Extracted supplier name
                    "supplier_id": supplier_id  # Extracted supplier ID (e.g. ASIN, Walmart ID)
                }
                
                # Compute days_listed
                if start_time:
                    try:
                        from dateutil import parser
                        start_date = parser.parse(start_time)
                        listing["days_listed"] = (datetime.utcnow() - start_date.replace(tzinfo=None)).days
                    except:
                        pass
                
                listings.append(listing)
        
        # Pagination info
        pagination = active_list.find("ebay:PaginationResult", ns) if active_list is not None else None
        total_entries = int(pagination.findtext("ebay:TotalNumberOfEntries", "0", ns)) if pagination is not None else len(listings)
        total_pages = int(pagination.findtext("ebay:TotalNumberOfPages", "1", ns)) if pagination is not None else 1
        
        logger.info(f"✅ [RequestId: {request_id}] Retrieved {len(listings)} active listings (Page {page}/{total_pages})")
        
        # MVP: Skip GetMultipleItems for images; frontend does not use them
        # Perf: omit image API calls to reduce latency
        for listing in listings:
            # Set image fields to empty for backward compat
            listing.setdefault("picture_url", "")
            listing.setdefault("thumbnail_url", "")
            listing.setdefault("image_url", "")
        
        logger.info(f"✅ [RequestId: {request_id}] Image fetching skipped for performance (MVP optimization)")
        
        # Log image info for first listing
        if listings and len(listings) > 0:
            first_listing = listings[0]
            logger.info(f"🔍 [RequestId: {request_id}] First listing image data (Item ID: {first_listing.get('item_id', 'N/A')}):")
            logger.info(f"   picture_url: {first_listing.get('picture_url', 'MISSING')[:80] if first_listing.get('picture_url') else 'MISSING'}")
            logger.info(f"   thumbnail_url: {first_listing.get('thumbnail_url', 'MISSING')[:80] if first_listing.get('thumbnail_url') else 'MISSING'}")
            logger.info(f"   image_url: {first_listing.get('image_url', 'MISSING')[:80] if first_listing.get('image_url') else 'MISSING'}")
        
        # Save listings to DB (with supplier_id)
        t4 = datetime.utcnow()
        t4_duration = 0
        upserted_count = 0
        try:
            from .models import get_db, Listing
            from .services import upsert_listings
            from dateutil import parser
            
            db = next(get_db())
            try:
                # Convert to Listing objects
                listing_objects = []
                for listing_data in listings:
                    # Compute date_listed
                    date_listed = date.today()
                    if listing_data.get("start_time"):
                        try:
                            start_date = parser.parse(listing_data["start_time"])
                            date_listed = start_date.date()
                        except:
                            pass
                    
                    # Create Listing object (use consolidated parser)
                    from .listing_parser import parse_listing_from_data
                    listing_obj = parse_listing_from_data(listing_data, user_id, platform="eBay")
                    listing_objects.append(listing_obj)
                
                # Upsert (update on duplicate) - expected_user_id ensures user_id match
                if listing_objects:
                    upserted_count = upsert_listings(db, listing_objects, expected_user_id=user_id)
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
            # Return API response even if DB save fails
        
        # Full timeline logging
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
            "request_id": request_id  # Include requestId in response
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# Helper to start background sync
async def start_background_sync(request: Request, user_id: str):
    """Start eBay listings sync in background."""
    try:
        logger.info(f"🔄 [BG-SYNC] Starting background sync for user {user_id}")
        await sync_ebay_listings(request, user_id)
        logger.info(f"✅ [BG-SYNC] Background sync completed for user {user_id}")
    except Exception as e:
        logger.error(f"❌ [BG-SYNC] Background sync failed for user {user_id}: {e}")

@router.get("/summary")
async def get_ebay_summary(
    request: Request,
    user_id: str = Depends(get_current_user),  # Extract user_id via JWT auth
    filters: Optional[str] = Query(None, description="Optional filter JSON for low-performing calculation")
):
    """
    eBay Listings Summary (lightweight stats API).
    Fetches counts only on dashboard load:
    - Active count, low-performing count (by filter), last_sync_at, queue count.
    Optimizations: return empty when no data; indexed queries; async.
    """
    import traceback
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    
    # Validate user_id: must be valid UUID
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
            # Perf: return empty immediately when no data (quick existence check, LIMIT 1)
            from sqlalchemy import func
            has_listings = db.query(Listing).filter(
                Listing.user_id == user_id
            ).limit(1).first()
            
            if not has_listings:
                # On first load: if no data, start background sync automatically
                logger.info(f"🔄 [AUTO-SYNC] No listings found for user {user_id}, starting background sync...")
                
                # Start sync in background (no response delay); use get_running_loop() in async
                try:
                    import asyncio
                    loop = asyncio.get_running_loop()
                    # Fire-and-forget background task
                    loop.create_task(start_background_sync(request, user_id))
                    logger.info(f"✅ [AUTO-SYNC] Background sync task created for user {user_id}")
                except RuntimeError:
                    # No running loop (uncommon)
                    logger.warning(f"⚠️ [AUTO-SYNC] No running event loop found, skipping background sync")
                except Exception as bg_err:
                    logger.warning(f"⚠️ [AUTO-SYNC] Failed to start background sync: {bg_err}")
                    # Response still returned even if background task fails
                
                # Return empty immediately; background sync runs separately
                return {
                    "success": True,
                    "user_id": user_id,
                    "active_count": 0,
                    "low_performing_count": 0,
                    "queue_count": 0,
                    "last_sync_at": None,
                    "filters_applied": {},
                    "auto_sync_started": True  # For frontend notification
                }
            
            # Optimized query: use index (user_id, platform)
            active_query = db.query(Listing).filter(
                Listing.user_id == user_id,
                func.lower(Listing.platform) == func.lower("eBay")
            )
            active_count = active_query.count()
            
            # Last sync timestamp (most recent last_synced_at)
            last_listing = db.query(Listing).filter(
                Listing.user_id == user_id,
                func.lower(Listing.platform) == func.lower("eBay")
            ).order_by(Listing.last_synced_at.desc()).limit(1).first()
            
            last_sync_at = last_listing.last_synced_at.isoformat() if last_listing and last_listing.last_synced_at else None
            
            # Low-performing count (default: 7d, 0 sales, 0 watches, <=10 views); use filters if provided
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
                    
                    # Check both market_place_filter and marketplace_filter
                    marketplace_filter = parsed_filters.get("market_place_filter") or parsed_filters.get("marketplace_filter")
                    if marketplace_filter and marketplace_filter.lower() != "ebay":
                        logger.warn(f"⚠️ [SUMMARY] marketplace_filter is not 'eBay': {marketplace_filter}")
                except Exception as filter_err:
                    logger.warn(f"⚠️ [FILTER] Filter parse failed: {filter_err}")
                    pass
            
            # Add platform to filters_applied (normalize case)
            filter_params["marketplace_filter"] = "eBay"
            filter_params["platform"] = "eBay"
            
            # Low-performing: filter in DB. view_count/impressions in metrics JSONB.
            # Use date_listed, sold_qty, watch_count for simple stats
            min_days = filter_params.get("analytics_period_days", 7)
            max_sales = filter_params.get("max_sales", 0)
            max_watches = filter_params.get("max_watches", 0)
            
            # Date filter: listed at least min_days ago (before cutoff_date)
            cutoff_date = date_type.today() - timedelta(days=min_days)
            
            # Filter by date_listed, sold_qty, watch_count; view_count/impressions in metrics JSONB
            # Platform: case-insensitive
            low_performing_query = db.query(Listing).filter(
                Listing.user_id == user_id,
                func.lower(Listing.platform) == func.lower("eBay"),  # Case-insensitive
                Listing.date_listed <= cutoff_date,
                Listing.sold_qty <= max_sales,
                Listing.watch_count <= max_watches
            )
            
            low_performing_count = low_performing_query.count()
            
            # Queue count: managed on client; provide separate API if needed
            queue_count = 0
            
            # Standard validation log
            logger.info(f"[DASHBOARD] Active listings count: {active_count}.")
            
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

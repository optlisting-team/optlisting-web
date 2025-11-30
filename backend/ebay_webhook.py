"""
eBay Webhook Handler
- Marketplace Account Deletion Notification
- Challenge-Response Validation (Keysel 활성화 필수)

eBay Challenge-Response Flow:
1. eBay sends GET request with challenge_code parameter
2. Backend computes: SHA256(challenge_code + verification_token + endpoint_url)
3. Return { "challengeResponse": "<hash>" } with 200 OK

Reference: https://developer.ebay.com/marketplace-account-deletion
"""

import os
import hashlib
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import JSONResponse

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('ebay_webhook')

# Router 생성
router = APIRouter(prefix="/api/ebay", tags=["eBay Webhook"])


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
        
        # TODO: 실제 사용자 데이터 삭제 로직 구현
        # - profiles 테이블에서 ebay_user_id로 검색
        # - 관련 listings 삭제
        # - deletion_logs 기록
        
        logger.info(f"✅ Deletion notification acknowledged")
        logger.info("=" * 60)
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Deletion notification received"
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

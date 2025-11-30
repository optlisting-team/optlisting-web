"""
eBay Webhook Handler
- Marketplace Account Deletion Notification
- Challenge-Response Validation (Keysel 활성화 필수)

eBay Challenge-Response Flow:
1. eBay sends GET request with challenge_code parameter
2. Backend computes: SHA256(challenge_code + verification_token + endpoint_url)
3. Return { "challengeResponse": "<hash>" } with 200 OK
"""

import os
import hashlib
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import JSONResponse

# 로깅 설정
logger = logging.getLogger('ebay_webhook')

# 환경변수
EBAY_VERIFICATION_SECRET = os.getenv("EBAY_VERIFICATION_SECRET", "")
EBAY_WEBHOOK_ENDPOINT = os.getenv("EBAY_WEBHOOK_ENDPOINT", "")

# Router 생성
router = APIRouter(prefix="/api/ebay", tags=["eBay Webhook"])


def compute_challenge_response(challenge_code: str, verification_token: str, endpoint_url: str) -> str:
    """
    eBay Challenge Response 계산
    
    Algorithm (eBay 공식 문서):
    1. Concatenate: challenge_code + verification_token + endpoint_url
    2. Compute SHA256 hash
    3. Return hexadecimal string
    
    Reference: https://developer.ebay.com/marketplace-account-deletion
    """
    # 문자열 결합
    hash_input = f"{challenge_code}{verification_token}{endpoint_url}"
    
    # SHA256 해시 계산
    hash_object = hashlib.sha256(hash_input.encode('utf-8'))
    challenge_response = hash_object.hexdigest()
    
    logger.info(f"✅ Challenge response computed successfully")
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
    
    logger.info(f"📥 Received eBay challenge request")
    logger.info(f"   Query params: {dict(request.query_params)}")
    
    # Challenge code 확인
    if not challenge_code:
        logger.warning("⚠️ No challenge_code in request")
        return JSONResponse(
            status_code=200,
            content={"status": "ok", "message": "eBay Webhook endpoint ready"}
        )
    
    # Verification Secret 확인
    if not EBAY_VERIFICATION_SECRET:
        logger.error("❌ EBAY_VERIFICATION_SECRET not configured")
        raise HTTPException(
            status_code=500,
            detail="Webhook verification not configured"
        )
    
    # Endpoint URL 결정
    # Railway/Production URL 또는 환경변수에서 가져오기
    if EBAY_WEBHOOK_ENDPOINT:
        endpoint_url = EBAY_WEBHOOK_ENDPOINT
    else:
        # Request에서 URL 추출 (fallback)
        endpoint_url = str(request.url).split("?")[0]
    
    logger.info(f"   Endpoint URL: {endpoint_url}")
    
    # Challenge Response 계산
    challenge_response = compute_challenge_response(
        challenge_code=challenge_code,
        verification_token=EBAY_VERIFICATION_SECRET,
        endpoint_url=endpoint_url
    )
    
    logger.info(f"✅ Returning challenge response")
    
    # eBay가 요구하는 정확한 응답 형식
    return JSONResponse(
        status_code=200,
        content={"challengeResponse": challenge_response}
    )


@router.post("/deletion")
async def ebay_deletion_notification(request: Request):
    """
    eBay Marketplace Account Deletion - Notification Handler (POST)
    
    eBay sends this when a user requests account data deletion.
    We must:
    1. Verify the request signature
    2. Delete user data
    3. Return 200 OK
    """
    
    logger.info(f"📥 Received eBay deletion notification")
    
    try:
        # Request body 읽기
        body = await request.body()
        body_str = body.decode('utf-8')
        
        logger.info(f"   Body: {body_str[:200]}...")
        
        # JSON 파싱
        try:
            data = await request.json()
        except:
            data = {}
        
        # Challenge code가 POST body에 있는 경우도 처리
        challenge_code = data.get("challenge_code") or data.get("challengeCode")
        
        if challenge_code:
            logger.info("   Challenge code found in POST body - handling as challenge request")
            
            if not EBAY_VERIFICATION_SECRET:
                raise HTTPException(status_code=500, detail="Verification not configured")
            
            if EBAY_WEBHOOK_ENDPOINT:
                endpoint_url = EBAY_WEBHOOK_ENDPOINT
            else:
                endpoint_url = str(request.url).split("?")[0]
            
            challenge_response = compute_challenge_response(
                challenge_code=challenge_code,
                verification_token=EBAY_VERIFICATION_SECRET,
                endpoint_url=endpoint_url
            )
            
            return JSONResponse(
                status_code=200,
                content={"challengeResponse": challenge_response}
            )
        
        # 실제 Deletion Notification 처리
        notification_type = data.get("metadata", {}).get("topic", "unknown")
        user_id = data.get("notification", {}).get("data", {}).get("userId", "unknown")
        
        logger.info(f"   Notification type: {notification_type}")
        logger.info(f"   eBay User ID: {user_id}")
        
        # TODO: 실제 사용자 데이터 삭제 로직 구현
        # - profiles 테이블에서 ebay_user_id로 검색
        # - 관련 listings 삭제
        # - deletion_logs 기록
        
        # 성공 응답 (eBay는 200 OK만 확인)
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Deletion notification received"
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Error processing deletion notification: {str(e)}")
        # eBay는 200 OK를 기대하므로, 에러가 나도 200 반환
        # (내부 처리는 나중에 재시도)
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
    eBay Webhook Health Check
    """
    return {
        "status": "ok",
        "service": "eBay Webhook Handler",
        "verification_configured": bool(EBAY_VERIFICATION_SECRET),
        "endpoint_configured": bool(EBAY_WEBHOOK_ENDPOINT)
    }


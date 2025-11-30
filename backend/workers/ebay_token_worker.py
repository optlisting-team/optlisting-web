"""
eBay Token 자동 갱신 Worker
- 1시간마다 실행
- 만료 예정(30분 이내) 또는 만료된 Access Token을 Refresh Token으로 갱신
- 갱신된 토큰을 DB에 저장
"""

import os
import sys
import time
import logging
import requests
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

# 상위 디렉토리 import를 위한 경로 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# =====================================================
# 설정
# =====================================================

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('ebay_token_worker')

# 환경변수
DATABASE_URL = os.getenv("DATABASE_URL", "")
EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID", "")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET", "")
EBAY_ENVIRONMENT = os.getenv("EBAY_ENVIRONMENT", "PRODUCTION")  # SANDBOX or PRODUCTION
SENTRY_DSN = os.getenv("SENTRY_DSN", "")

# eBay OAuth Endpoints
EBAY_OAUTH_ENDPOINTS = {
    "SANDBOX": "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
    "PRODUCTION": "https://api.ebay.com/identity/v1/oauth2/token"
}

# Sentry 초기화 (설정된 경우)
if SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            traces_sample_rate=0.1,
            environment=os.getenv("ENVIRONMENT", "production")
        )
        logger.info("✅ Sentry initialized successfully")
    except ImportError:
        logger.warning("⚠️ sentry-sdk not installed. Error tracking disabled.")

# =====================================================
# Database 연결
# =====================================================

def get_db_engine():
    """Database 엔진 생성"""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    
    # URL 정리 (따옴표 제거)
    url = DATABASE_URL.strip('"').strip("'").lstrip('=').strip()
    
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=300
    )

def get_db_session():
    """Database 세션 생성"""
    engine = get_db_engine()
    Session = sessionmaker(bind=engine)
    return Session()

# =====================================================
# eBay OAuth API
# =====================================================

def refresh_ebay_token(refresh_token: str) -> Optional[Dict[str, Any]]:
    """
    Refresh Token을 사용하여 새로운 Access Token 획득
    
    eBay OAuth 2.0 Token Refresh Flow:
    POST https://api.ebay.com/identity/v1/oauth2/token
    
    Headers:
    - Content-Type: application/x-www-form-urlencoded
    - Authorization: Basic {base64(client_id:client_secret)}
    
    Body:
    - grant_type=refresh_token
    - refresh_token={refresh_token}
    """
    
    if not EBAY_CLIENT_ID or not EBAY_CLIENT_SECRET:
        logger.error("❌ EBAY_CLIENT_ID or EBAY_CLIENT_SECRET not configured")
        return None
    
    # OAuth Endpoint 선택
    oauth_url = EBAY_OAUTH_ENDPOINTS.get(EBAY_ENVIRONMENT, EBAY_OAUTH_ENDPOINTS["PRODUCTION"])
    
    # Basic Auth Header 생성
    credentials = f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}"
    encoded_credentials = base64.b64encode(credentials.encode()).decode()
    
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {encoded_credentials}"
    }
    
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token
    }
    
    try:
        logger.info(f"🔄 Refreshing token via {oauth_url}")
        
        response = requests.post(
            oauth_url,
            headers=headers,
            data=data,
            timeout=30
        )
        
        if response.status_code == 200:
            token_data = response.json()
            logger.info("✅ Token refreshed successfully")
            return {
                "access_token": token_data.get("access_token"),
                "refresh_token": token_data.get("refresh_token", refresh_token),  # 새 refresh token이 없으면 기존 것 유지
                "expires_in": token_data.get("expires_in", 7200),  # 기본 2시간
                "token_type": token_data.get("token_type", "Bearer")
            }
        else:
            logger.error(f"❌ Token refresh failed: {response.status_code} - {response.text}")
            
            # Sentry에 에러 보고
            if SENTRY_DSN:
                try:
                    import sentry_sdk
                    sentry_sdk.capture_message(
                        f"eBay Token refresh failed: {response.status_code}",
                        level="error"
                    )
                except:
                    pass
            
            return None
            
    except requests.exceptions.Timeout:
        logger.error("❌ Token refresh timeout")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Token refresh error: {str(e)}")
        return None

# =====================================================
# Token 갱신 로직
# =====================================================

def get_profiles_needing_refresh(session) -> list:
    """
    갱신이 필요한 프로필 조회
    - 만료 30분 전 또는 이미 만료된 토큰
    - refresh_token이 있는 프로필만
    """
    
    # 30분 후 시간 계산
    threshold_time = datetime.utcnow() + timedelta(minutes=30)
    
    query = text("""
        SELECT 
            id,
            user_id,
            ebay_access_token,
            ebay_refresh_token,
            ebay_token_expires_at,
            ebay_user_id
        FROM profiles
        WHERE 
            ebay_refresh_token IS NOT NULL
            AND ebay_refresh_token != ''
            AND (
                ebay_token_expires_at IS NULL
                OR ebay_token_expires_at < :threshold_time
            )
        ORDER BY ebay_token_expires_at ASC NULLS FIRST
        LIMIT 100
    """)
    
    result = session.execute(query, {"threshold_time": threshold_time})
    return result.fetchall()

def update_profile_token(session, user_id: str, token_data: Dict[str, Any]) -> bool:
    """
    프로필의 eBay 토큰 업데이트
    """
    
    # 만료 시간 계산
    expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 7200))
    
    query = text("""
        UPDATE profiles
        SET 
            ebay_access_token = :access_token,
            ebay_refresh_token = :refresh_token,
            ebay_token_expires_at = :expires_at,
            ebay_token_updated_at = NOW(),
            updated_at = NOW()
        WHERE user_id = :user_id
    """)
    
    try:
        session.execute(query, {
            "access_token": token_data["access_token"],
            "refresh_token": token_data["refresh_token"],
            "expires_at": expires_at,
            "user_id": user_id
        })
        session.commit()
        logger.info(f"✅ Token updated for user: {user_id[:8]}...")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to update token for user {user_id}: {str(e)}")
        session.rollback()
        return False

def mark_token_invalid(session, user_id: str, error_message: str) -> None:
    """
    토큰 갱신 실패 시 상태 기록 (선택적)
    """
    # 필요시 에러 상태를 별도 컬럼에 기록
    logger.warning(f"⚠️ Token marked as invalid for user: {user_id[:8]}... - {error_message}")

# =====================================================
# Worker 메인 로직
# =====================================================

def run_token_refresh_job():
    """
    토큰 갱신 작업 실행
    """
    logger.info("=" * 50)
    logger.info("🚀 Starting eBay Token Refresh Job")
    logger.info("=" * 50)
    
    start_time = time.time()
    
    try:
        session = get_db_session()
    except Exception as e:
        logger.error(f"❌ Failed to connect to database: {str(e)}")
        return {"success": False, "error": str(e)}
    
    stats = {
        "total_checked": 0,
        "refreshed": 0,
        "failed": 0,
        "skipped": 0
    }
    
    try:
        # 갱신 필요한 프로필 조회
        profiles = get_profiles_needing_refresh(session)
        stats["total_checked"] = len(profiles)
        
        logger.info(f"📋 Found {len(profiles)} profiles needing token refresh")
        
        for profile in profiles:
            user_id = profile.user_id
            refresh_token = profile.ebay_refresh_token
            
            if not refresh_token:
                stats["skipped"] += 1
                continue
            
            logger.info(f"🔄 Refreshing token for user: {user_id[:8]}...")
            
            # 토큰 갱신 API 호출
            token_data = refresh_ebay_token(refresh_token)
            
            if token_data and token_data.get("access_token"):
                # DB 업데이트
                if update_profile_token(session, user_id, token_data):
                    stats["refreshed"] += 1
                else:
                    stats["failed"] += 1
            else:
                stats["failed"] += 1
                mark_token_invalid(session, user_id, "Refresh token expired or invalid")
            
            # Rate limiting (eBay API 보호)
            time.sleep(0.5)
        
    except Exception as e:
        logger.error(f"❌ Job failed with error: {str(e)}")
        
        # Sentry에 에러 보고
        if SENTRY_DSN:
            try:
                import sentry_sdk
                sentry_sdk.capture_exception(e)
            except:
                pass
        
        return {"success": False, "error": str(e), "stats": stats}
    
    finally:
        session.close()
    
    elapsed_time = time.time() - start_time
    
    logger.info("=" * 50)
    logger.info(f"✅ Job completed in {elapsed_time:.2f}s")
    logger.info(f"📊 Stats: {stats}")
    logger.info("=" * 50)
    
    return {"success": True, "stats": stats, "elapsed_time": elapsed_time}

# =====================================================
# Scheduler (APScheduler 사용)
# =====================================================

def start_scheduler():
    """
    Background Scheduler 시작 (1시간마다 실행)
    """
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        
        scheduler = BlockingScheduler()
        
        # 1시간마다 실행
        scheduler.add_job(
            run_token_refresh_job,
            trigger=IntervalTrigger(hours=1),
            id='ebay_token_refresh',
            name='eBay Token Refresh Job',
            replace_existing=True,
            max_instances=1
        )
        
        logger.info("🕐 Scheduler started - Running every 1 hour")
        
        # 시작 시 즉시 한 번 실행
        run_token_refresh_job()
        
        scheduler.start()
        
    except ImportError:
        logger.error("❌ APScheduler not installed. Run: pip install apscheduler")
        # APScheduler 없으면 단일 실행
        run_token_refresh_job()

# =====================================================
# Entry Point
# =====================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='eBay Token Refresh Worker')
    parser.add_argument('--once', action='store_true', help='Run once and exit')
    parser.add_argument('--scheduler', action='store_true', help='Run with scheduler')
    args = parser.parse_args()
    
    if args.once:
        # 단일 실행
        result = run_token_refresh_job()
        print(f"Result: {result}")
    else:
        # 스케줄러로 실행
        start_scheduler()


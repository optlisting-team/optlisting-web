"""
eBay Token 자동 갱신 Worker v2.0
- 1시간마다 실행 (APScheduler)
- 만료 예정(30분 이내) 또는 만료된 Access Token을 Refresh Token으로 갱신
- 갱신된 토큰을 DB에 저장
- Retry 로직 (최대 3회)
- Sentry 에러 트래킹
- Graceful Shutdown 지원
"""

import os
import sys
import time
import signal
import logging
import requests
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from functools import wraps

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

# Worker 상태
worker_status = {
    "started_at": None,
    "last_run": None,
    "last_success": None,
    "total_runs": 0,
    "total_refreshed": 0,
    "total_failed": 0,
    "is_running": False,
    "shutdown_requested": False
}

# 환경변수
DATABASE_URL = os.getenv("DATABASE_URL", "")
EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID", "")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET", "")
EBAY_ENVIRONMENT = os.getenv("EBAY_ENVIRONMENT", "PRODUCTION")  # SANDBOX or PRODUCTION
SENTRY_DSN = os.getenv("SENTRY_DSN", "")

# Retry 설정
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 5

# eBay OAuth Endpoints
EBAY_OAUTH_ENDPOINTS = {
    "SANDBOX": "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
    "PRODUCTION": "https://api.ebay.com/identity/v1/oauth2/token"
}

# Sentry 초기화 (설정된 경우)
sentry_initialized = False
if SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            traces_sample_rate=0.1,
            environment=os.getenv("ENVIRONMENT", "production"),
            release=os.getenv("RAILWAY_GIT_COMMIT_SHA", "unknown")
        )
        sentry_initialized = True
        logger.info("✅ Sentry initialized successfully")
    except ImportError:
        logger.warning("⚠️ sentry-sdk not installed. Error tracking disabled.")


# =====================================================
# Graceful Shutdown
# =====================================================

def signal_handler(signum, frame):
    """시그널 핸들러 - Graceful Shutdown"""
    logger.info(f"🛑 Received signal {signum}. Initiating graceful shutdown...")
    worker_status["shutdown_requested"] = True

# SIGTERM, SIGINT 핸들러 등록
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


# =====================================================
# Retry Decorator
# =====================================================

def retry_with_backoff(max_retries: int = MAX_RETRIES, delay: int = RETRY_DELAY_SECONDS):
    """Retry decorator with exponential backoff"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    wait_time = delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"⚠️ Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                    logger.info(f"⏳ Waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
            
            logger.error(f"❌ All {max_retries} attempts failed")
            raise last_exception
        return wrapper
    return decorator

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

class TokenRefreshError(Exception):
    """Token 갱신 실패 예외"""
    def __init__(self, message: str, status_code: int = None, is_retryable: bool = True):
        self.message = message
        self.status_code = status_code
        self.is_retryable = is_retryable
        super().__init__(self.message)


@retry_with_backoff(max_retries=3, delay=5)
def refresh_ebay_token(refresh_token: str) -> Dict[str, Any]:
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
    
    Raises:
        TokenRefreshError: 토큰 갱신 실패 시
    """
    
    # 동적으로 환경변수 로드 (Railway 변경 반영)
    client_id = os.getenv("EBAY_CLIENT_ID", EBAY_CLIENT_ID)
    client_secret = os.getenv("EBAY_CLIENT_SECRET", EBAY_CLIENT_SECRET)
    
    if not client_id or not client_secret:
        raise TokenRefreshError(
            "EBAY_CLIENT_ID or EBAY_CLIENT_SECRET not configured",
            is_retryable=False
        )
    
    # OAuth Endpoint 선택
    oauth_url = EBAY_OAUTH_ENDPOINTS.get(EBAY_ENVIRONMENT, EBAY_OAUTH_ENDPOINTS["PRODUCTION"])
    
    # Basic Auth Header 생성
    credentials = f"{client_id}:{client_secret}"
    encoded_credentials = base64.b64encode(credentials.encode()).decode()
    
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {encoded_credentials}"
    }
    
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token
    }
    
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
            "refresh_token": token_data.get("refresh_token", refresh_token),
            "expires_in": token_data.get("expires_in", 7200),
            "token_type": token_data.get("token_type", "Bearer")
        }
    
    # 에러 처리
    error_msg = f"Token refresh failed: {response.status_code} - {response.text[:200]}"
    logger.error(f"❌ {error_msg}")
    
    # Sentry 에러 보고
    if sentry_initialized:
        try:
            import sentry_sdk
            sentry_sdk.capture_message(error_msg, level="error")
        except:
            pass
    
    # 400/401은 재시도 불가 (잘못된 토큰)
    is_retryable = response.status_code >= 500
    raise TokenRefreshError(error_msg, response.status_code, is_retryable)

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

def run_token_refresh_job() -> Dict[str, Any]:
    """
    토큰 갱신 작업 실행
    
    Returns:
        Dict with success status, stats, and elapsed time
    """
    global worker_status
    
    # Shutdown 요청 확인
    if worker_status["shutdown_requested"]:
        logger.info("🛑 Shutdown requested. Skipping job.")
        return {"success": False, "error": "Shutdown requested"}
    
    worker_status["is_running"] = True
    worker_status["last_run"] = datetime.utcnow().isoformat()
    worker_status["total_runs"] += 1
    
    logger.info("=" * 50)
    logger.info("🚀 Starting eBay Token Refresh Job")
    logger.info(f"📅 Run #{worker_status['total_runs']}")
    logger.info("=" * 50)
    
    start_time = time.time()
    
    try:
        session = get_db_session()
    except Exception as e:
        logger.error(f"❌ Failed to connect to database: {str(e)}")
        worker_status["is_running"] = False
        return {"success": False, "error": str(e)}
    
    stats = {
        "total_checked": 0,
        "refreshed": 0,
        "failed": 0,
        "skipped": 0,
        "errors": []
    }
    
    try:
        # 갱신 필요한 프로필 조회
        profiles = get_profiles_needing_refresh(session)
        stats["total_checked"] = len(profiles)
        
        logger.info(f"📋 Found {len(profiles)} profiles needing token refresh")
        
        for profile in profiles:
            # Shutdown 확인 (루프 중간에도)
            if worker_status["shutdown_requested"]:
                logger.info("🛑 Shutdown requested. Stopping job.")
                break
            
            user_id = profile.user_id
            refresh_token = profile.ebay_refresh_token
            
            if not refresh_token:
                stats["skipped"] += 1
                continue
            
            logger.info(f"🔄 Refreshing token for user: {user_id[:8]}...")
            
            try:
                # 토큰 갱신 API 호출 (retry 포함)
                token_data = refresh_ebay_token(refresh_token)
                
                if token_data and token_data.get("access_token"):
                    # DB 업데이트
                    if update_profile_token(session, user_id, token_data):
                        stats["refreshed"] += 1
                        worker_status["total_refreshed"] += 1
                    else:
                        stats["failed"] += 1
                        worker_status["total_failed"] += 1
                else:
                    stats["failed"] += 1
                    worker_status["total_failed"] += 1
                    
            except TokenRefreshError as e:
                stats["failed"] += 1
                worker_status["total_failed"] += 1
                stats["errors"].append({
                    "user_id": user_id[:8] + "...",
                    "error": str(e),
                    "retryable": e.is_retryable
                })
                
                if not e.is_retryable:
                    mark_token_invalid(session, user_id, str(e))
                    
            except Exception as e:
                stats["failed"] += 1
                worker_status["total_failed"] += 1
                logger.error(f"❌ Unexpected error for user {user_id[:8]}: {str(e)}")
            
            # Rate limiting (eBay API 보호)
            time.sleep(0.5)
        
        worker_status["last_success"] = datetime.utcnow().isoformat()
        
    except Exception as e:
        logger.error(f"❌ Job failed with error: {str(e)}")
        
        # Sentry에 에러 보고
        if sentry_initialized:
            try:
                import sentry_sdk
                sentry_sdk.capture_exception(e)
            except:
                pass
        
        worker_status["is_running"] = False
        return {"success": False, "error": str(e), "stats": stats}
    
    finally:
        session.close()
        worker_status["is_running"] = False
    
    elapsed_time = time.time() - start_time
    
    logger.info("=" * 50)
    logger.info(f"✅ Job completed in {elapsed_time:.2f}s")
    logger.info(f"📊 Stats: {stats}")
    logger.info("=" * 50)
    
    return {"success": True, "stats": stats, "elapsed_time": elapsed_time}

# =====================================================
# Worker Status API (FastAPI에서 호출 가능)
# =====================================================

def get_worker_status() -> Dict[str, Any]:
    """
    Worker 상태 반환 (Health Check용)
    """
    return {
        **worker_status,
        "environment": EBAY_ENVIRONMENT,
        "database_configured": bool(DATABASE_URL),
        "ebay_configured": bool(EBAY_CLIENT_ID and EBAY_CLIENT_SECRET),
        "sentry_configured": sentry_initialized
    }


# =====================================================
# Scheduler (APScheduler 사용)
# =====================================================

def start_scheduler():
    """
    Background Scheduler 시작 (1시간마다 실행)
    """
    global worker_status
    worker_status["started_at"] = datetime.utcnow().isoformat()
    
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
            max_instances=1,
            misfire_grace_time=300  # 5분 지연까지 허용
        )
        
        logger.info("=" * 50)
        logger.info("🚀 eBay Token Worker Started")
        logger.info(f"📍 Environment: {EBAY_ENVIRONMENT}")
        logger.info(f"🔗 Database: {'✅ Configured' if DATABASE_URL else '❌ Not configured'}")
        logger.info(f"🔑 eBay API: {'✅ Configured' if EBAY_CLIENT_ID else '❌ Not configured'}")
        logger.info(f"📊 Sentry: {'✅ Enabled' if sentry_initialized else '❌ Disabled'}")
        logger.info("🕐 Schedule: Every 1 hour")
        logger.info("=" * 50)
        
        # 시작 시 즉시 한 번 실행
        run_token_refresh_job()
        
        # Graceful shutdown 처리
        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            logger.info("🛑 Scheduler stopped by signal")
            scheduler.shutdown(wait=True)
        
    except ImportError:
        logger.error("❌ APScheduler not installed. Run: pip install apscheduler")
        # APScheduler 없으면 단일 실행
        run_token_refresh_job()


def start_simple_loop():
    """
    APScheduler 없이 간단한 무한 루프로 실행
    (Railway/Heroku 등에서 APScheduler 문제 시 대안)
    """
    global worker_status
    worker_status["started_at"] = datetime.utcnow().isoformat()
    
    INTERVAL_SECONDS = 3600  # 1시간
    
    logger.info("=" * 50)
    logger.info("🚀 eBay Token Worker Started (Simple Loop Mode)")
    logger.info(f"📍 Environment: {EBAY_ENVIRONMENT}")
    logger.info(f"🕐 Interval: {INTERVAL_SECONDS}s")
    logger.info("=" * 50)
    
    while not worker_status["shutdown_requested"]:
        try:
            run_token_refresh_job()
        except Exception as e:
            logger.error(f"❌ Job error: {str(e)}")
            if sentry_initialized:
                import sentry_sdk
                sentry_sdk.capture_exception(e)
        
        # 다음 실행까지 대기 (중간에 shutdown 확인)
        for _ in range(INTERVAL_SECONDS):
            if worker_status["shutdown_requested"]:
                break
            time.sleep(1)
    
    logger.info("🛑 Worker shutdown complete")


# =====================================================
# Entry Point
# =====================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='eBay Token Refresh Worker')
    parser.add_argument('--once', action='store_true', help='Run once and exit')
    parser.add_argument('--scheduler', action='store_true', help='Run with APScheduler')
    parser.add_argument('--loop', action='store_true', help='Run with simple loop (no APScheduler)')
    parser.add_argument('--status', action='store_true', help='Show worker status')
    args = parser.parse_args()
    
    if args.status:
        import json
        print(json.dumps(get_worker_status(), indent=2))
    elif args.once:
        # 단일 실행
        result = run_token_refresh_job()
        print(f"Result: {result}")
    elif args.loop:
        # Simple loop 모드
        start_simple_loop()
    else:
        # 스케줄러로 실행 (기본)
        start_scheduler()


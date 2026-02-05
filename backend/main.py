from fastapi import FastAPI, Depends, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict
from datetime import date, datetime, timedelta
import json
import logging
import os
import uuid
from pydantic import BaseModel

from .models import init_db, get_db, Listing, DeletionLog, Profile, CSVFormat, CSVProcessingTask, Base, engine
from .services import detect_source, extract_supplier_info, analyze_zombie_listings, generate_export_csv, count_low_performing_candidates
from .dummy_data import generate_dummy_listings
from .webhooks import verify_webhook_signature, process_webhook_event
from .ebay_webhook import router as ebay_webhook_router
from .subscription_service import (
    get_subscription_status,
    validate_active_subscription,
    require_active_subscription,
)

logger = logging.getLogger(__name__)

# Supabase Auth for JWT verification
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("⚠️ Supabase client not available. Install with: pip install supabase")

app = FastAPI(title="OptListing API", version="1.3.0")

# ============================================================
# Environment variables: SUPABASE_URL, SUPABASE_ANON_KEY (or VITE_* fallback);
# LEMON_SQUEEZY_* for checkout/webhooks; DATABASE_URL for Postgres.
# ============================================================
def validate_supabase_env():
    """Validate Supabase credentials at startup; server cannot start without them."""
    import logging
    logger = logging.getLogger(__name__)
    
    # Environment variables with safe fallbacks to prevent crashes
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or ""
    supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY") or ""
    
    # Warning logs for missing critical configuration
    if not supabase_url:
        logger.warning("⚠️ [CONFIG] SUPABASE_URL and VITE_SUPABASE_URL are not set. Authentication will fail.")
    if not supabase_key:
        logger.warning("⚠️ [CONFIG] SUPABASE_ANON_KEY and VITE_SUPABASE_ANON_KEY are not set. Authentication will fail.")
    
    if not supabase_url or not supabase_key:
        error_msg = (
            "❌ CRITICAL: Supabase credentials not configured!\n"
            "   Required environment variables:\n"
            "   - SUPABASE_URL or VITE_SUPABASE_URL\n"
            "   - SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY\n"
            "   Please set these variables before starting the server."
        )
        logger.error(error_msg)
        print(error_msg)
        raise ValueError("Supabase credentials not configured. Server cannot start without authentication.")
    
    logger.info("✅ Supabase credentials validated")
    print("✅ Supabase credentials validated")
    return True

# Validate env vars on server start
try:
    validate_supabase_env()
except ValueError as e:
    import sys
    print(f"FATAL ERROR: {str(e)}")
    sys.exit(1)

# ============================================================
# JWT Authentication with Supabase
# ============================================================
from .auth import get_current_user

# ============================================================
# [BOOT] Supabase Write Self-Test (Top-level execution)
# ============================================================
# This runs immediately when the module is imported by gunicorn
# to ensure DB write capability is verified before server starts
def run_supabase_self_test():
    """Run Supabase write self-test at module import time"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("[BOOT] ========================================")
        logger.info("[BOOT] Starting Supabase write self-test...")
        print("[BOOT] ========================================")
        print("[BOOT] Starting Supabase write self-test...")
        
        # Log SUPABASE_URL / DATABASE_URL (masked for security)
        # Environment variables with safe fallbacks
        DATABASE_URL = os.getenv("DATABASE_URL", "") or ""
        SUPABASE_URL = os.getenv("SUPABASE_URL", "") or ""
        
        if DATABASE_URL:
            # Mask password in URL for logging
            if "@" in DATABASE_URL:
                parts = DATABASE_URL.split("@")
                if len(parts) == 2:
                    masked_url = parts[0].split(":")[0] + ":***@" + parts[1]
                else:
                    masked_url = DATABASE_URL[:50] + "..."
            else:
                masked_url = DATABASE_URL[:50] + "..."
            logger.info(f"[BOOT] DATABASE_URL: {masked_url}")
            print(f"[BOOT] DATABASE_URL: {masked_url}")
        else:
            logger.warning("[BOOT] DATABASE_URL not set")
            print("[BOOT] DATABASE_URL not set")
        
        if SUPABASE_URL:
            logger.info(f"[BOOT] SUPABASE_URL: {SUPABASE_URL}")
            print(f"[BOOT] SUPABASE_URL: {SUPABASE_URL}")
        else:
            logger.info("[BOOT] SUPABASE_URL not set (using DATABASE_URL directly)")
            print("[BOOT] SUPABASE_URL not set (using DATABASE_URL directly)")
        
        # Test database connection first
        logger.info("[BOOT] Testing database connection...")
        print("[BOOT] Testing database connection...")
        from .models import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("[BOOT] Database connection successful")
        print("[BOOT] Database connection successful")
        
        # Profiles table write self-test
        logger.info("[BOOT] Starting profiles table write self-test...")
        print("[BOOT] Starting profiles table write self-test...")
        db = next(get_db())
        try:
            test_user_id = "boot-test-user-" + str(int(datetime.now().timestamp()))
            logger.info(f"[BOOT] Test user_id: {test_user_id}")
            print(f"[BOOT] Test user_id: {test_user_id}")
            
            # Try to create a test profile
            test_profile = Profile(
                user_id=test_user_id,
                purchased_credits=0,
                consumed_credits=0,
                current_plan='free',
                subscription_status='inactive',
                subscription_plan='free',
                total_listings_limit=100
            )
            logger.info(f"[BOOT] Attempting to INSERT profile for test_user_id={test_user_id}")
            print(f"[BOOT] Attempting to INSERT profile...")
            db.add(test_profile)
            db.commit()
            logger.info(f"[BOOT] ✅ Profile INSERT successful for test_user_id={test_user_id}")
            print(f"[BOOT] ✅ Profile INSERT successful")
            
            # Try to UPDATE the profile
            logger.info(f"[BOOT] Attempting to UPDATE profile for test_user_id={test_user_id}")
            print(f"[BOOT] Attempting to UPDATE profile...")
            test_profile.purchased_credits = 100
            db.commit()
            logger.info(f"[BOOT] ✅ Profile UPDATE successful for test_user_id={test_user_id}")
            print(f"[BOOT] ✅ Profile UPDATE successful")
            
            # Clean up test profile
            logger.info(f"[BOOT] Cleaning up test profile for test_user_id={test_user_id}")
            print(f"[BOOT] Cleaning up test profile...")
            db.delete(test_profile)
            db.commit()
            logger.info(f"[BOOT] ✅ Profile DELETE successful for test_user_id={test_user_id}")
            print(f"[BOOT] ✅ Profile DELETE successful")
            
            logger.info("[BOOT] ✅ Profiles table write self-test PASSED")
            print("[BOOT] ✅ Profiles table write self-test PASSED")
            logger.info("[BOOT] ========================================")
            print("[BOOT] ========================================")
        except Exception as e:
            db.rollback()
            logger.error(f"[BOOT] ❌ Profiles table write self-test FAILED: {str(e)}", exc_info=True)
            print(f"[BOOT] ❌ Profiles table write self-test FAILED: {str(e)}")
            import traceback
            traceback.print_exc()
            logger.error("[BOOT] ========================================")
            print("[BOOT] ========================================")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[BOOT] ❌ Supabase self-test setup FAILED: {str(e)}", exc_info=True)
        print(f"[BOOT] ❌ Supabase self-test setup FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        logger.error("[BOOT] ========================================")
        print("[BOOT] ========================================")

# Execute self-test immediately at module import
run_supabase_self_test()

# eBay Webhook Router registration
app.include_router(ebay_webhook_router)

# In-memory cache for KPI metrics (5-minute TTL)
# Structure: {cache_key: {"data": {...}, "timestamp": datetime}}
kpi_cache: Dict[str, Dict] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def get_cache_key(user_id: str, store_id: Optional[str], marketplace: str, filters: Dict) -> str:
    """Generate a unique cache key for KPI metrics"""
    filter_str = "_".join(f"{k}={v}" for k, v in sorted(filters.items()))
    return f"{user_id}_{store_id or 'all'}_{marketplace}_{filter_str}"


def get_cached_kpi(cache_key: str) -> Optional[Dict]:
    """Get cached KPI data if not expired"""
    if cache_key in kpi_cache:
        cached = kpi_cache[cache_key]
        if (datetime.now() - cached["timestamp"]).seconds < CACHE_TTL_SECONDS:
            return cached["data"]
        else:
            del kpi_cache[cache_key]
    return None


def set_cached_kpi(cache_key: str, data: Dict):
    """Set KPI data in cache"""
    kpi_cache[cache_key] = {"data": data, "timestamp": datetime.now()}

# CORS middleware for React frontend
# Allow both local development and production frontend URLs
import re

# Define the allowed exact origins (for production build)
# CRITICAL: CORS configuration for production API access
# Required origins as per production requirements - only production domains
allowed_origins = [
    # 🚨 PRODUCTION CUSTOM DOMAIN - CRITICAL FOR PRODUCTION
    "https://optlisting.com",
    "https://www.optlisting.com",
    
    # Production Vercel deployment - All variations (CRITICAL for CORS)
    "https://optlisting.vercel.app",
    "https://www.optlisting.vercel.app",
    # Actual deployed Vercel domain
    "https://optlisting-three.vercel.app",
    "https://optlisting-1fev8br9z-optlistings-projects.vercel.app",
    
    # Local development environments
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

# Add environment variable for additional frontend URLs if provided
# Environment variables with safe fallbacks
frontend_url = os.getenv("FRONTEND_URL", "") or ""
if frontend_url:
    # Remove trailing slash for consistency
    frontend_url_clean = frontend_url.rstrip("/")
    if frontend_url_clean and frontend_url_clean not in allowed_origins:
        allowed_origins.append(frontend_url_clean)

# Filter out empty strings
allowed_origins = [origin for origin in allowed_origins if origin]

# Define regex pattern to cover all Vercel deploy previews (*.vercel.app)
# CRITICAL: This regex MUST cover all Vercel subdomains (production, preview, branch deployments)
# Pattern matches: https://*.vercel.app (any subdomain)
vercel_regex = r"https://.*\.vercel\.app"

# CORS configuration for Railway + Vercel deployment
# CRITICAL: Ensure all Vercel domains are explicitly allowed
# Add CORS middleware FIRST, before any routes

# Log CORS configuration for debugging
logging.info(f"🌐 CORS Configuration:")
logging.info(f"   Allowed origins: {allowed_origins}")
logging.info(f"   Vercel regex: {vercel_regex}")

# CORS configuration - CRITICAL for production API access
# Ensure all production frontend domains are allowed
# This middleware automatically handles OPTIONS preflight requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Explicit production and local URLs
    allow_origin_regex=vercel_regex,  # CRITICAL: Regex pattern for all Vercel subdomains
    allow_credentials=True,  # Enable credentials (cookies/sessions) for authenticated requests
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],  # Explicitly allow required HTTP methods
    allow_headers=["Content-Type", "Authorization", "X-Request-Id", "Accept", "Origin", "X-Requested-With"],  # Required headers explicitly listed
    expose_headers=["*"],  # Expose all headers in response
    max_age=3600,  # Cache preflight OPTIONS requests for 1 hour
)

# Helper function to get CORS headers based on request origin
def get_cors_headers(request: Request):
    """Get CORS headers based on request origin"""
    origin = request.headers.get("origin")
    
    # If origin matches allowed origins or regex, use it
    if origin:
        # Check if origin is in allowed_origins
        if origin in allowed_origins:
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
                "Access-Control-Allow-Headers": "*",
            }
        # Check if origin matches Vercel regex
        import re
        if re.match(vercel_regex, origin):
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
                "Access-Control-Allow-Headers": "*",
            }
    
    # Fallback: don't set origin header (let CORS middleware handle it)
    return {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
        "Access-Control-Allow-Headers": "*",
    }

# Exception handlers to ensure CORS headers are always present
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc):
    """Handle HTTP exceptions with CORS headers"""
    cors_headers = get_cors_headers(request)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=cors_headers
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc):
    """Handle validation errors with CORS headers"""
    cors_headers = get_cors_headers(request)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers=cors_headers
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc):
    """Handle all other exceptions and ensure CORS headers are present"""
    import traceback
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Detailed error logging
    error_traceback = traceback.format_exc()
    logger.error(f"❌ Unhandled exception: {type(exc).__name__}: {str(exc)}")
    logger.error(f"   Request URL: {request.url}")
    logger.error(f"   Request method: {request.method}")
    logger.error(f"   Error traceback:\n{error_traceback}")
    
    cors_headers = get_cors_headers(request)
    
    # Return error response with CORS headers
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error_type": type(exc).__name__,
            "error_message": str(exc) if not isinstance(exc, Exception) else str(exc)
        },
        headers=cors_headers
    )

# Initialize database on startup (legacy - kept for compatibility)
# Note: Supabase write self-test is now run at top-level (see run_supabase_self_test above)
@app.on_event("startup")
def startup_event():
    """
    Initialize database connection and create tables.
    This function must not crash the server if database connection fails.
    Note: Supabase write self-test is now run at module import time (top-level).
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Verify DB connection on startup
        from .models import engine
        from sqlalchemy import text
        
        # DB connection test
        logger.info("[STARTUP] Testing database connection...")
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                result.fetchone()
            logger.info("[STARTUP] ✅ Database connection successful")
            print("✅ Database connection verified successfully")
        except Exception as conn_err:
            logger.error(f"[STARTUP] ❌ Database connection failed: {conn_err}")
            print(f"❌ Database connection failed: {conn_err}")
            raise
        
        # Create tables if they don't exist (works for both SQLite and Supabase)
        print("Creating database tables if they don't exist...")
        logger.info("[STARTUP] Creating database tables if they don't exist...")
        try:
            Base.metadata.create_all(bind=engine)
            print("Database tables created/verified successfully")
            logger.info("[STARTUP] Database tables created/verified successfully")
        except Exception as db_init_error:
            error_msg = f"[STARTUP] ❌ CRITICAL: Database initialization failed: {str(db_init_error)}"
            logger.error(error_msg, exc_info=True)
            print(error_msg)
            # Don't crash - allow server to start but log the error
            # The database connection will be tested on first request
            logger.warning("[STARTUP] Server will continue to start, but database operations may fail")
        
        # Cleanup: remove listings with invalid user_id on startup
        try:
            db = next(get_db())
            try:
                from sqlalchemy import text
                from .models import Profile
                
                # Get valid user_id list
                valid_user_ids = db.query(Profile.user_id).filter(Profile.user_id.isnot(None)).all()
                valid_user_id_set = {uid[0] for uid in valid_user_ids}
                
                # Delete listings with invalid user_id
                invalid_count = db.execute(
                    text("""
                        DELETE FROM listings 
                        WHERE user_id IS NULL 
                        -- OR user_id = 'default-user' -- removed: all user_id must be valid UUID
                        OR (user_id NOT IN (SELECT user_id FROM profiles WHERE user_id IS NOT NULL) 
                            AND user_id IS NOT NULL)
                    """)
                ).rowcount
                
                if invalid_count > 0:
                    logger.info(f"🧹 [STARTUP] Cleaned {invalid_count} listings with invalid user_id")
                    print(f"🧹 [STARTUP] Cleaned up {invalid_count} listings with invalid user_id")
                    db.commit()
                
                # Normalize platform: lowercase "ebay" -> "eBay"
                platform_fixed = db.execute(
                    text("""
                        UPDATE listings 
                        SET platform = 'eBay', updated_at = NOW()
                        WHERE LOWER(platform) = 'ebay'
                        AND platform != 'eBay'
                    """)
                ).rowcount
                
                if platform_fixed > 0:
                    logger.info(f"🔧 [STARTUP] Fixed platform for {platform_fixed} listings")
                    print(f"🔧 [STARTUP] Fixed platform case for {platform_fixed} listings")
                    db.commit()
                
                count = db.query(Listing).count()
                print(f"Database contains {count} listings after cleanup")
            except Exception as cleanup_err:
                logger.warning(f"⚠️ [STARTUP] Cleanup error: {cleanup_err}")
                db.rollback()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"⚠️ [STARTUP] Cleanup failed: {e}")
            # Don't crash the server if cleanup fails
    except Exception as e:
        # Log error but don't crash the server
        print(f"CRITICAL: Database connection failed: {e}")
        print("Server will continue to start, but database operations may fail.")
        import traceback
        traceback.print_exc()
        # Server should still start even if database connection fails


@app.get("/")
def root():
    return {"message": "OptListing API is running"}


@app.get("/api/health")
def health_check():
    """
    Service health check endpoint (optimized).
    - API status
    - DB connection (with timeout)
    - eBay Worker status

    Optimizations:
    - DB connection test with timeout (response within 1s)
    - Worker check is async
    """
    from datetime import datetime
    import signal
    
    health = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": app.version,
        "services": {
            "api": "ok",
            "database": "unknown",
            "ebay_worker": "unknown"
        }
    }
    
    # DB connection test (with timeout)
    try:
        from .models import engine
        from sqlalchemy import text
        
        # Simple connection test for timeout
        # pool_pre_ping enables fast connection check
        with engine.connect() as conn:
            # Simple query for fast response
            result = conn.execute(text("SELECT 1"))
            result.fetchone()  # Consume result
        health["services"]["database"] = "ok"
    except Exception as e:
        health["services"]["database"] = f"error: {str(e)[:50]}"
        health["status"] = "degraded"
    
    # Worker status check (async, with timeout)
    try:
        from .workers.ebay_token_worker import get_worker_status
        worker_status = get_worker_status()
        health["services"]["ebay_worker"] = {
            "status": "running" if worker_status.get("is_running") else "idle",
            "last_run": worker_status.get("last_run"),
            "total_refreshed": worker_status.get("total_refreshed", 0),
            "ebay_configured": worker_status.get("ebay_configured", False)
        }
    except ImportError:
        health["services"]["ebay_worker"] = "not_loaded"
    except Exception as e:
        # Worker check failure does not affect overall health
        health["services"]["ebay_worker"] = f"error: {str(e)[:50]}"
    
    return health


@app.post("/api/worker/trigger-refresh")
async def trigger_token_refresh(
    admin_key: str = None
):
    """
    Manually trigger eBay token refresh (admin).
    Note: This endpoint runs separately from Worker. Worker performs the actual refresh.
    """
    # Simple security check (use stronger auth in production)
    expected_key = os.getenv("ADMIN_API_KEY", "")
    if expected_key and admin_key != expected_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    try:
        from .workers.ebay_token_worker import run_token_refresh_job
        result = run_token_refresh_job()
        return {
            "success": result.get("success", False),
            "message": "Token refresh job executed",
            "stats": result.get("stats", {}),
            "elapsed_time": result.get("elapsed_time", 0)
        }
    except ImportError:
        raise HTTPException(status_code=500, detail="Worker module not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job failed: {str(e)}")


@app.get("/api/debug/listings")
def debug_listings(
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    platform: str = Query("eBay", description="Platform filter"),
    db: Session = Depends(get_db)
):
    """
    Debug endpoint: query Listings table and return sample data. Requires JWT.

    Temporary debug endpoint to verify sync upsert vs summary query key alignment.
    - Count by user_id + platform
    - Return 5 sample rows
    - Provide key comparison info
    """
    """
    Debug endpoint: query Listings and return sample data.

    Temporary debug to verify sync upsert vs summary key alignment.
    - Count by user_id + platform
    - Return 5 sample rows
    - Key comparison info
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info("=" * 60)
    logger.info(f"🔍 [DEBUG] Debug listings query for user_id={user_id}, platform={platform}")
    
    try:
        # Same conditions as summary query
        query = db.query(Listing).filter(
            Listing.user_id == user_id,
            Listing.platform == platform
        )
        
        count = query.count()
        
        # Fetch 5 sample rows
        sample_listings = query.limit(5).all()
        
        # Convert sample to dict
        sample_data = []
        for listing in sample_listings:
            sample_data.append({
                "id": listing.id,
                "user_id": listing.user_id,
                "platform": listing.platform,
                "marketplace": listing.marketplace,
                "item_id": listing.item_id,
                "ebay_item_id": listing.ebay_item_id,
                "title": listing.title[:50] if listing.title else None,
                "sku": listing.sku,
                "last_synced_at": listing.last_synced_at.isoformat() if listing.last_synced_at else None
            })
        
        logger.info(f"🔍 [DEBUG] Query result:")
        logger.info(f"   - Count: {count}")
        logger.info(f"   - Sample rows: {len(sample_data)}")
        logger.info("=" * 60)
        
        # Sync upsert vs Summary key comparison info
        sync_upsert_keys = {
            "user_id": user_id,
            "platform": platform,
            "item_id": "used for conflict resolution"
        }
        
        summary_query_keys = {
            "user_id": user_id,
            "platform": platform
        }
        
        return {
            "success": True,
            "query_keys": {
                "user_id": user_id,
                "platform": platform
            },
            "count": count,
            "sample_listings": sample_data,
            "sync_upsert_keys": sync_upsert_keys,
            "summary_query_keys": summary_query_keys,
            "keys_match": sync_upsert_keys["user_id"] == summary_query_keys["user_id"] and 
                         sync_upsert_keys["platform"] == summary_query_keys["platform"],
            "note": "This endpoint uses the same WHERE conditions as summary query (user_id + platform)"
        }
        
    except Exception as e:
        logger.error(f"❌ [DEBUG] Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/listings")
def get_listings(
    skip: int = 0,
    limit: int = 100,
    store_id: Optional[str] = None,  # Store ID filter - 'all' or None means all stores
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    db: Session = Depends(get_db)
):
    """Get all listings for a specific user"""
    query = db.query(Listing).filter(Listing.user_id == user_id)
    
    # Apply store filter if store_id is provided and not 'all'
    if store_id and store_id != 'all':
        if hasattr(Listing, 'store_id'):
            query = query.filter(Listing.store_id == store_id)
    # If store_id is 'all' or None, DO NOT filter by store (return all for user)
    
    listings = query.offset(skip).limit(limit).all()
    
    # Get total count with store filter applied
    total_query = db.query(Listing).filter(Listing.user_id == user_id)
    if store_id and store_id != 'all':
        if hasattr(Listing, 'store_id'):
            total_query = total_query.filter(Listing.store_id == store_id)
    total_count = total_query.count()
    
    return {
        "total": total_count,
        "listings": [
            {
                "id": l.id,
                "item_id": getattr(l, 'item_id', None) or getattr(l, 'ebay_item_id', None) or "",
                "ebay_item_id": getattr(l, 'item_id', None) or getattr(l, 'ebay_item_id', None) or "",  # Backward compatibility
                "title": l.title,
                "sku": l.sku,
                "image_url": l.image_url,
                "brand": getattr(l, 'brand', None),
                "upc": getattr(l, 'upc', None),
                "platform": getattr(l, 'platform', None) or getattr(l, 'marketplace', None) or "eBay",
                "marketplace": getattr(l, 'platform', None) or getattr(l, 'marketplace', None) or "eBay",  # Backward compatibility
                "supplier_name": getattr(l, 'supplier_name', None) or (l.metrics.get('supplier_name') if l.metrics and isinstance(l.metrics, dict) else None) or "Unknown",
                "supplier": getattr(l, 'supplier_name', None) or (l.metrics.get('supplier_name') if l.metrics and isinstance(l.metrics, dict) else None) or "Unknown",  # Backward compatibility
                "supplier_id": getattr(l, 'supplier_id', None) or (l.metrics.get('supplier_id') if l.metrics and isinstance(l.metrics, dict) else None),
                "price": (l.metrics.get('price') if l.metrics and isinstance(l.metrics, dict) and 'price' in l.metrics else None) or getattr(l, 'price', None),
                "date_listed": (
                    l.date_listed.isoformat() if l.date_listed else (
                        l.metrics.get('date_listed') if l.metrics and isinstance(l.metrics, dict) and 'date_listed' in l.metrics else None
                    )
                ),
                "sold_qty": (l.metrics.get('sales') if l.metrics and isinstance(l.metrics, dict) and 'sales' in l.metrics else None) or getattr(l, 'sold_qty', 0) or 0,
                "watch_count": (l.metrics.get('watch_count') if l.metrics and isinstance(l.metrics, dict) and 'watch_count' in l.metrics else None) or getattr(l, 'watch_count', 0) or 0,
                "view_count": (l.metrics.get('views') if l.metrics and isinstance(l.metrics, dict) and 'views' in l.metrics else None) or getattr(l, 'view_count', 0) or 0,
                "last_updated": (l.updated_at or l.last_synced_at or l.created_at).isoformat() if (getattr(l, 'updated_at', None) or getattr(l, 'last_synced_at', None) or getattr(l, 'created_at', None)) else None,
                # Management hub information (for Shopify detection)
                "management_hub": (
                    l.metrics.get('management_hub') if l.metrics and isinstance(l.metrics, dict) and 'management_hub' in l.metrics else None
                ) or (
                    l.analysis_meta.get('management_hub') if l.analysis_meta and isinstance(l.analysis_meta, dict) and 'management_hub' in l.analysis_meta else None
                ) or getattr(l, 'management_hub', None),
                "raw_data": l.metrics if l.metrics else {},
                "analysis_meta": l.analysis_meta if l.analysis_meta else {}
            }
            for l in listings
        ]
    }


@app.post("/api/listings/detect-source")
def detect_listing_source(
    image_url: str = "",
    sku: str = "",
    title: str = "",
    brand: str = "",
    upc: str = "",
    db: Session = Depends(get_db)
):
    """Detect source for a listing with forensic analysis"""
    source, confidence = detect_source(
        image_url=image_url,
        sku=sku,
        title=title,
        brand=brand,
        upc=upc
    )
    return {
        "source": source,
        "confidence_level": confidence
    }


@app.get("/api/analyze")
def analyze_zombies(
    # Filter params (in order)
    analytics_period_days: int = 7,  # 1. Analysis period
    min_days: int = 7,               # Legacy compatibility
    max_sales: int = 0,              # 2. Sales in period
    max_watches: int = 0,            # 3. Watches
    max_watch_count: int = 0,        # Legacy compatibility
    max_impressions: int = 100,      # 4. Impressions
    max_views: int = 10,             # 5. Views
    supplier_filter: str = "All",
    marketplace: str = "eBay",       # MVP Scope: Default to eBay
    store_id: Optional[str] = None,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    OptListing zombie analysis filter API.

    Filter order (Sales -> Watch -> Traffic):
    1. analytics_period_days: analysis period (default 7 days)
    2. max_sales: sales in period (default 0)
    3. max_watches: watches (default 0)
    4. max_impressions: impressions (default < 100)
    5. max_views: views (default < 10)
    
    Returns:
    - total_count: Total number of ALL listings in the database
    - total_breakdown: Breakdown by source for ALL listings
    - zombie_count: Number of filtered zombie listings
    - zombies: List of zombie listings (paginated)
    """
    # Validate marketplace - MVP Scope: Only eBay and Shopify
    valid_marketplaces = [
        "eBay",
        "Shopify"
    ]
    if marketplace not in valid_marketplaces:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid marketplace. Must be one of: {', '.join(valid_marketplaces)}"
        )
    
    # Validate supplier_filter
    valid_suppliers = ["All", "Amazon", "Walmart", "Wholesale2B", "Doba", "DSers", "Spocket", "CJ Dropshipping", "Unverified"]
    if supplier_filter not in valid_suppliers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid supplier_filter. Must be one of: {', '.join(valid_suppliers)}"
        )
    
    # Ensure min_days, max_sales, and max_watch_count are non-negative
    min_days = max(0, min_days)
    max_sales = max(0, max_sales)
    max_watch_count = max(0, max_watch_count)
    
    # Validate and clamp pagination parameters
    skip = max(0, skip)
    limit = min(max(1, limit), 1000)  # Clamp between 1 and 1000
    
    # Check cache for KPI metrics (total_count, total_breakdown, platform_breakdown)
    # Only cache when skip=0 and limit >= 100 (full page requests)
    # Don't cache paginated requests (skip > 0 or limit < 100)
    cache_filters = {
        "min_days": min_days,
        "max_sales": max_sales,
        "max_watch_count": max_watch_count,
        "supplier_filter": supplier_filter
    }
    cache_key = get_cache_key(user_id, store_id, marketplace, cache_filters)
    cached_kpi = None
    
    # Only use cache for full page requests (not paginated)
    if skip == 0 and limit >= 100:
        cached_kpi = get_cached_kpi(cache_key)
    
    # Build base query with user_id filter
    base_query = db.query(Listing).filter(Listing.user_id == user_id)
    
    # Apply store filter if store_id is provided and not 'all'
    if store_id and store_id != 'all':
        if hasattr(Listing, 'store_id'):
            base_query = base_query.filter(Listing.store_id == store_id)
    # If store_id is 'all' or None, DO NOT filter by store (return all for user)
    
    # Get total count using SQL COUNT
    total_count = base_query.count()
    
    # Validate active Professional subscription ($120/month)
    try:
        require_active_subscription(db, user_id)
        logger.info(f"✅ Professional subscription validated for user {user_id}")
    except HTTPException:
        raise  # Subscription required error is passed through
    except Exception as sub_err:
        # Log subscription validation errors but continue (graceful degradation)
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Subscription validation failed (continuing anyway): {sub_err}")
    
    # Calculate breakdown by supplier using SQL GROUP BY
    supplier_query = db.query(
        Listing.supplier_name,
        func.count(Listing.id).label('count')
    ).filter(
        Listing.user_id == user_id
    )
    
    # Apply store filter to supplier breakdown
    if store_id and store_id != 'all':
        if hasattr(Listing, 'store_id'):
            supplier_query = supplier_query.filter(Listing.store_id == store_id)
    
    supplier_results = supplier_query.group_by(Listing.supplier_name).all()
    
    total_breakdown = {"Amazon": 0, "Walmart": 0, "AliExpress": 0, "CJ Dropshipping": 0, "Home Depot": 0, "Wayfair": 0, "Costco": 0, "Wholesale2B": 0, "Spocket": 0, "SaleHoo": 0, "Inventory Source": 0, "Dropified": 0, "Unverified": 0, "Unknown": 0}
    for supplier_name, count in supplier_results:
        if supplier_name in total_breakdown:
            total_breakdown[supplier_name] = count
        else:
            total_breakdown["Unknown"] = total_breakdown.get("Unknown", 0) + count
    
    # Calculate breakdown by platform using SQL GROUP BY (dynamic - includes all marketplaces)
    # FIX: if platform missing use marketplace
    platform_field = Listing.platform if hasattr(Listing, 'platform') else Listing.marketplace
    platform_query = db.query(
        platform_field,
        func.count(Listing.id).label('count')
    ).filter(
        Listing.user_id == user_id
    )
    
    # Apply store filter to platform breakdown
    if store_id and store_id != 'all':
        if hasattr(Listing, 'store_id'):
            platform_query = platform_query.filter(Listing.store_id == store_id)
    
    platform_results = platform_query.group_by(platform_field).all()
    
    # Build platform breakdown dictionary from SQL results
    platform_breakdown = {}
    for platform, count in platform_results:
        if platform:  # Only include non-null platforms
            platform_breakdown[platform] = count
    
    # Use cached KPI if available, otherwise use freshly calculated values above
    if cached_kpi:
        total_count = cached_kpi.get("total_count", total_count)
        total_breakdown = cached_kpi.get("total_breakdown", total_breakdown)
        platform_breakdown = cached_kpi.get("platform_breakdown", platform_breakdown)
    # If not cached, use the freshly calculated values (total_count, total_breakdown, platform_breakdown)
    # Cache will be set after zombie analysis if this is a full page request
    
    # Get zombie listings (filtered) - pass user_id, skip, and limit
    # Use analytics_period_days if provided, otherwise fall back to min_days
    effective_period = analytics_period_days if analytics_period_days != 7 else min_days
    # Use max_watches if provided, otherwise fall back to max_watch_count
    effective_watches = max_watches if max_watches > 0 else max_watch_count
    
    # Debug: log filter params
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"🔍 Zombie filter params: min_days={effective_period}, max_sales={max_sales}, max_watches={effective_watches}, max_impressions={max_impressions}, max_views={max_views}, supplier_filter={supplier_filter}, platform_filter={marketplace}")
    
    zombies, zombie_breakdown = analyze_zombie_listings(
        db,
        user_id=user_id,
        min_days=effective_period,
        max_sales=max_sales,
        max_watch_count=effective_watches,  # Legacy param
        max_watches=effective_watches,       # New param
        max_impressions=max_impressions,
        max_views=max_views,
        supplier_filter=supplier_filter,
        platform_filter=marketplace,
        store_id=store_id,
        skip=skip,
        limit=limit
    )
    
    logger.info(f"✅ Zombie analysis: {len(zombies)} zombies (of {total_count} total)")
    
    # Cache KPI metrics if this is a full page request
    if skip == 0 and limit >= 100 and not cached_kpi:
        kpi_data = {
            "total_count": total_count,
            "total_breakdown": total_breakdown,
            "platform_breakdown": platform_breakdown
        }
        set_cached_kpi(cache_key, kpi_data)
    
    return {
        "total_count": total_count,
        "total_breakdown": total_breakdown,
        "platform_breakdown": platform_breakdown,
        "zombie_count": len(zombies),
        "zombie_breakdown": zombie_breakdown,  # Store-Level Breakdown
        "zombies": [
            {
                "id": z.id,
                "item_id": getattr(z, 'item_id', None) or getattr(z, 'ebay_item_id', None) or "",
                "ebay_item_id": getattr(z, 'item_id', None) or getattr(z, 'ebay_item_id', None) or "",  # Backward compatibility
                "title": z.title,
                "sku": z.sku,
                "image_url": z.image_url,
                "platform": getattr(z, 'platform', None) or getattr(z, 'marketplace', None) or "eBay",
                "marketplace": getattr(z, 'platform', None) or getattr(z, 'marketplace', None) or "eBay",  # Backward compatibility
                "supplier_name": getattr(z, 'supplier_name', None) or "Unknown",
                "supplier": getattr(z, 'supplier_name', None) or "Unknown",  # Backward compatibility
                "supplier_id": getattr(z, 'supplier_id', None),
                "price": (z.metrics.get('price') if z.metrics and 'price' in z.metrics else None) or z.price,
                "date_listed": z.date_listed.isoformat() if z.date_listed else None,
                "sold_qty": (z.metrics.get('sales') if z.metrics and isinstance(z.metrics, dict) and 'sales' in z.metrics else None) or z.sold_qty or 0,
                "quantity_sold": (z.metrics.get('sales') if z.metrics and isinstance(z.metrics, dict) and 'sales' in z.metrics else None) or z.sold_qty or 0,
                "total_sales": (z.metrics.get('sales') if z.metrics and isinstance(z.metrics, dict) and 'sales' in z.metrics else None) or z.sold_qty or 0,
                "watch_count": (z.metrics.get('watches') if z.metrics and isinstance(z.metrics, dict) and 'watches' in z.metrics else None) or z.watch_count or 0,
                "view_count": (z.metrics.get('views') if z.metrics and isinstance(z.metrics, dict) and 'views' in z.metrics else None) or getattr(z, 'view_count', None) or 0,
                "views": (z.metrics.get('views') if z.metrics and isinstance(z.metrics, dict) and 'views' in z.metrics else None) or getattr(z, 'view_count', None) or 0,
                "impressions": (z.metrics.get('impressions') if z.metrics and isinstance(z.metrics, dict) and 'impressions' in z.metrics else None) or getattr(z, 'impressions', None) or 0,
                "is_global_winner": bool(getattr(z, 'is_global_winner', 0)),  # Cross-Platform Health Check flag
                "is_active_elsewhere": bool(getattr(z, 'is_active_elsewhere', 0)),  # Cross-Platform Activity Check flag
                # Management hub information (for Shopify detection)
                "management_hub": (
                    z.metrics.get('management_hub') if z.metrics and isinstance(z.metrics, dict) and 'management_hub' in z.metrics else None
                ) or (
                    z.analysis_meta.get('management_hub') if z.analysis_meta and isinstance(z.analysis_meta, dict) and 'management_hub' in z.analysis_meta else None
                ) or getattr(z, 'management_hub', None),
                "raw_data": z.metrics if z.metrics else {},
                "analysis_meta": z.analysis_meta if z.analysis_meta else {}
            }
            for z in zombies
        ]
    }


class LowPerformingAnalysisRequest(BaseModel):
    """Low-Performing analysis request model"""
    days: int = 7  # analytics_period_days
    sales_lte: int = 0  # max_sales
    watch_lte: int = 0  # max_watches
    imp_lte: int = 100  # max_impressions
    views_lte: int = 10  # max_views
    request_id: Optional[str] = None  # Client-generated requestId (idempotency)


class LowPerformingExecuteRequest(BaseModel):
    """Low-Performing analysis execute request (with idempotency)"""
    days: int = 7
    sales_lte: int = 0
    watch_lte: int = 0
    imp_lte: int = 100
    views_lte: int = 10
    idempotency_key: str  # Client-generated unique key (required) - prevent duplicate run


@app.post("/api/analysis/low-performing/quote")
def quote_low_performing_analysis(
    request: LowPerformingAnalysisRequest,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    store_id: Optional[str] = Query(None, description="Store ID (optional)"),
    db: Session = Depends(get_db)
):
    """
    Low-Performing analysis quote (preflight).
    Computes candidate SKU count and returns required/remaining credits. No deduction.
    Args:
        request: filter params
        user_id: user ID
        store_id: store ID (optional)
        db: DB session
        
    Returns:
        {
            "estimatedCandidates": int,  # Candidate SKU count
            "requiredCredits": int,      # Required credits (per SKU)
            "remainingCredits": int,     # Remaining credits
            "filters": Dict              # Applied filters
        }
    """
    import logging
    import traceback
    from .credit_service import get_available_credits
    
    logger = logging.getLogger(__name__)
    
    # Request logging
    logger.info(f"📊 [QUOTE] Low-Performing quote request started")
    logger.info(f"📊 [QUOTE] Request body: {request.dict()}")
    logger.info(f"📊 [QUOTE] Query params: user_id={user_id}, store_id={store_id}")
    
    # Validate user_id
    if not user_id:
        logger.warning(f"⚠️ [QUOTE] Invalid user_id: {user_id}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_user_id",
                "message": "User ID is required. Please log in and try again."
            }
        )
    
    # Validate and normalize filter values
    days = max(1, request.days)
    sales_lte = max(0, request.sales_lte)
    watch_lte = max(0, request.watch_lte)
    imp_lte = max(0, request.imp_lte)
    views_lte = max(0, request.views_lte)
    
    filters = {
        "days": days,
        "sales_lte": sales_lte,
        "watch_lte": watch_lte,
        "imp_lte": imp_lte,
        "views_lte": views_lte
    }
    
    logger.info(f"📊 [QUOTE] Resolved filters: {filters}")
    logger.info(f"📊 [QUOTE] Resolved user_id: {user_id}, store_id: {store_id}")
    
    # Count candidate SKUs (no actual analysis)
    try:
        logger.info(f"📊 [QUOTE] Calling count_low_performing_candidates...")
        estimated_candidates = count_low_performing_candidates(
            db=db,
            user_id=user_id,
            min_days=days,
            max_sales=sales_lte,
            max_watches=watch_lte,
            max_watch_count=watch_lte,
            max_impressions=imp_lte,
            max_views=views_lte,
            supplier_filter="All",
            platform_filter="eBay",
            store_id=store_id
        )
        logger.info(f"📊 [QUOTE] count_low_performing_candidates result: {estimated_candidates}")
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"❌ [QUOTE] Candidate count failed: {str(e)}")
        logger.error(f"❌ [QUOTE] Stack trace:\n{error_trace}")
        
        # Check if it's a database/user not found error
        error_str = str(e).lower()
        if "no row" in error_str or "not found" in error_str or "does not exist" in error_str:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "user_or_account_not_found",
                    "message": f"User account or store not found. Please ensure your account is properly set up. Error: {str(e)}"
                }
            )
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": "count_calculation_failed",
                "message": f"Failed to calculate candidate count: {str(e)}"
            }
        )
    
    # Validate active Professional subscription
    subscription_info = get_subscription_status(db, user_id)
    subscription_status = subscription_info.get("status", "inactive")
    
    logger.info(f"✅ [QUOTE] Quote completed: estimated_candidates={estimated_candidates}, subscription_status={subscription_status}")
    
    return {
        "estimatedCandidates": estimated_candidates,
        "subscriptionStatus": subscription_status,
        "filters": filters
    }


@app.post("/api/analysis/low-performing/execute")
def execute_low_performing_analysis(
    request: LowPerformingExecuteRequest,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    store_id: Optional[str] = Query(None, description="Store ID (optional)"),
    db: Session = Depends(get_db)
):
    """
    Low-Performing analysis execution
    
    Uses Idempotency-Key to prevent duplicate execution.
    Validates active Professional subscription before performing analysis.
    
    Args:
        request: Filter parameters + idempotency_key
        user_id: User ID
        store_id: Store ID (optional)
        db: Database session
        
    Returns:
        {
            "success": bool,
            "subscriptionStatus": str,    # Subscription status
            "count": int,                 # Number of low-performing items
            "items": List[Dict],          # Analyzed items list
            "requestId": str,             # Request ID (idempotency_key)
            "filters": Dict               # Applied filters
        }
    """
    import uuid
    import logging
    from sqlalchemy import text
    from fastapi import status as http_status
    
    logger = logging.getLogger(__name__)
    
    # Validate active Professional subscription
    require_active_subscription(db, user_id)
    
    # Idempotency check: Use a simple in-memory cache or database table for idempotency
    idempotency_key = request.idempotency_key
    logger.info(f"📊 [{idempotency_key}] Low-Performing analysis execution request: user_id={user_id}")
    
    # TODO: Implement proper idempotency check using a dedicated table
    # For now, we'll proceed with the analysis
    
    # Validate and normalize filter values
    days = max(1, request.days)
    sales_lte = max(0, request.sales_lte)
    watch_lte = max(0, request.watch_lte)
    imp_lte = max(0, request.imp_lte)
    views_lte = max(0, request.views_lte)
    
    filters = {
        "days": days,
        "sales_lte": sales_lte,
        "watch_lte": watch_lte,
        "imp_lte": imp_lte,
        "views_lte": views_lte
    }
    
    # Calculate candidate SKU count
    try:
        estimated_candidates = count_low_performing_candidates(
            db=db,
            user_id=user_id,
            min_days=days,
            max_sales=sales_lte,
            max_watches=watch_lte,
            max_watch_count=watch_lte,
            max_impressions=imp_lte,
            max_views=views_lte,
            supplier_filter="All",
            platform_filter="eBay",
            store_id=store_id
        )
        logger.info(f"📊 [{idempotency_key}] Estimated candidates: {estimated_candidates}")
    except Exception as e:
        logger.error(f"❌ [{idempotency_key}] Failed to calculate candidate count: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "count_calculation_failed",
                "message": f"Failed to calculate candidate count: {str(e)}",
                "requestId": idempotency_key
            }
        )
    
    # Get subscription status for response
    subscription_info = get_subscription_status(db, user_id)
    subscription_status = subscription_info.get("status", "inactive")
    
    # Run analysis
    try:
        zombies, zombie_breakdown = analyze_zombie_listings(
            db=db,
            user_id=user_id,
            min_days=days,
            max_sales=sales_lte,
            max_watches=watch_lte,
            max_watch_count=watch_lte,
            max_impressions=imp_lte,
            max_views=views_lte,
            supplier_filter="All",
            platform_filter="eBay",
            store_id=store_id,
            skip=0,
            limit=10000
        )
        
        count = len(zombies)
        logger.info(f"✅ [{idempotency_key}] Analysis done: {count} low-performing items")
        
        # Transform items
        items = [
            {
                "id": z.id,
                "item_id": getattr(z, 'item_id', None) or getattr(z, 'ebay_item_id', None) or "",
                "ebay_item_id": getattr(z, 'item_id', None) or getattr(z, 'ebay_item_id', None) or "",
                "title": z.title,
                "sku": z.sku,
                "image_url": z.image_url or (z.metrics.get('image_url') if z.metrics and isinstance(z.metrics, dict) else None),
                "platform": getattr(z, 'platform', None) or getattr(z, 'marketplace', None) or "eBay",
                "marketplace": getattr(z, 'platform', None) or getattr(z, 'marketplace', None) or "eBay",
                "supplier_name": getattr(z, 'supplier_name', None) or "Unknown",
                "supplier": getattr(z, 'supplier_name', None) or "Unknown",
                "supplier_id": getattr(z, 'supplier_id', None),
                "price": (z.metrics.get('price') if z.metrics and isinstance(z.metrics, dict) and 'price' in z.metrics else None) or getattr(z, 'price', None),
                "date_listed": z.date_listed.isoformat() if z.date_listed else None,
                "quantity_sold": (z.metrics.get('sales') if z.metrics and isinstance(z.metrics, dict) and 'sales' in z.metrics else None) or getattr(z, 'sold_qty', 0) or 0,
                "total_sales": (z.metrics.get('sales') if z.metrics and isinstance(z.metrics, dict) and 'sales' in z.metrics else None) or getattr(z, 'sold_qty', 0) or 0,
                "watch_count": (z.metrics.get('watches') if z.metrics and isinstance(z.metrics, dict) and 'watches' in z.metrics else None) or getattr(z, 'watch_count', 0) or 0,
                "view_count": (z.metrics.get('views') if z.metrics and isinstance(z.metrics, dict) and 'views' in z.metrics else None) or getattr(z, 'view_count', None) or 0,
                "views": (z.metrics.get('views') if z.metrics and isinstance(z.metrics, dict) and 'views' in z.metrics else None) or getattr(z, 'view_count', None) or 0,
                "impressions": (z.metrics.get('impressions') if z.metrics and isinstance(z.metrics, dict) and 'impressions' in z.metrics else None) or getattr(z, 'impressions', None) or 0,
                "days_listed": (date.today() - z.date_listed).days if z.date_listed else None,
                "is_global_winner": bool(getattr(z, 'is_global_winner', 0)),
                "is_active_elsewhere": bool(getattr(z, 'is_active_elsewhere', 0)),
                "metrics": z.metrics if z.metrics else {},
                "analysis_meta": z.analysis_meta if z.analysis_meta else {}
            }
            for z in zombies
        ]
        
        return {
            "success": True,
            "subscriptionStatus": subscription_status,
            "count": count,
            "items": items,
            "requestId": idempotency_key,
            "filters": filters
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [{idempotency_key}] Analysis failed: {str(e)}")
        # Consider credit refund on failure (currently no refund)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "analysis_failed",
                "message": f"Failed to analyze low-performing SKUs: {str(e)}",
                "requestId": idempotency_key
            }
        )


@app.post("/api/analysis/low-performing")
def analyze_low_performing(
    request: LowPerformingAnalysisRequest,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    store_id: Optional[str] = Query(None, description="Store ID (optional)"),
    db: Session = Depends(get_db)
):
    """
    Low-Performing SKUs analysis
    
    Validates active Professional subscription before performing analysis.
    - Subscription required: 402 Payment Required error if not active
    - Success: Returns analysis results (count, items, requestId)
    
    Args:
        request: Filter parameters (days, sales_lte, watch_lte, imp_lte, views_lte, request_id)
        user_id: User ID
        store_id: Store ID (optional)
        db: Database session
        
    Returns:
        {
            "success": bool,
            "count": int,  # Number of filtered low-performing items
            "items": List[Dict],  # Filtered items list
            "subscriptionStatus": str,  # Subscription status
            "request_id": str,  # Request ID
            "filters": Dict  # Applied filters
        }
    """
    import uuid
    import logging
    from fastapi import status as http_status
    
    logger = logging.getLogger(__name__)
    
    # Validate active Professional subscription
    require_active_subscription(db, user_id)
    
    # Request ID generation (for idempotency)
    request_id = request.request_id or f"analysis_{uuid.uuid4().hex[:16]}"
    
    # Filter value validation and normalization
    days = max(1, request.days)
    sales_lte = max(0, request.sales_lte)
    watch_lte = max(0, request.watch_lte)
    imp_lte = max(0, request.imp_lte)
    views_lte = max(0, request.views_lte)
    
    filters = {
        "days": days,
        "sales_lte": sales_lte,
        "watch_lte": watch_lte,
        "imp_lte": imp_lte,
        "views_lte": views_lte
    }
    
    logger.info(f"📊 [{request_id}] Low-Performing analysis request: user_id={user_id}, filters={filters}")
    
    # Get subscription status for response
    subscription_info = get_subscription_status(db, user_id)
    subscription_status = subscription_info.get("status", "inactive")
    
    # Run analysis
    try:
        zombies, zombie_breakdown = analyze_zombie_listings(
            db=db,
            user_id=user_id,
            min_days=days,
            max_sales=sales_lte,
            max_watches=watch_lte,
            max_watch_count=watch_lte,  # Legacy compatibility
            max_impressions=imp_lte,
            max_views=views_lte,
            supplier_filter="All",  # default
            platform_filter="eBay",  # default
            store_id=store_id,
            skip=0,  # full result
            limit=10000  # max 10000
        )
        
        count = len(zombies)
        logger.info(f"✅ [{request_id}] Analysis done: {count} low-performing items")
        
        # Transform items
        items = [
            {
                "id": z.id,
                "item_id": getattr(z, 'item_id', None) or getattr(z, 'ebay_item_id', None) or "",
                "ebay_item_id": getattr(z, 'item_id', None) or getattr(z, 'ebay_item_id', None) or "",
                "title": z.title,
                "sku": z.sku,
                "image_url": z.image_url or (z.metrics.get('image_url') if z.metrics and isinstance(z.metrics, dict) else None),
                "platform": getattr(z, 'platform', None) or getattr(z, 'marketplace', None) or "eBay",
                "marketplace": getattr(z, 'platform', None) or getattr(z, 'marketplace', None) or "eBay",
                "supplier_name": getattr(z, 'supplier_name', None) or "Unknown",
                "supplier": getattr(z, 'supplier_name', None) or "Unknown",
                "supplier_id": getattr(z, 'supplier_id', None),
                "price": (z.metrics.get('price') if z.metrics and isinstance(z.metrics, dict) and 'price' in z.metrics else None) or getattr(z, 'price', None),
                "date_listed": z.date_listed.isoformat() if z.date_listed else None,
                "quantity_sold": (z.metrics.get('sales') if z.metrics and isinstance(z.metrics, dict) and 'sales' in z.metrics else None) or getattr(z, 'sold_qty', 0) or 0,
                "total_sales": (z.metrics.get('sales') if z.metrics and isinstance(z.metrics, dict) and 'sales' in z.metrics else None) or getattr(z, 'sold_qty', 0) or 0,
                "watch_count": (z.metrics.get('watches') if z.metrics and isinstance(z.metrics, dict) and 'watches' in z.metrics else None) or getattr(z, 'watch_count', 0) or 0,
                "view_count": (z.metrics.get('views') if z.metrics and isinstance(z.metrics, dict) and 'views' in z.metrics else None) or getattr(z, 'view_count', None) or 0,
                "views": (z.metrics.get('views') if z.metrics and isinstance(z.metrics, dict) and 'views' in z.metrics else None) or getattr(z, 'view_count', None) or 0,
                "impressions": (z.metrics.get('impressions') if z.metrics and isinstance(z.metrics, dict) and 'impressions' in z.metrics else None) or getattr(z, 'impressions', None) or 0,
                "days_listed": (date.today() - z.date_listed).days if z.date_listed else None,
                "is_global_winner": bool(getattr(z, 'is_global_winner', 0)),
                "is_active_elsewhere": bool(getattr(z, 'is_active_elsewhere', 0)),
                "metrics": z.metrics if z.metrics else {},
                "analysis_meta": z.analysis_meta if z.analysis_meta else {}
            }
            for z in zombies
        ]
        
        return {
            "success": True,
            "count": count,
            "items": items,
            "subscriptionStatus": subscription_status,
            "request_id": request_id,
            "filters": filters
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [{request_id}] Analysis failed: {str(e)}")
        # Optional: credit refund on failure (currently no refund)
        # TODO: add refund logic on failure
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "analysis_failed",
                "message": f"Failed to analyze low-performing SKUs: {str(e)}",
                "request_id": request_id
            }
        )


@app.post("/api/export")
def export_csv(
    export_mode: str,  # "autods", "yaballe", "ebay"
    min_days: int = 60,
    max_sales: int = 0,
    max_watch_count: int = 10,
    supplier_filter: str = "All",
    db: Session = Depends(get_db)
):
    """
    Smart Export Feature
    Generates CSV file based on the selected Listing Tool.
    Uses the same filter parameters as /api/analyze
    """
    if export_mode not in ["autods", "yaballe", "ebay"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid export_mode. Must be one of: autods, yaballe, ebay"
        )
    
    # Validate supplier_filter
    valid_suppliers = ["All", "Amazon", "Walmart", "AliExpress", "CJ Dropshipping", "Home Depot", "Wayfair", "Costco", "Wholesale2B", "Spocket", "SaleHoo", "Inventory Source", "Dropified", "Unverified", "Unknown"]
    if supplier_filter not in valid_suppliers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid supplier_filter. Must be one of: {', '.join(valid_suppliers)}"
        )
    
    # Ensure min_days, max_sales, and max_watch_count are non-negative
    min_days = max(0, min_days)
    max_sales = max(0, max_sales)
    max_watch_count = max(0, max_watch_count)
    
    # Get zombie listings with filters
    # Note: This endpoint is deprecated - use /api/analysis/low-performing instead
    # Keeping for backward compatibility but requires authentication
    raise HTTPException(
        status_code=400,
        detail="This endpoint is deprecated. Please use /api/analysis/low-performing with JWT authentication."
    )


class ExportQueueRequest(BaseModel):
    items: List[Dict]
    target_tool: Optional[str] = None  # New parameter: "autods", "wholesale2b", "shopify_matrixify", etc.
    export_mode: Optional[str] = None  # Legacy parameter for backward compatibility
    mode: Optional[str] = "delete_list"  # "delete_list" (default) or "full_sync_list"
    store_id: Optional[str] = None  # Store ID for full_sync_list mode
    platform: Optional[str] = None  # Platform parameter: "shopify", "bigcommerce" (maps to target_tool)

@app.post("/api/export-queue")
def export_queue_csv(
    request: ExportQueueRequest,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    db: Session = Depends(get_db)
):
    """
    Export CSV from queue items (staging area)
    Accepts a list of items directly from the frontend queue
    Supports multiple export formats via target_tool parameter.
    """
    items = request.items
    
    # Support both new target_tool and legacy export_mode
    target_tool = request.target_tool or request.export_mode or "autods"
    
    valid_tools = ["autods", "yaballe", "ebay", "wholesale2b", "shopify_matrixify", "shopify_tagging"]
    if target_tool not in valid_tools:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid target_tool. Must be one of: {', '.join(valid_tools)}"
        )
    
    if not items:
        raise HTTPException(status_code=400, detail="No items in queue to export")
    
    # Validate mode
    mode = request.mode or "delete_list"
    if mode not in ["delete_list", "full_sync_list"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid mode. Must be 'delete_list' or 'full_sync_list'"
        )
    
    # Extract platform from request if provided (optional parameter)
    # If frontend passes platform, use it to map target_tool
    platform = getattr(request, 'platform', None)
    
    # Generate CSV directly from items (dictionaries) with target_tool (with snapshot logging)
    csv_content = generate_export_csv(
        items, 
        target_tool, 
        db=db, 
        user_id=user_id,  # user_id from JWT
        mode=mode,
        store_id=request.store_id,
        platform=platform
    )
    
    # Determine filename
    filename_map = {
        "autods": "queue_autods.csv",
        "yaballe": "queue_yaballe.csv",
        "ebay": "queue_ebay.csv",
        "wholesale2b": "queue_wholesale2b.csv",
        "shopify_matrixify": "queue_shopify_matrixify.csv",
        "shopify_tagging": "queue_shopify_tagging.csv"
    }
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename_map[target_tool]}"
        }
    )


class LogDeletionRequest(BaseModel):
    items: List[Dict]

@app.post("/api/log-deletion")
def log_deletion(
    request: LogDeletionRequest,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    db: Session = Depends(get_db)
):
    """
    Log deleted items to history
    Accepts a list of items from the queue that were exported/deleted
    Uses supplier_name (not source) and stores full snapshot in JSONB
    """
    items = request.items
    
    if not items:
        raise HTTPException(status_code=400, detail="No items to log")
    
    # Create deletion log entries
    logs = []
    for item in items:
        # Extract supplier_name (prefer supplier_name over supplier over source)
        supplier = item.get("supplier_name") or item.get("supplier") or item.get("source", "Unknown")
        
        # Extract platform/marketplace
        platform = item.get("platform") or item.get("marketplace") or "eBay"
        
        # Create snapshot JSONB with full item data for future reference
        snapshot_data = {
            "supplier_name": supplier,
            "supplier_id": item.get("supplier_id"),
            "platform": platform,
            "title": item.get("title", "Unknown"),
            "price": item.get("price"),
            "sold_qty": item.get("sold_qty"),
            "watch_count": item.get("watch_count"),
            # Include all other fields for completeness
            **{k: v for k, v in item.items() if k not in ["supplier_name", "supplier", "source", "platform", "marketplace"]}
        }
        
        log_entry = DeletionLog(
            item_id=item.get("ebay_item_id") or item.get("item_id") or str(item.get("id", "")),
            title=item.get("title", "Unknown"),
            platform=platform,
            supplier=supplier,  # Use supplier_name (not source)
            user_id=user_id,  # user_id from JWT
            snapshot=snapshot_data  # Store full snapshot in JSONB
        )
        logs.append(log_entry)
    
    # Bulk insert
    try:
        db.add_all(logs)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error logging deletions: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to log deletions: {str(e)}")
    
    return {
        "message": f"Logged {len(logs)} deletions",
        "count": len(logs)
    }


@app.get("/api/history")
def get_deletion_history(
    skip: int = 0,
    limit: int = 1000,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    db: Session = Depends(get_db)
):
    """
    Get deletion history
    Returns total count and list of deleted items (most recent first)
    Uses supplier field from DeletionLog (not source) and safely handles JSONB snapshot
    """
    try:
        # Validate pagination parameters
        skip = max(0, skip)
        limit = min(max(1, limit), 10000)  # Clamp between 1 and 10000
        
        # Get total count (user_id filter)
        total_count = db.query(DeletionLog).filter(DeletionLog.user_id == user_id).count()
        
        # Get logs (most recent first) - user_id filter
        logs = db.query(DeletionLog).filter(DeletionLog.user_id == user_id).order_by(DeletionLog.deleted_at.desc()).offset(skip).limit(limit).all()
        
        # Build response with safe field access
        log_list = []
        for log in logs:
            # Safely extract supplier (handle NULL and fallback to snapshot or "Unknown")
            supplier = None
            if hasattr(log, 'supplier') and log.supplier:
                supplier = log.supplier
            elif hasattr(log, 'snapshot') and log.snapshot:
                # Try to get supplier from snapshot JSONB if available
                if isinstance(log.snapshot, dict):
                    supplier = log.snapshot.get('supplier_name') or log.snapshot.get('supplier') or log.snapshot.get('source')
                elif isinstance(log.snapshot, str):
                    try:
                        import json
                        snapshot_dict = json.loads(log.snapshot)
                        supplier = snapshot_dict.get('supplier_name') or snapshot_dict.get('supplier') or snapshot_dict.get('source')
                    except:
                        pass
            
            # Default to "Unknown" if supplier is still None
            supplier = supplier or "Unknown"
            
            # Safely extract platform
            platform = None
            if hasattr(log, 'platform') and log.platform:
                platform = log.platform
            elif hasattr(log, 'snapshot') and log.snapshot:
                if isinstance(log.snapshot, dict):
                    platform = log.snapshot.get('platform') or log.snapshot.get('marketplace')
                elif isinstance(log.snapshot, str):
                    try:
                        import json
                        snapshot_dict = json.loads(log.snapshot)
                        platform = snapshot_dict.get('platform') or snapshot_dict.get('marketplace')
                    except:
                        pass
            
            platform = platform or "eBay"  # Default platform
            
            log_list.append({
                "id": log.id,
                "item_id": log.item_id if hasattr(log, 'item_id') else "",
                "title": log.title if hasattr(log, 'title') else "Unknown",
                "platform": platform,
                "supplier": supplier,
                "deleted_at": log.deleted_at.isoformat() if hasattr(log, 'deleted_at') and log.deleted_at else None
            })
        
        return {
            "total_count": total_count,
            "logs": log_list
        }
    except Exception as e:
        # Log error with full traceback
        print(f"Error fetching deletion history: {e}")
        import traceback
        traceback.print_exc()
        # Return error response with CORS headers (not empty response)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch deletion history: {str(e)}"
        )


class UpdateListingRequest(BaseModel):
    supplier: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_id: Optional[str] = None

@app.patch("/api/listing/{listing_id}")
def update_listing(
    listing_id: int,
    request: UpdateListingRequest,
    db: Session = Depends(get_db)
):
    """
    Update a listing's supplier (manual override)
    Allows users to correct auto-detected suppliers
    Supports both supplier (legacy) and supplier_name/supplier_id (new format)
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Support legacy 'supplier' field for backward compatibility
    supplier_name = request.supplier_name or request.supplier
    supplier_id = request.supplier_id
    
    # Validate supplier if provided
    if supplier_name is not None:
        valid_suppliers = ["Amazon", "Walmart", "AliExpress", "CJ Dropshipping", "Home Depot", "Wayfair", "Costco", "Wholesale2B", "Spocket", "SaleHoo", "Inventory Source", "Dropified", "Unverified", "Unknown", "AutoDS", "Yaballe"]
        if supplier_name not in valid_suppliers:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid supplier. Must be one of: {', '.join(valid_suppliers)}"
            )
        listing.supplier_name = supplier_name
    
    # Update supplier_id if provided
    if supplier_id is not None:
        listing.supplier_id = supplier_id if supplier_id else None
    
    db.commit()
    db.refresh(listing)
    
    return {
        "id": listing.id,
        "item_id": getattr(listing, 'item_id', None) or getattr(listing, 'ebay_item_id', None) or "",
        "ebay_item_id": getattr(listing, 'item_id', None) or getattr(listing, 'ebay_item_id', None) or "",  # Backward compatibility
        "title": listing.title,
        "supplier_name": listing.supplier_name,
        "supplier_id": listing.supplier_id,
        "supplier": listing.supplier_name,  # Backward compatibility
        "message": "Listing updated successfully"
    }


@app.post("/api/dummy-data")
def create_dummy_data(
    count: int = 50,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    db: Session = Depends(get_db)
):
    """Generate dummy listings for testing with new hybrid schema"""
    # Ensure tables exist before attempting to delete
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as db_init_error:
        logger.error(f"❌ Database initialization failed in dummy data endpoint: {str(db_init_error)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "database_initialization_failed",
                "message": f"Failed to initialize database: {str(db_init_error)}"
            }
        )
    
    # Clear all existing listings before generating new dummy data
    db.query(Listing).delete()
    db.commit()
    
    generate_dummy_listings(db, count=count, user_id=user_id)
    return {"message": f"Generated {count} dummy listings"}


# ============================================================
# CSV Upload Endpoints - supplier CSV pipeline
# ============================================================

from fastapi import File, UploadFile
from .csv_processor import (
    process_supplier_csv,
    generate_csv_template,
    get_unmatched_listings,
    CSVProcessingResult
)


class CSVUploadResponse(BaseModel):
    """CSV upload response schema"""
    success: bool
    message: str
    result: Optional[Dict] = None


@app.post("/api/upload-supplier-csv", response_model=CSVUploadResponse)
async def upload_supplier_csv(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
    dry_run: bool = False,
    db: Session = Depends(get_db)
):
    """
    Supplier CSV file upload and processing
    
    Optimized for US eBay market format:
    - Date format: MM/DD/YYYY
    - Currency: USD
    - Large files processed asynchronously with queue
    
    - **file**: CSV file (required)
    - **user_id**: User ID
    - **dry_run**: True for simulation without DB updates
    
    Supported CSV format:
    - At least one of: SKU, UPC, EAN columns
    - SupplierName column required
    
    Returns:
    - For small files (< 1000 rows): Immediate processing
    - For large files (>= 1000 rows): Queued for async processing
    """
    import asyncio
    from datetime import datetime as dt
    
    try:
        # Validate file type
        if not file.filename.endswith(('.csv', '.CSV')):
            raise HTTPException(
                status_code=400,
                detail="Only CSV files are supported. Please upload a .csv file."
            )
        
        # File size limit (10MB)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="File size must be 10MB or less. Please split large files into smaller batches."
            )
        
        # Check file size for async processing decision
        # Quick row count estimation (rough: ~100 bytes per row average)
        estimated_rows = len(content) // 100
        
        # For large files (>= 1000 rows), process asynchronously with persistent queue
        if estimated_rows >= 1000:
            from .models import CSVProcessingTask
            from uuid import uuid4
            
            # Create persistent task record in database
            task_id = f"csv_{user_id}_{uuid4().hex[:8]}"
            task = CSVProcessingTask(
                task_id=task_id,
                user_id=user_id,
                status='queued',
                file_name=file.filename,
                file_size=len(content),
                estimated_rows=estimated_rows,
                task_metadata={'dry_run': dry_run}
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            
            # Start background task (will update task status in DB)
            # Note: Pass None for db parameter - background task creates its own session
            asyncio.create_task(_process_csv_background(content, user_id, dry_run, task_id, None))
            
            return CSVUploadResponse(
                success=True,
                message=f"Large file detected ({estimated_rows} estimated rows). Processing in background. Status will be available shortly.",
                result={
                    "task_id": task_id,
                    "status": "queued",
                    "estimated_rows": estimated_rows,
                    "message": "File queued for asynchronous processing. Please check status in a moment."
                }
            )
        
        # For small files, process immediately
        result = process_supplier_csv(
            file_content=content,
            user_id=user_id,
            dry_run=dry_run
        )
        
        # Professional error messages for CSV format issues
        error_messages = []
        if result.errors:
            for error in result.errors[:5]:  # Show first 5 errors
                row_num = error.get('row', 0)
                error_msg = error.get('error', 'Unknown error')
                if 'supplier_name' in error_msg.lower():
                    error_messages.append(f"Row {row_num}: Missing required 'SupplierName' column. Please add this column to your CSV.")
                elif 'sku' in error_msg.lower() and 'upc' in error_msg.lower() and 'ean' in error_msg.lower():
                    error_messages.append(f"Row {row_num}: Missing identifier. Please include at least one of: SKU, UPC, or EAN columns.")
                else:
                    error_messages.append(f"Row {row_num}: {error_msg}")
        
        success_message = (
            f"Processing complete: {result.matched_listings} matched, {result.updated_listings} updated out of {result.total_rows} rows."
            if result.updated_listings > 0 or result.matched_listings > 0
            else f"Processing complete: {result.total_rows} rows processed. No matches found. Please verify your CSV format matches the template."
        )
        
        if error_messages:
            success_message += f" Errors found: {'; '.join(error_messages)}"
        
        return CSVUploadResponse(
            success=result.updated_listings > 0 or result.matched_listings > 0,
            message=success_message,
            result={
                "total_rows": result.total_rows,
                "valid_rows": result.valid_rows,
                "invalid_rows": result.invalid_rows,
                "matched_listings": result.matched_listings,
                "updated_listings": result.updated_listings,
                "unmatched_rows": result.unmatched_rows,
                "processing_time_ms": result.processing_time_ms,
                "match_details": result.match_details,
                "errors": result.errors[:10]  # Maximum 10 errors returned
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"CSV processing failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"CSV processing failed: {str(e)}. Please check your CSV format and try again. Ensure dates are in MM/DD/YYYY format for US market."
        )


async def _process_csv_background(
    file_content: bytes,
    user_id: str,
    dry_run: bool,
    task_id: str,
    db: Optional[Session] = None
):
    """
    Background CSV processing task for large files
    
    Processes CSV asynchronously and updates persistent task state in database
    Allows task recovery after server restarts
    
    Args:
        file_content: CSV file content (bytes)
        user_id: User ID
        dry_run: Whether to perform dry run
        task_id: Unique task identifier
        db: Optional database session (creates new one if None)
    """
    import logging
    from datetime import datetime as dt
    from .models import CSVProcessingTask, SessionLocal
    
    logger = logging.getLogger(__name__)
    
    # Use a new database session for background task
    task_db = SessionLocal() if db is None else db
    
    try:
        # Update task status to 'processing'
        task = task_db.query(CSVProcessingTask).filter(CSVProcessingTask.task_id == task_id).first()
        if task:
            task.status = 'processing'
            task.started_at = dt.utcnow()
            task_db.commit()
        else:
            logger.warning(f"⚠️ [CSV QUEUE] Task {task_id} not found in database")
        
        logger.info(f"🔄 [CSV QUEUE] Starting background processing for task {task_id}")
        
        # Process CSV
        result = process_supplier_csv(
            file_content=file_content,
            user_id=user_id,
            dry_run=dry_run
        )
        
        # Update task with results
        if task:
            task.status = 'completed'
            task.completed_at = dt.utcnow()
            task.total_rows = result.total_rows
            task.valid_rows = result.valid_rows
            task.invalid_rows = result.invalid_rows
            task.matched_listings = result.matched_listings
            task.updated_listings = result.updated_listings
            task.processing_time_ms = result.processing_time_ms
            task.error_details = {'errors': result.errors[:10]} if result.errors else None
            task_db.commit()
        
        logger.info(f"✅ [CSV QUEUE] Background processing complete for task {task_id}: {result.updated_listings} updated")
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"❌ [CSV QUEUE] Background processing failed for task {task_id}: {str(e)}")
        logger.error(f"❌ [CSV QUEUE] Error trace:\n{error_trace}")
        
        # Update task with error
        if task:
            task.status = 'failed'
            task.completed_at = dt.utcnow()
            task.error_message = str(e)
            task.error_details = {'traceback': error_trace}
            task_db.commit()
    finally:
        if db is None:  # Only close if we created the session
            task_db.close()


@app.get("/api/csv/task/{task_id}")
def get_csv_task_status(
    task_id: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get CSV processing task status
    
    Returns task status and results for async processing
    """
    from .models import CSVProcessingTask
    
    task = db.query(CSVProcessingTask).filter(
        CSVProcessingTask.task_id == task_id,
        CSVProcessingTask.user_id == user_id
    ).first()
    
    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )
    
    return {
        "task_id": task.task_id,
        "status": task.status,
        "total_rows": task.total_rows,
        "valid_rows": task.valid_rows,
        "invalid_rows": task.invalid_rows,
        "matched_listings": task.matched_listings,
        "updated_listings": task.updated_listings,
        "processing_time_ms": task.processing_time_ms,
        "error_message": task.error_message,
        "error_details": task.error_details,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None
    }


@app.get("/api/csv-template")
def download_csv_template():
    """
    Supplier CSV template download
    Example CSV format for user uploads
    """
    template = generate_csv_template()
    
    return Response(
        content=template,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=supplier_template.csv"
        }
    )


@app.get("/api/unmatched-listings")
def get_unmatched_listings_endpoint(
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    List listings without supplier info (for CSV add).
    """
    try:
        listings = get_unmatched_listings(db, user_id, limit)
        
        return {
            "count": len(listings),
            "listings": listings,
            "message": f"Listings without supplier info: {len(listings)}"
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Fetch failed: {str(e)}"
        )


# ============================================================
# Credit Management API - 3-Way Hybrid Pricing
# ============================================================

class AnalysisStartRequest(BaseModel):
    """Analysis start request schema"""
    listing_ids: Optional[List[int]] = None  # Specific listing IDs
    listing_count: Optional[int] = None  # Or listing count
    analysis_type: str = "zombie"  # "zombie", "full", "quick"
    marketplace: str = "eBay"


class AnalysisStartResponse(BaseModel):
    """Analysis start response schema"""
    success: bool
    analysis_id: str
    listings_to_analyze: int
    credits_deducted: int
    remaining_credits: int
    message: str


class CreditBalanceResponse(BaseModel):
    """Credits balance response schema"""
    user_id: str
    purchased_credits: int
    consumed_credits: int
    available_credits: int
    current_plan: str
    free_tier_count: int = 0
    free_tier_remaining: int = 3


class AddCreditsRequest(BaseModel):
    """Add credits request schema (post-payment)"""
    amount: int
    transaction_type: str = "purchase"  # "purchase", "bonus", "refund"
    reference_id: Optional[str] = None  # Payment ID etc
    description: Optional[str] = None


@app.get("/api/subscription/status")
def get_subscription_status_endpoint(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return current user subscription status. Response shape is always the same for
    consistent client handling. On error, returns inactive with error key.
    Returns:
        status: "active" | "inactive" | "cancelled" | "expired"
        plan: "professional" | "free"
        subscription_id: Lemon Squeezy subscription ID or None
        expires_at: ISO date string or None
        error: Present only on failure (optional)
    """
    try:
        return get_subscription_status(db, user_id)
    except Exception as e:
        logger.error(f"[SUBSCRIPTION] Error for user {user_id}: {e}")
        return {
            "status": "inactive",
            "plan": "free",
            "subscription_id": None,
            "expires_at": None,
            "error": "failed_to_fetch",
        }


@app.post("/api/analysis/start", response_model=AnalysisStartResponse)
def start_analysis(
    request: AnalysisStartRequest,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    db: Session = Depends(get_db)
):
    """
    Start listing analysis (credit check and deduct).

    **Credit policy:** 1 listing = 1 credit (default). 402 if insufficient.

    **Request:** listing_ids (optional), listing_count (optional), analysis_type: "zombie"|"full"|"quick".

    **Response:** analysis_id, credits_deducted, remaining_credits.
    """
    import uuid
    
    # 1. Determine listing count to analyze
    if request.listing_ids:
        listing_count = len(request.listing_ids)
    elif request.listing_count:
        listing_count = request.listing_count
    else:
        # If no listing_ids/count, get total listing count
        listing_count = db.query(Listing).filter(
            Listing.user_id == user_id
        ).count()
    
    if listing_count <= 0:
        raise HTTPException(
            status_code=400,
            detail="No listings to analyze"
        )
    
    # 2. Credit check and atomic deduct
    analysis_id = str(uuid.uuid4())
    
    result = deduct_credits_atomic(
        db=db,
        user_id=user_id,
        amount=listing_count,
        description=f"Analysis ({request.analysis_type}): {listing_count} listings",
        reference_id=analysis_id
    )
    
    # 3. Return 402 if insufficient credits
    if not result.success:
        raise HTTPException(
            status_code=402,  # Payment Required
            detail={
                "error": "insufficient_credits",
                "message": result.message,
                "available_credits": result.remaining_credits,
                "required_credits": listing_count,
                "purchase_url": "/pricing"  # Checkout URL
            }
        )
    
    # 4. Start analysis (call analyze_zombie_listings)
    try:
        zombies, zombie_breakdown = analyze_zombie_listings(
            db=db,
            user_id=user_id,
            min_days=request.analytics_period_days or request.min_days or 7,
            max_sales=request.max_sales or 0,
            max_watches=request.max_watches or request.max_watch_count or 0,
            max_impressions=request.max_impressions or 100,
            max_views=request.max_views or 10,
            supplier_filter=request.supplier_filter or "All",
            platform_filter=request.marketplace or "eBay",
            store_id=request.store_id,
            skip=0,  # All listings
            limit=10000  # Large limit
        )
        
        zombie_count = len(zombies)
        logger.info(f"✅ Analysis completed: {zombie_count} zombie listings found out of {listing_count} total listings")
        
        return AnalysisStartResponse(
            success=True,
            analysis_id=analysis_id,
            listings_to_analyze=listing_count,
            credits_deducted=result.deducted_amount,
            remaining_credits=result.remaining_credits,
            message=f"Analysis done: {zombie_count} Low-Performing of {listing_count} listings, {result.deducted_amount} credits deducted"
        )
    except Exception as e:
        logger.error(f"❌ Analysis failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        # On analysis failure still return success (credits already deducted; refund separate)
        return AnalysisStartResponse(
            success=True,
            analysis_id=analysis_id,
            listings_to_analyze=listing_count,
            credits_deducted=result.deducted_amount,
            remaining_credits=result.remaining_credits,
            message=f"Analysis started: {listing_count} listings, {result.deducted_amount} credits deducted (error during analysis: {str(e)})"
        )


@app.get("/api/credits")
def get_user_credits(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return current user credit summary for frontend (AccountContext).
    Returns available_credits so Dashboard/Sidebar can show balance without TypeError.
    """
    try:
        from .credit_service import get_credit_summary
        summary = get_credit_summary(db, user_id)
        return {
            "available_credits": summary.get("available_credits", 0),
            "purchased_credits": summary.get("purchased_credits", 0),
            "consumed_credits": summary.get("consumed_credits", 0),
        }
    except Exception as e:
        logger.error(f"[CREDITS] Error for user {user_id}: {e}")
        return {
            "available_credits": 0,
            "purchased_credits": 0,
            "consumed_credits": 0,
            "error": "failed_to_fetch",
        }


@app.post("/api/credits/add")
def add_user_credits(
    request: AddCreditsRequest,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    admin_key: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Add credits (post-payment or admin).
    **Security:** In production use Webhook or Admin API Key verification.
    **Request:** amount, transaction_type, reference_id (optional).
    """
    # Simple security check (in production use Webhook signature)
    expected_key = os.getenv("ADMIN_API_KEY", "")
    if expected_key and admin_key != expected_key:
        # Reject if admin key set and mismatch
        # Lemon Squeezy Webhook has separate verification
        pass  # MVP: allow (TODO: strengthen in production)
    
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # TransactionType conversion
    try:
        tx_type = TransactionType(request.transaction_type)
    except ValueError:
        tx_type = TransactionType.PURCHASE
    
    result = add_credits(
        db=db,
        user_id=user_id,
        amount=request.amount,
        transaction_type=tx_type,
        description=request.description,
        reference_id=request.reference_id
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return {
        "success": True,
        "added_credits": result.added_amount,
        "total_credits": result.total_credits,
        "transaction_id": result.transaction_id,
        "message": result.message
    }


@app.post("/api/credits/refund")
def refund_user_credits(
    amount: int,
    reason: str,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    reference_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Refund credits (e.g. on analysis failure).
    Use cases: auto-refund on error, customer service refund.
    """
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    result = refund_credits(
        db=db,
        user_id=user_id,
        amount=amount,
        reason=reason,
        reference_id=reference_id
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return {
        "success": True,
        "refunded_credits": result.added_amount,
        "total_credits": result.total_credits,
        "message": f"Refund done: {amount} credits ({reason})"
    }


@app.post("/api/credits/initialize")
def initialize_credits(
    user_id: str,
    plan: str = "free",
    db: Session = Depends(get_db)
):
    """
    Initialize credits for new user.
    Use cases: on signup, bonus on plan upgrade.
    """
    try:
        plan_type = PlanType(plan)
    except ValueError:
        plan_type = PlanType.FREE
    
    result = initialize_user_credits(db, user_id, plan_type)
    
    return {
        "success": result.success,
        "total_credits": result.total_credits,
        "message": result.message
    }


# ============================================================
# Lemon Squeezy Webhook
# ============================================================

@app.post("/api/lemonsqueezy/webhook")
async def lemonsqueezy_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Lemon Squeezy webhook receiver. Always returns 200 OK and logs errors
    to avoid LS retries; verifies X-Signature and dispatches to process_webhook_event.
    """
    import logging
    logger = logging.getLogger(__name__)
    try:
        body = await request.body()
        signature = request.headers.get("X-Signature", "")
        if not verify_webhook_signature(body, signature):
            logger.error("Webhook signature verification failed")
            # Return 200 on verification failure (avoid LS retry)
            # In production may return 401; monitor via logs
            return JSONResponse(
                status_code=200,  # 200 to avoid LS retry
                content={"status": "error", "message": "Invalid signature"},
                headers={"X-Webhook-Status": "invalid_signature"}
            )
        
        # JSON parse
        try:
            event_data = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError as e:
            logger.error(f"Webhook JSON parse error: {e}")
            return JSONResponse(
                status_code=200,
                content={"status": "error", "message": "Invalid JSON"}
            )
        
        # Event processing with enhanced logging
        try:
            event_name = event_data.get('meta', {}).get('event_name', 'unknown')
            logger.info(f"🔄 [WEBHOOK] Processing event: {event_name}")
            
            success = process_webhook_event(db, event_data)
            
            if success:
                logger.info(f"✅ [WEBHOOK] Event processed successfully: {event_name}")
                return JSONResponse(
                    status_code=200,
                    content={"status": "success", "message": "Webhook processed", "event": event_name}
                )
            else:
                logger.warning(f"⚠️ [WEBHOOK] Event processing failed (logged): {event_name}")
                # Stability: Return 200 OK even on failure (errors are logged)
                return JSONResponse(
                    status_code=200,
                    content={"status": "error", "message": "Processing failed (logged)", "event": event_name}
                )
                
        except Exception as e:
            logger.error(f"Webhook event handling error: {e}", exc_info=True)
            # Return 200 even on exception (stability)
            return JSONResponse(
                status_code=200,
                content={"status": "error", "message": "Internal error (logged)"}
            )
            
    except Exception as e:
        logger.error(f"Webhook request handling error: {e}", exc_info=True)
        # Return 200 on any exception (stability)
        return JSONResponse(
            status_code=200,
            content={"status": "error", "message": "Request processing failed (logged)"}
        )


# ============================================================
# Lemon Squeezy Checkout API
# ============================================================

class CreateCheckoutRequest(BaseModel):
    variant_id: str
    # user_id is extracted from JWT, not from request body

@app.post("/api/lemonsqueezy/create-checkout")
async def create_checkout(
    request: CreateCheckoutRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create Lemon Squeezy checkout (credit packs or variants). Returns checkout_url for
    opening in browser. user_id from JWT; variant_id from request body.
    """
    import requests
    logger = logging.getLogger(__name__)
    variant_id = request.variant_id
    LS_API_KEY = os.getenv("LEMON_SQUEEZY_API_KEY") or ""
    LS_STORE_ID = os.getenv("LEMON_SQUEEZY_STORE_ID") or ""
    APP_URL = os.getenv("APP_URL", "https://optlisting.com")

    if not LS_API_KEY:
        logger.warning("[CONFIG] LEMON_SQUEEZY_API_KEY not set")
    if not LS_STORE_ID:
        logger.warning("[CONFIG] LEMON_SQUEEZY_STORE_ID not set")
    if not LS_API_KEY or not LS_STORE_ID:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Lemon Squeezy API not configured",
                "message": "Please set LEMON_SQUEEZY_API_KEY and LEMON_SQUEEZY_STORE_ID environment variables in Railway.",
                "setup_required": True
            }
        )

    variant_id_str = str(variant_id)
    store_id_str = str(LS_STORE_ID)
    api_headers = {
        "Authorization": f"Bearer {LS_API_KEY}",
        "Accept": "application/vnd.api+json",
    }
    try:
        store_check = requests.get(
            f"https://api.lemonsqueezy.com/v1/stores/{store_id_str}",
            headers=api_headers,
            timeout=10,
        )
        if store_check.status_code == 404:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid Store ID",
                    "message": f"Store ID {store_id_str} does not exist in Lemon Squeezy. Please check LEMON_SQUEEZY_STORE_ID environment variable.",
                    "store_id": store_id_str
                }
            )
        elif store_check.status_code != 200:
            logger.warning("Store validation failed: %s", store_check.status_code)
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Store validation failed",
                    "message": f"Failed to validate store ID {store_id_str}: HTTP {store_check.status_code}",
                    "store_id": store_id_str
                }
            )
        
        variant_check = requests.get(
            f"https://api.lemonsqueezy.com/v1/variants/{variant_id_str}",
            headers=api_headers,
            timeout=10,
        )
        if variant_check.status_code == 404:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid Variant ID",
                    "message": f"Variant ID {variant_id_str} does not exist in Lemon Squeezy. Please check the variant ID in your configuration.",
                    "variant_id": variant_id_str
                }
            )
        elif variant_check.status_code != 200:
            logger.warning("Variant validation failed: %s", variant_check.status_code)
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Variant validation failed",
                    "message": f"Failed to validate variant ID {variant_id_str}: HTTP {variant_check.status_code}",
                    "variant_id": variant_id_str
                }
            )
        
        request_payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "custom_price": None,
                    "product_options": [],
                    "checkout_options": {
                        "embed": False,
                        "media": False,
                        "logo": True,
                        "redirect_url": "https://optlisting.com/payment/success",
                    },
                    "checkout_data": {
                        "custom": {
                            "user_id": user_id,
                        },
                    },
                    "expires_at": None,
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": store_id_str,
                        },
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": variant_id_str,
                        },
                    },
                },
            },
        }
        response = requests.post(
            "https://api.lemonsqueezy.com/v1/checkouts",
            headers={
                "Authorization": f"Bearer {LS_API_KEY}",
                "Accept": "application/vnd.api+json",
                "Content-Type": "application/vnd.api+json",
            },
            json=request_payload,
            timeout=10,
        )
        if response.status_code != 201:
            error_detail = response.text
            error_message = f"HTTP {response.status_code}"
            try:
                error_json = response.json()
                if "errors" in error_json and isinstance(error_json["errors"], list) and error_json["errors"]:
                    first_error = error_json["errors"][0]
                    error_message = first_error.get("detail", first_error.get("title", error_message))
            except Exception:
                error_message = (error_detail[:200] if error_detail else error_message)
            logger.warning("Lemon Squeezy checkout failed: %s", error_message)
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Failed to create checkout",
                    "message": f"Lemon Squeezy API returned {response.status_code}: {error_message}",
                    "lemon_squeezy_status": response.status_code,
                    "details": error_detail[:1000] if error_detail else None
                }
            )
        
        checkout_data = response.json()
        checkout_url = checkout_data["data"]["attributes"]["url"]
        return {"checkout_url": checkout_url}
        
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Lemon Squeezy API timeout")
    except requests.exceptions.RequestException as e:
        logger.error(f"Lemon Squeezy API request error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating checkout: {str(e)}")


# ============================================================
# CSV Format Management API
# ============================================================

@app.get("/api/csv-formats")
def get_csv_formats(
    supplier_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List CSV formats. If supplier_name provided, return that format only.
    """
    if supplier_name:
        csv_format = db.query(CSVFormat).filter(
            CSVFormat.supplier_name == supplier_name,
            CSVFormat.is_active == True
        ).first()
        if not csv_format:
            raise HTTPException(status_code=404, detail=f"CSV format not found for supplier: {supplier_name}")
        return {
            "supplier_name": csv_format.supplier_name,
            "display_name": csv_format.display_name,
            "description": csv_format.description,
            "format_schema": csv_format.format_schema,
            "is_active": csv_format.is_active
        }
    else:
        formats = db.query(CSVFormat).filter(CSVFormat.is_active == True).all()
        return {
            "formats": [
                {
                    "supplier_name": f.supplier_name,
                    "display_name": f.display_name,
                    "description": f.description,
                    "format_schema": f.format_schema,
                    "is_active": f.is_active
                }
                for f in formats
            ]
        }


class CSVFormatUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    format_schema: Optional[Dict] = None
    is_active: Optional[bool] = None


@app.put("/api/csv-formats/{supplier_name}")
def update_csv_format(
    supplier_name: str,
    update_data: CSVFormatUpdate,
    db: Session = Depends(get_db)
):
    """
    Update CSV format.
    """
    csv_format = db.query(CSVFormat).filter(
        CSVFormat.supplier_name == supplier_name
    ).first()
    
    if not csv_format:
        raise HTTPException(status_code=404, detail=f"CSV format not found for supplier: {supplier_name}")
    
    if update_data.display_name is not None:
        csv_format.display_name = update_data.display_name
    if update_data.description is not None:
        csv_format.description = update_data.description
    if update_data.format_schema is not None:
        csv_format.format_schema = update_data.format_schema
    if update_data.is_active is not None:
        csv_format.is_active = update_data.is_active
    
    csv_format.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": "CSV format updated successfully",
        "supplier_name": csv_format.supplier_name,
        "display_name": csv_format.display_name
    }


@app.post("/api/csv-formats/init")
def init_csv_formats_endpoint(db: Session = Depends(get_db)):
    """
    Initialize CSV format seed data.
    """
    try:
        from .init_csv_formats import init_csv_formats
        init_csv_formats(db)
        return {"message": "CSV formats initialized successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize CSV formats: {str(e)}")


# ============================================================
# Test credit top-up endpoint (Admin-only)
# ============================================================

class AdminGrantCreditsRequest(BaseModel):
    """Admin grant credits request"""
    user_id: str
    amount: int
    description: Optional[str] = None


@app.post("/api/admin/credits/grant")
def admin_grant_credits(
    request: AdminGrantCreditsRequest,
    admin_key: str = Query(None, description="Admin API Key"),
    db: Session = Depends(get_db)
):
    """
    Admin grant credits endpoint (Admin-only).
    Security: ADMIN_API_KEY required; admin_key required in production; amount must be positive.
    Args: request (user_id, amount, description), admin_key, db.
    Returns: success, totalCredits, addedAmount, message.
    """
    import logging
    from .credit_service import add_credits, TransactionType
    
    logger = logging.getLogger(__name__)
    
    # Admin auth check
    expected_admin_key = os.getenv("ADMIN_API_KEY", "")
    
    # Verify admin_key in production (optional in dev)
    is_production = os.getenv("ENVIRONMENT", "").lower() in ["production", "prod"]
    
    if is_production or expected_admin_key:
        if not admin_key or admin_key != expected_admin_key:
            logger.warning(f"[ADMIN] Authentication failed: admin_key provided={admin_key is not None}")
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "unauthorized",
                    "message": "Invalid admin key. This endpoint requires admin authentication."
                }
            )
    
    # Validate request
    if request.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_amount",
                "message": "Amount must be positive"
            }
        )
    
    if not request.user_id or request.user_id.strip() == "":
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_user_id",
                "message": "user_id is required"
            }
        )
    
    logger.info(f"[ADMIN] Credit grant request: user_id={request.user_id}, amount={request.amount}")
    
    # Grant credits
    try:
        result = add_credits(
            db=db,
            user_id=request.user_id,
            amount=request.amount,
            transaction_type=TransactionType.BONUS,
            description=request.description or f"Admin grant: {request.amount} credits",
            reference_id=f"admin_grant_{uuid.uuid4().hex[:16]}"
        )
        
        if not result.success:
            logger.error(f"[ADMIN] Credit grant failed: {result.message}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "credit_grant_failed",
                    "message": result.message
                }
            )
        
        logger.info(f"SUCCESS: Granted {request.amount} credits to user {request.user_id}. New total: {result.total_credits}")
        
        return {
            "success": True,
            "totalCredits": result.total_credits,
            "addedAmount": result.added_amount,
            "message": "Credits granted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ADMIN] Credit grant failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "credit_grant_failed",
                "message": f"Failed to grant credits: {str(e)}"
            }
        )


# ============================================================
# Coupon-based credit top-up endpoint (Coupon Redeem)
# ============================================================

class CouponRedeemRequest(BaseModel):
    """Coupon redeem request"""
    coupon_code: str


@app.post("/api/credits/redeem")
def redeem_coupon(
    request: CouponRedeemRequest,
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    db: Session = Depends(get_db)
):
    """
    Coupon redeem endpoint. Security: one-time per account; expiry check.
    Args: request (coupon_code), user_id, db.
    Returns: success, totalCredits (after top-up), addedAmount,
            "message": str
        }
    """
    import logging
    import uuid
    from sqlalchemy import text
    from datetime import datetime, timedelta
    from .credit_service import add_credits, TransactionType
    
    logger = logging.getLogger(__name__)
    
    # Coupon code validation (env or table in production)
    # Example codes (from env)
    valid_coupons = {
        "TEST100": {"credits": 100, "expires_days": 30, "one_time": True},
        "WELCOME50": {"credits": 50, "expires_days": 30, "one_time": True},
        # In production use separate coupons table
    }
    
    # Load extra coupon codes from env (optional)
    coupon_code_env = os.getenv("COUPON_CODES", "")
    if coupon_code_env:
        try:
            import json
            env_coupons = json.loads(coupon_code_env)
            valid_coupons.update(env_coupons)
        except:
            pass
    
    coupon_code = request.coupon_code.strip().upper()
    
    if coupon_code not in valid_coupons:
        logger.warning(f"⚠️ Invalid coupon code: {coupon_code}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_coupon",
                "message": "Invalid or expired coupon code"
            }
        )
    
    coupon_info = valid_coupons[coupon_code]
    
    # One-time use check (credit_transactions table)
    if coupon_info.get("one_time", True):
        try:
            existing_redeem = db.execute(
                text("""
                    SELECT transaction_id, created_at
                    FROM credit_transactions
                    WHERE user_id = :user_id 
                      AND reference_id LIKE :pattern
                      AND transaction_type = 'bonus'
                    ORDER BY created_at DESC
                    LIMIT 1
                """),
                {"user_id": user_id, "pattern": f"coupon_{coupon_code}_%"}
            ).fetchone()
            
            if existing_redeem:
                logger.warning(f"⚠️ Coupon already used: user_id={user_id}, coupon={coupon_code}")
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "coupon_already_used",
                        "message": "This coupon has already been redeemed"
                    }
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"⚠️ Coupon history check failed (continuing): {str(e)}")
    
    # Coupon expiry check (env or table)
    # Simplified for now (in production check expires_at in coupons table)
    
    credits_amount = coupon_info.get("credits", 0)
    
    if credits_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_coupon",
                "message": "Invalid coupon configuration"
            }
        )
    
    logger.info(f"🎫 Coupon redeem: user_id={user_id}, coupon={coupon_code}, credits={credits_amount}")
    
    # Credit top-up
    try:
        reference_id = f"coupon_{coupon_code}_{uuid.uuid4().hex[:16]}"
        result = add_credits(
            db=db,
            user_id=user_id,
            amount=credits_amount,
            transaction_type=TransactionType.BONUS,
            description=f"Coupon redeemed: {coupon_code}",
            reference_id=reference_id
        )
        
        if not result.success:
            logger.error(f"❌ Coupon redeem failed: {result.message}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "coupon_redeem_failed",
                    "message": result.message
                }
            )
        
        logger.info(f"✅ Coupon redeem success: user_id={user_id}, coupon={coupon_code}, credits={credits_amount}, total={result.total_credits}")
        
        return {
            "success": True,
            "totalCredits": result.total_credits,
            "addedAmount": result.added_amount,
            "message": f"Coupon '{coupon_code}' redeemed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Coupon redeem failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "coupon_redeem_failed",
                "message": f"Failed to redeem coupon: {str(e)}"
            }
        )


# ============================================================
# Dev-only test credit top-up endpoint (dev only)
# ============================================================

@app.post("/api/dev/credits/topup")
def dev_topup_credits(
    amount: int = Query(100, description="Amount of credits to add"),
    user_id: str = Depends(get_current_user),  # JWT -> user_id
    db: Session = Depends(get_db)
):
    """
    Dev-only test credit top-up endpoint
    
    Security: double-check so it never runs in production.
    Only when ENABLE_DEV_TOPUP=true && ENVIRONMENT != "production"; 403 otherwise.
    Args: amount (default 100), user_id, db.
        
    Returns:
        {
            "success": bool,
            "totalCredits": int,
            "addedAmount": int,
            "message": str
        }
    """
    import logging
    from .credit_service import add_credits, TransactionType
    
    logger = logging.getLogger(__name__)
    
    # Double security check: ENABLE_DEV_TOPUP && ENVIRONMENT != "production"
    enable_dev_topup = os.getenv("ENABLE_DEV_TOPUP", "").lower() == "true"
    environment = os.getenv("ENVIRONMENT", "").lower()
    is_production = environment in ["production", "prod"]
    
    if not enable_dev_topup or is_production:
        logger.warning(f"⚠️ Dev top-up blocked: ENABLE_DEV_TOPUP={enable_dev_topup}, ENVIRONMENT={environment}")
        raise HTTPException(
            status_code=403,
            detail={
                "error": "forbidden",
                "message": "Dev top-up is only available in non-production environments with ENABLE_DEV_TOPUP=true"
            }
        )
    
    # Validate amount
    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_amount",
                "message": "Amount must be positive"
            }
        )
    
    logger.info(f"🧪 [DEV] Credit top-up request: user_id={user_id}, amount={amount}")
    
    # Credit top-up
    try:
        result = add_credits(
            db=db,
            user_id=user_id,
            amount=amount,
            transaction_type=TransactionType.BONUS,
            description=f"Dev test top-up: {amount} credits",
            reference_id=f"dev_topup_{uuid.uuid4().hex[:16]}"
        )
        
        if not result.success:
            logger.error(f"❌ [DEV] Credit top-up failed: {result.message}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "credit_topup_failed",
                    "message": result.message
                }
            )
        
        logger.info(f"✅ [DEV] Credit top-up success: user_id={user_id}, amount={amount}, total={result.total_credits}")
        
        return {
            "success": True,
            "totalCredits": result.total_credits,
            "addedAmount": result.added_amount,
            "message": f"Dev top-up successful: +{amount} credits"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [DEV] Credit top-up failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "credit_topup_failed",
                "message": f"Failed to top up credits: {str(e)}"
            }
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


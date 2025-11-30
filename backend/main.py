from fastapi import FastAPI, Depends, HTTPException, Request
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
from pydantic import BaseModel

from .models import init_db, get_db, Listing, DeletionLog, Profile, Base, engine
from .services import detect_source, extract_supplier_info, analyze_zombie_listings, generate_export_csv
from .dummy_data import generate_dummy_listings
from .webhooks import verify_webhook_signature, process_webhook_event
from .ebay_webhook import router as ebay_webhook_router

app = FastAPI(title="OptListing API", version="1.2.0")

# eBay Webhook Router 등록
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
import os
import re

# Define the allowed exact origins (for production build)
# CRITICAL: Include all variations of production URL (with and without trailing slash)
allowed_origins = [
    # Production Vercel deployment - All variations (CRITICAL for CORS)
    "https://optlisting.vercel.app",
    "https://optlisting.vercel.app/",
    "https://www.optlisting.vercel.app",
    "https://www.optlisting.vercel.app/",
    # Actual deployed Vercel domain
    "https://optlisting-three.vercel.app",
    "https://optlisting-three.vercel.app/",
    "https://optlisting-1fev8br9z-optlistings-projects.vercel.app",
    "https://optlisting-1fev8br9z-optlistings-projects.vercel.app/",
    
    # Local development environments
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

# Add environment variable for additional frontend URLs if provided
frontend_url = os.getenv("FRONTEND_URL", "")
if frontend_url:
    allowed_origins.append(frontend_url)
    # Also add with trailing slash if not present
    if not frontend_url.endswith("/"):
        allowed_origins.append(f"{frontend_url}/")

# Filter out empty strings
allowed_origins = [origin for origin in allowed_origins if origin]

# Define regex pattern to cover all Vercel deploy previews (*.vercel.app)
# CRITICAL: This regex MUST cover all Vercel subdomains (production, preview, branch deployments)
# Pattern matches: https://*.vercel.app (any subdomain)
vercel_regex = r"https://.*\.vercel\.app"

# CORS configuration for Railway + Vercel deployment
# CRITICAL: Ensure all Vercel domains are explicitly allowed
# Add CORS middleware FIRST, before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Explicit production and local URLs
    allow_origin_regex=vercel_regex,  # CRITICAL: Regex pattern for all Vercel subdomains
    allow_credentials=True,  # Enable credentials for authenticated requests
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Exception handlers to ensure CORS headers are always present
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions with CORS headers"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Handle validation errors with CORS headers"""
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle all other exceptions and ensure CORS headers are present"""
    import traceback
    traceback.print_exc()
    
    # Return error response with CORS headers
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
            "Access-Control-Allow-Headers": "*",
        }
    )

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    """
    Initialize database connection and create tables.
    This function must not crash the server if database connection fails.
    """
    try:
        # Test database connection first
        print("Testing database connection...")
        from .models import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database connection successful")
        
        # Create tables if they don't exist (works for both SQLite and Supabase)
        print("Creating database tables if they don't exist...")
        Base.metadata.create_all(bind=engine)
        print("Database tables created/verified successfully")
        
        # Generate dummy data on first startup (non-blocking)
        try:
            db = next(get_db())
            try:
                count = db.query(Listing).count()
                if count == 0:
                    print("Generating 5000 dummy listings... This may take a moment.")
                    generate_dummy_listings(db, count=5000, user_id="default-user")
                    print("Dummy data generated successfully")
                else:
                    print(f"Database already contains {count} listings")
            except Exception as e:
                print(f"Error generating dummy data: {e}")
                import traceback
                traceback.print_exc()
            finally:
                db.close()
        except Exception as e:
            print(f"Warning: Could not generate dummy data: {e}")
            # Don't crash the server if dummy data generation fails
            import traceback
            traceback.print_exc()
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


@app.get("/api/listings")
def get_listings(
    skip: int = 0,
    limit: int = 100,
    store_id: Optional[str] = None,  # Store ID filter - 'all' or None means all stores
    user_id: str = "default-user",  # Default user ID for MVP phase
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
                "watch_count": (l.metrics.get('views') if l.metrics and isinstance(l.metrics, dict) and 'views' in l.metrics else None) or getattr(l, 'watch_count', 0) or 0
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
    min_days: int = 3,
    max_sales: int = 0,
    max_watch_count: int = 10,
    supplier_filter: str = "All",
    marketplace: str = "eBay",  # MVP Scope: Default to eBay (only eBay and Shopify supported)
    store_id: Optional[str] = None,  # Store ID filter - 'all' or None means all stores
    user_id: str = "default-user",  # Default user ID for backward compatibility
    skip: int = 0,  # Pagination: skip N records
    limit: int = 100,  # Pagination: limit to N records (default 100, max 1000)
    db: Session = Depends(get_db)
):
    """
    Zombie Filter API
    Filters listings based on dynamic criteria:
    - marketplace: Filter by marketplace - MVP Scope: "eBay" or "Shopify" only (default: "eBay")
    - min_days: Minimum days old (default: 3)
    - max_sales: Maximum sales count (default: 0)
    - max_watch_count: Maximum watch count/views (default: 10)
    - supplier_filter: Filter by supplier - "All", "Amazon", "Walmart", etc. (default: "All")
    - skip: Pagination offset (default: 0)
    - limit: Pagination limit (default: 100, max: 1000)
    
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
    # ✅ FIX: platform 필드가 없으면 marketplace 사용
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
    zombies, zombie_breakdown = analyze_zombie_listings(
        db,
        user_id=user_id,
        min_days=min_days, 
        max_sales=max_sales,
        max_watch_count=max_watch_count,
        supplier_filter=supplier_filter,
        platform_filter=marketplace,
        store_id=store_id,
        skip=skip,
        limit=limit
    )
    
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
                "sold_qty": (z.metrics.get('sales') if z.metrics and 'sales' in z.metrics else None) or z.sold_qty or 0,
                "watch_count": (z.metrics.get('views') if z.metrics and 'views' in z.metrics else None) or z.watch_count or 0,
                "is_global_winner": bool(getattr(z, 'is_global_winner', 0)),  # Cross-Platform Health Check flag
                "is_active_elsewhere": bool(getattr(z, 'is_active_elsewhere', 0))  # Cross-Platform Activity Check flag
            }
            for z in zombies
        ]
    }


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
    zombies, _ = analyze_zombie_listings(
        db, 
        user_id="default-user",  # Default user ID
        min_days=min_days, 
        max_sales=max_sales,
        max_watch_count=max_watch_count,
        supplier_filter=supplier_filter
    )
    
    if not zombies:
        raise HTTPException(status_code=404, detail="No zombie listings found")
    
    # Generate CSV (with snapshot logging)
    csv_content = generate_export_csv(zombies, export_mode, db=db, user_id="default-user")
    
    # Determine filename
    filename_map = {
        "autods": "zombies_autods.csv",
        "yaballe": "zombies_yaballe.csv",
        "ebay": "zombies_ebay.csv"
    }
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename_map[export_mode]}"
        }
    )


class ExportQueueRequest(BaseModel):
    items: List[Dict]
    target_tool: Optional[str] = None  # New parameter: "autods", "wholesale2b", "shopify_matrixify", etc.
    export_mode: Optional[str] = None  # Legacy parameter for backward compatibility
    mode: Optional[str] = "delete_list"  # "delete_list" (default) or "full_sync_list"
    store_id: Optional[str] = None  # Store ID for full_sync_list mode

@app.post("/api/export-queue")
def export_queue_csv(
    request: ExportQueueRequest,
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
    
    # Generate CSV directly from items (dictionaries) with target_tool (with snapshot logging)
    csv_content = generate_export_csv(
        items, 
        target_tool, 
        db=db, 
        user_id="default-user",
        mode=mode,
        store_id=request.store_id
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
        
        # Get total count
        total_count = db.query(DeletionLog).count()
        
        # Get logs (most recent first)
        logs = db.query(DeletionLog).order_by(DeletionLog.deleted_at.desc()).offset(skip).limit(limit).all()
        
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

@app.patch("/api/listing/{listing_id}")
def update_listing(
    listing_id: int,
    request: UpdateListingRequest,
    db: Session = Depends(get_db)
):
    """
    Update a listing's supplier (manual override)
    Allows users to correct auto-detected suppliers
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Validate supplier if provided
    if request.supplier is not None:
        valid_suppliers = ["Amazon", "Walmart", "AliExpress", "CJ Dropshipping", "Home Depot", "Wayfair", "Costco", "Wholesale2B", "Spocket", "SaleHoo", "Inventory Source", "Dropified", "Unverified", "Unknown"]
        if request.supplier not in valid_suppliers:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid supplier. Must be one of: {', '.join(valid_suppliers)}"
            )
        listing.supplier_name = request.supplier
    
    db.commit()
    db.refresh(listing)
    
    return {
        "id": listing.id,
        "item_id": getattr(listing, 'item_id', None) or getattr(listing, 'ebay_item_id', None) or "",
        "ebay_item_id": getattr(listing, 'item_id', None) or getattr(listing, 'ebay_item_id', None) or "",  # Backward compatibility
        "title": listing.title,
        "supplier_name": listing.supplier_name,
        "supplier": listing.supplier_name,  # Backward compatibility
        "message": "Listing updated successfully"
    }


@app.post("/api/dummy-data")
def create_dummy_data(
    count: int = 50,
    user_id: str = "default-user",
    db: Session = Depends(get_db)
):
    """Generate dummy listings for testing with new hybrid schema"""
    # Ensure tables exist before attempting to delete
    Base.metadata.create_all(bind=engine)
    
    # Clear all existing listings before generating new dummy data
    db.query(Listing).delete()
    db.commit()
    
    generate_dummy_listings(db, count=count, user_id=user_id)
    return {"message": f"Generated {count} dummy listings"}


@app.post("/webhooks/lemonsqueezy")
async def lemonsqueezy_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Lemon Squeezy 웹훅 엔드포인트
    안정성 원칙: 모든 에러는 로깅하고 200 OK 반환 (LS 재시도 방지)
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # 원본 요청 본문 읽기 (시그니처 검증용)
        body = await request.body()
        
        # X-Signature 헤더 확인
        signature = request.headers.get("X-Signature", "")
        
        # 시그니처 검증
        if not verify_webhook_signature(body, signature):
            logger.error("웹훅 시그니처 검증 실패")
            # 안정성: 검증 실패 시에도 200 OK 반환 (LS 재시도 방지)
            # 실제 운영에서는 401을 반환할 수도 있지만, 로깅으로 모니터링
            return JSONResponse(
                status_code=200,  # LS 재시도 방지를 위해 200 반환
                content={"status": "error", "message": "Invalid signature"},
                headers={"X-Webhook-Status": "invalid_signature"}
            )
        
        # JSON 파싱
        try:
            event_data = json.loads(body.decode('utf-8'))
        except json.JSONDecodeError as e:
            logger.error(f"웹훅 JSON 파싱 오류: {e}")
            return JSONResponse(
                status_code=200,
                content={"status": "error", "message": "Invalid JSON"}
            )
        
        # 이벤트 처리
        try:
            success = process_webhook_event(db, event_data)
            
            if success:
                logger.info("웹훅 이벤트 처리 성공")
                return JSONResponse(
                    status_code=200,
                    content={"status": "success", "message": "Webhook processed"}
                )
            else:
                logger.warning("웹훅 이벤트 처리 실패 (로깅됨)")
                # 안정성: 처리 실패해도 200 OK 반환 (에러는 로깅됨)
                return JSONResponse(
                    status_code=200,
                    content={"status": "error", "message": "Processing failed (logged)"}
                )
                
        except Exception as e:
            logger.error(f"웹훅 이벤트 처리 중 예상치 못한 오류: {e}", exc_info=True)
            # 안정성: 예외 발생해도 200 OK 반환
            return JSONResponse(
                status_code=200,
                content={"status": "error", "message": "Internal error (logged)"}
            )
            
    except Exception as e:
        logger.error(f"웹훅 요청 처리 중 예상치 못한 오류: {e}", exc_info=True)
        # 안정성: 모든 예외를 잡아서 200 OK 반환
        return JSONResponse(
            status_code=200,
            content={"status": "error", "message": "Request processing failed (logged)"}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


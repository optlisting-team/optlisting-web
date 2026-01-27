import os
from dotenv import load_dotenv
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import date, datetime

# Load environment variables from .env file
load_dotenv()

Base = declarative_base()


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    # ✅ 멀티테넌시: ebay_item_id의 unique 제약조건 제거
    # 대신 (user_id, ebay_item_id) 복합 UNIQUE 제약조건을 마이그레이션 SQL로 생성
    ebay_item_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    sku = Column(String, nullable=False)
    image_url = Column(String, nullable=False)
    brand = Column(String, nullable=True)  # Brand name for forensic source detection
    upc = Column(String, nullable=True)  # UPC/EAN code for source identification
    marketplace = Column(String, nullable=True, default="eBay")  # "eBay", "Amazon", "Shopify", "Walmart"
    source = Column(String, nullable=False)  # "Amazon", "Walmart", "AliExpress", "CJ Dropshipping", "Home Depot", "Wayfair", "Costco", "Unknown"
    price = Column(Float, nullable=False)
    date_listed = Column(Date, nullable=False)
    sold_qty = Column(Integer, default=0)
    watch_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)  # Total view count from eBay API (HitCount)
    
    # JSONB fields (added via migration)
    metrics = Column(JSONB, default={}, nullable=True)
    analysis_meta = Column(JSONB, default={}, nullable=True)
    raw_data = Column(JSONB, default={}, nullable=True)  # Raw JSON data from eBay API
    
    # Additional fields (added via migration)
    item_id = Column(String, nullable=True)  # Generic item ID (ebay_item_id와 별도)
    platform = Column(String, nullable=True)  # Generic platform (marketplace와 별도)
    user_id = Column(String, nullable=True, index=True)
    supplier_id = Column(String, nullable=True)
    supplier_name = Column(String, nullable=True)  # Supplier name from CSV matching
    last_synced_at = Column(DateTime, nullable=True)  # Last sync timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Listing(id={self.id}, title={self.title[:50]}, user_id={self.user_id})>"


class DeletionLog(Base):
    __tablename__ = "deletion_logs"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(String, nullable=False, index=True)  # eBay Item ID or generic item ID
    title = Column(String, nullable=False)
    sku = Column(String, nullable=True)
    user_id = Column(String, nullable=True, index=True)
    platform = Column(String, nullable=True)  # "eBay", "Amazon", "Shopify", "Walmart"
    marketplace = Column(String, nullable=True)  # "eBay", "Amazon", etc.
    source = Column(String, nullable=True)  # "Amazon", "Walmart", etc.
    deleted_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    # 멀티테넌시: user_id 필드 추가 (기존 데이터는 nullable로 유지, 마이그레이션 필요)
    user_id = Column(String, nullable=True, index=True)
    # JSONB snapshot 필드 (기존 스키마에 있을 수 있음 - 확인 필요)
    snapshot = Column(JSONB, nullable=True)

    def __repr__(self):
        return f"<DeletionLog(item_id={self.item_id}, title={self.title}, deleted_at={self.deleted_at})>"


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, nullable=False, index=True)  # 사용자 고유 ID
    
    # Lemon Squeezy 구독 정보
    ls_customer_id = Column(String, nullable=True, index=True)  # Lemon Squeezy Customer ID
    ls_subscription_id = Column(String, nullable=True, index=True)  # Lemon Squeezy Subscription ID
    subscription_status = Column(String, default='inactive')  # 'active', 'cancelled', 'expired', 'inactive'
    subscription_plan = Column(String, nullable=True)  # 'professional', 'free', etc.
    
    # 플랜 제한
    total_listings_limit = Column(Integer, default=100)  # Pro 플랜: 무제한 또는 큰 수, Free: 100
    
    # 크레딧 시스템 (3-Way Hybrid Pricing)
    purchased_credits = Column(Integer, default=0, nullable=False)  # 총 구매/부여 크레딧
    consumed_credits = Column(Integer, default=0, nullable=False)   # 총 사용 크레딧
    current_plan = Column(String, default='free')  # 'free', 'starter', 'pro', 'enterprise'
    # free_tier_count는 마이그레이션(add_free_tier_count.sql) 실행 전까지 주석 처리
    # 마이그레이션 실행 후 아래 주석을 해제하세요:
    # free_tier_count = Column(Integer, default=0, nullable=False)  # 무료티어 사용 횟수 (최대 3회)
    
    # eBay OAuth 토큰
    ebay_access_token = Column(String, nullable=True)  # eBay Access Token (2시간 만료)
    ebay_refresh_token = Column(String, nullable=True)  # eBay Refresh Token (18개월 만료)
    ebay_token_expires_at = Column(DateTime, nullable=True)  # Access Token 만료 시간
    ebay_user_id = Column(String, nullable=True)  # eBay User ID
    ebay_token_updated_at = Column(DateTime, nullable=True)  # 토큰 마지막 갱신 시간
    ebay_connected = Column(Boolean, default=False)  # eBay 연결 상태
    
    # 메타데이터
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Profile(user_id={self.user_id}, subscription_status={self.subscription_status}, plan={self.subscription_plan})>"


class CSVFormat(Base):
    """
    공급처별 공식 CSV 포맷 정의
    각 공급처/도구별로 CSV 컬럼 구조와 데이터 매핑 규칙을 저장
    """
    __tablename__ = "csv_formats"

    id = Column(Integer, primary_key=True, index=True)
    supplier_name = Column(String, nullable=False, index=True)  # 공급처/도구 이름 (e.g., "autods", "wholesale2b", "shopify_matrixify")
    display_name = Column(String, nullable=True)  # 표시용 이름 (e.g., "AutoDS", "Wholesale2B")
    
    # CSV 포맷 정의 (JSONB로 저장)
    # 예: {
    #   "columns": ["Source ID", "File Action"],
    #   "column_order": ["Source ID", "File Action"],
    #   "mappings": {
    #     "Source ID": {"source": "supplier_id", "fallback": "sku"},
    #     "File Action": {"value": "delete"}
    #   }
    # }
    format_schema = Column(JSONB, nullable=False)  # CSV 포맷 스키마
    
    # 메타데이터
    description = Column(String, nullable=True)  # 포맷 설명
    is_active = Column(Boolean, default=True, nullable=False)  # 활성화 여부
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<CSVFormat(supplier_name={self.supplier_name}, display_name={self.display_name})>"


class CSVProcessingTask(Base):
    """
    CSV Processing Task Queue - Persistent task state for async processing
    Allows task recovery after server restarts
    """
    __tablename__ = "csv_processing_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, nullable=False, index=True)  # Unique task identifier
    user_id = Column(String, nullable=False, index=True)  # User who uploaded the file
    status = Column(String, default='queued', nullable=False)  # 'queued', 'processing', 'completed', 'failed'
    
    # File metadata
    file_name = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)  # File size in bytes
    estimated_rows = Column(Integer, nullable=True)
    
    # Processing results
    total_rows = Column(Integer, default=0)
    valid_rows = Column(Integer, default=0)
    invalid_rows = Column(Integer, default=0)
    matched_listings = Column(Integer, default=0)
    updated_listings = Column(Integer, default=0)
    processing_time_ms = Column(Float, nullable=True)
    
    # Error tracking
    error_message = Column(String, nullable=True)
    error_details = Column(JSONB, nullable=True)  # Detailed error information
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Task metadata (renamed from 'metadata' to avoid SQLAlchemy reserved keyword conflict)
    task_metadata = Column(JSONB, nullable=True)  # Additional task metadata

    def __repr__(self):
        return f"<CSVProcessingTask(task_id={self.task_id}, status={self.status}, user_id={self.user_id})>"


# Database setup
# Use Supabase PostgreSQL if DATABASE_URL is set, otherwise fall back to SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Fix: Remove quotes and leading = if present (Railway sometimes adds these)
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.strip('"').strip("'").lstrip('=').strip()

# Initialize logger for database configuration
import logging
db_logger = logging.getLogger(__name__)

# Debug: Log DATABASE_URL status
db_logger.debug(f"DATABASE_URL exists: {bool(DATABASE_URL)}")
db_logger.debug(f"DATABASE_URL starts with postgresql: {DATABASE_URL.startswith(('postgresql://', 'postgres://')) if DATABASE_URL else False}")
if DATABASE_URL:
    # Log first 50 chars only (hide password)
    db_logger.debug(f"DATABASE_URL prefix: {DATABASE_URL[:50]}...")

if DATABASE_URL and DATABASE_URL.startswith(('postgresql://', 'postgres://')):
    # Use Supabase PostgreSQL
    db_logger.info("Using Supabase PostgreSQL database")
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
else:
    # Fallback to SQLite for local development
    db_logger.warning("DATABASE_URL not set or invalid, falling back to SQLite")
    db_logger.warning("SQLite is for local development only. Use PostgreSQL in production.")
    SQLITE_DB_PATH = "optlisting.db"
    engine = create_engine(f"sqlite:///{SQLITE_DB_PATH}", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Database session dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    db_logger.info("Database tables initialized successfully")

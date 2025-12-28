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
    ebay_item_id = Column(String, unique=True, index=True, nullable=False)
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
    
    # JSONB fields (added via migration)
    metrics = Column(JSONB, default={}, nullable=True)
    analysis_meta = Column(JSONB, default={}, nullable=True)
    
    # Additional fields (added via migration)
    item_id = Column(String, nullable=True)  # Generic item ID (ebay_item_id와 별도)
    platform = Column(String, nullable=True)  # Generic platform (marketplace와 별도)
    user_id = Column(String, nullable=True, index=True)
    supplier_id = Column(String, nullable=True)
    supplier_name = Column(String, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    is_zombie = Column(Boolean, default=False, nullable=True)
    zombie_score = Column(Float, nullable=True)

    def __repr__(self):
        return f"<Listing(ebay_item_id={self.ebay_item_id}, title={self.title}, source={self.source})>"


class DeletionLog(Base):
    __tablename__ = "deletion_logs"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(String, nullable=False, index=True)  # ebay_item_id or similar
    title = Column(String, nullable=False)
    platform = Column(String, nullable=True)  # marketplace: "eBay", "Amazon", "Shopify", "Walmart"
    source = Column(String, nullable=False)  # "Amazon", "Walmart", etc.
    deleted_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

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
    subscription_plan = Column(String, nullable=True)  # 'pro', 'free', etc.
    
    # 플랜 제한
    total_listings_limit = Column(Integer, default=100)  # Pro 플랜: 무제한 또는 큰 수, Free: 100
    
    # 크레딧 시스템 (3-Way Hybrid Pricing)
    purchased_credits = Column(Integer, default=0, nullable=False)  # 총 구매/부여 크레딧
    consumed_credits = Column(Integer, default=0, nullable=False)   # 총 사용 크레딧
    current_plan = Column(String, default='free')  # 'free', 'starter', 'pro', 'enterprise'
    free_tier_count = Column(Integer, default=0, nullable=False)  # 무료티어 사용 횟수 (최대 3회)
    
    # eBay OAuth 토큰
    ebay_access_token = Column(String, nullable=True)  # eBay Access Token (2시간 만료)
    ebay_refresh_token = Column(String, nullable=True)  # eBay Refresh Token (18개월 만료)
    ebay_token_expires_at = Column(DateTime, nullable=True)  # Access Token 만료 시간
    ebay_user_id = Column(String, nullable=True)  # eBay User ID
    ebay_token_updated_at = Column(DateTime, nullable=True)  # 토큰 마지막 갱신 시간
    
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


# Database setup
# Use Supabase PostgreSQL if DATABASE_URL is set, otherwise fall back to SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Fix: Remove quotes and leading = if present (Railway sometimes adds these)
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.strip('"').strip("'").lstrip('=').strip()

# Debug: Print DATABASE_URL status
print(f"DEBUG: DATABASE_URL exists: {bool(DATABASE_URL)}")
print(f"DEBUG: DATABASE_URL starts with postgresql: {DATABASE_URL.startswith(('postgresql://', 'postgres://')) if DATABASE_URL else False}")
if DATABASE_URL:
    # Print first 50 chars only (hide password)
    print(f"DEBUG: DATABASE_URL prefix: {DATABASE_URL[:50]}...")

# ✅ FIX: DATABASE_URL 검증 강화 (빈 문자열, None, 잘못된 형식 체크)
if DATABASE_URL and DATABASE_URL.startswith(("postgresql://", "postgres://")):
    # Supabase PostgreSQL connection
    SQLALCHEMY_DATABASE_URL = DATABASE_URL
    try:
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            pool_pre_ping=True,  # Verify connections before using them
            pool_size=5,
            max_overflow=10
        )
    except Exception as e:
        # ✅ FIX: DATABASE_URL 파싱 실패 시 SQLite로 폴백
        print(f"Warning: Failed to create PostgreSQL engine: {e}")
        print("Falling back to SQLite...")
        SQLALCHEMY_DATABASE_URL = "sqlite:///./optlisting.db"
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL, 
            connect_args={"check_same_thread": False}
        )
else:
    # Fallback to SQLite for local development
    if DATABASE_URL:
        print(f"Warning: DATABASE_URL is set but invalid format: {DATABASE_URL[:50]}...")
        print("Falling back to SQLite...")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./optlisting.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database and create tables"""
    # Note: For Supabase, tables are managed via migrations
    # This function is kept for SQLite compatibility
    if not DATABASE_URL:  # Only create tables if using SQLite
        # Drop and recreate tables to ensure schema is up to date
        # This is safe for development with dummy data
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


-- OptListing Database Schema for Supabase
-- 실행 방법: Supabase SQL Editor에서 이 스크립트를 실행하세요

-- listings 테이블
CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    ebay_item_id VARCHAR UNIQUE NOT NULL,
    title VARCHAR NOT NULL,
    sku VARCHAR NOT NULL,
    image_url VARCHAR NOT NULL,
    brand VARCHAR,
    upc VARCHAR,
    marketplace VARCHAR DEFAULT 'eBay',
    source VARCHAR NOT NULL,
    price FLOAT NOT NULL,
    date_listed DATE NOT NULL,
    sold_qty INTEGER DEFAULT 0,
    watch_count INTEGER DEFAULT 0,
    -- JSONB 필드: 유연한 메트릭스 데이터 저장
    metrics JSONB DEFAULT '{}'::jsonb,
    -- 공급업체 및 스토어 정보
    supplier_name VARCHAR,
    supplier_id VARCHAR,
    store_id VARCHAR,
    user_id VARCHAR,
    -- 글로벌 승자 체크용
    is_global_winner BOOLEAN DEFAULT FALSE,
    global_winner_checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- deletion_logs 테이블
CREATE TABLE IF NOT EXISTS deletion_logs (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    platform VARCHAR,
    source VARCHAR NOT NULL,
    deleted_at TIMESTAMP DEFAULT NOW(),
    store_id VARCHAR,
    user_id VARCHAR,
    -- 삭제 시점의 스냅샷 (JSONB)
    snapshot JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_listings_ebay_item_id ON listings(ebay_item_id);
CREATE INDEX IF NOT EXISTS idx_listings_store_id ON listings(store_id);
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_supplier_name ON listings(supplier_name);
CREATE INDEX IF NOT EXISTS idx_listings_metrics ON listings USING GIN (metrics);
CREATE INDEX IF NOT EXISTS idx_listings_date_listed ON listings(date_listed);

CREATE INDEX IF NOT EXISTS idx_deletion_logs_item_id ON deletion_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_at ON deletion_logs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_user_id ON deletion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_store_id ON deletion_logs(store_id);

-- JSONB 필드 내부 키 인덱싱 (선택사항, 성능 향상)
-- metrics.sales, metrics.views, metrics.date_listed 등에 대한 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_listings_metrics_sales ON listings ((metrics->>'sales'));
CREATE INDEX IF NOT EXISTS idx_listings_metrics_views ON listings ((metrics->>'views'));

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- listings 테이블에 updated_at 트리거 추가
DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
CREATE TRIGGER update_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ OptListing 데이터베이스 스키마 생성 완료!';
    RAISE NOTICE '✅ listings 테이블 생성됨';
    RAISE NOTICE '✅ deletion_logs 테이블 생성됨';
    RAISE NOTICE '✅ 인덱스 생성됨';
    RAISE NOTICE '✅ 트리거 설정 완료';
END $$;






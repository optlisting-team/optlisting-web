-- ============================================================
-- OptListing - Supplier CSV Matching Indexes
-- 공급처 CSV 매칭 성능 향상을 위한 인덱스
-- ============================================================

-- 1. SKU 인덱스 (대소문자 무관 검색을 위한 함수 인덱스)
CREATE INDEX IF NOT EXISTS idx_listings_sku_upper 
ON listings (UPPER(sku));

-- 2. UPC 인덱스 (정확 매칭)
CREATE INDEX IF NOT EXISTS idx_listings_upc 
ON listings (upc) 
WHERE upc IS NOT NULL;

-- 3. 복합 인덱스: user_id + SKU (사용자별 SKU 검색)
CREATE INDEX IF NOT EXISTS idx_listings_user_sku 
ON listings (user_id, UPPER(sku));

-- 4. 복합 인덱스: user_id + UPC (사용자별 UPC 검색)
CREATE INDEX IF NOT EXISTS idx_listings_user_upc 
ON listings (user_id, upc) 
WHERE upc IS NOT NULL;

-- 5. supplier_name 인덱스 (공급처별 리스팅 조회)
CREATE INDEX IF NOT EXISTS idx_listings_supplier_name 
ON listings (supplier_name) 
WHERE supplier_name IS NOT NULL;

-- 6. 복합 인덱스: user_id + supplier_name (사용자별 공급처 필터링)
CREATE INDEX IF NOT EXISTS idx_listings_user_supplier 
ON listings (user_id, supplier_name);

-- 7. GIN 인덱스: analysis_meta JSONB (supplier_info 검색)
CREATE INDEX IF NOT EXISTS idx_listings_analysis_meta_gin 
ON listings USING GIN (analysis_meta);

-- ============================================================
-- 통계 정보
-- ============================================================
COMMENT ON INDEX idx_listings_sku_upper IS 'CSV 매칭 - SKU 대소문자 무관 검색';
COMMENT ON INDEX idx_listings_upc IS 'CSV 매칭 - UPC 정확 검색';
COMMENT ON INDEX idx_listings_user_sku IS 'CSV 매칭 - 사용자별 SKU 검색';
COMMENT ON INDEX idx_listings_user_upc IS 'CSV 매칭 - 사용자별 UPC 검색';
COMMENT ON INDEX idx_listings_supplier_name IS '공급처별 리스팅 필터링';
COMMENT ON INDEX idx_listings_user_supplier IS '사용자별 공급처 필터링';
COMMENT ON INDEX idx_listings_analysis_meta_gin IS 'JSONB 검색 성능 향상';


-- 데이터베이스 완전 초기화 및 제약 조건 강화
-- 실행 방법: Supabase SQL Editor에서 이 스크립트를 실행하세요

-- 1. listings 테이블의 모든 데이터 삭제
TRUNCATE TABLE listings CASCADE;

-- 2. 기존 UNIQUE 제약 조건 확인 및 제거 (ebay_item_id만 있는 경우)
DO $$
BEGIN
    -- ebay_item_id 단일 UNIQUE 제약 조건이 있으면 제거
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'listings'::regclass 
        AND conname = 'listings_ebay_item_id_key'
        AND contype = 'u'
    ) THEN
        ALTER TABLE listings DROP CONSTRAINT listings_ebay_item_id_key;
        RAISE NOTICE '✅ 기존 ebay_item_id UNIQUE 제약 조건 제거됨';
    END IF;
END $$;

-- 3. ebay_item_id와 user_id 조합에 대한 UNIQUE 제약 조건 추가
-- 같은 주인의 같은 상품이 중복 저장되는 것을 원천 차단
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_ebay_item_id_user_id 
ON listings(ebay_item_id, user_id);

-- 4. 제약 조건 확인
DO $$
BEGIN
    RAISE NOTICE '✅ listings 테이블 데이터 삭제 완료';
    RAISE NOTICE '✅ ebay_item_id + user_id UNIQUE 제약 조건 추가 완료';
    RAISE NOTICE '✅ 같은 주인의 같은 상품이 중복 저장되는 것을 원천 차단';
END $$;


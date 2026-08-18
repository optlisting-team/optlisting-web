-- ============================================================
-- DB 멀티테넌시 설정: UNIQUE 제약조건 변경
-- ============================================================
-- 
-- 작업 내용:
-- 1. 기존 ebay_item_id 단독 UNIQUE 제약조건 삭제
-- 2. (user_id, ebay_item_id) 복합 UNIQUE 제약조건 생성
--
-- 실행 순서:
-- 1. 이 SQL 파일을 Supabase SQL Editor 또는 psql에서 실행
-- 2. 또는 backend/main.py의 startup 이벤트에서 자동 실행
-- ============================================================

-- ============================================================
-- Step 1: 기존 UNIQUE 제약조건 찾기 및 삭제
-- ============================================================
-- listings 테이블의 ebay_item_id에 걸려있는 UNIQUE 제약조건 확인 및 삭제

-- 방법 1: 직접 제약조건 이름으로 삭제 (제약조건 이름을 알고 있는 경우)
-- ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_ebay_item_id_key;

-- 방법 2: 동적으로 제약조건 찾기 및 삭제 (더 안전)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- ebay_item_id UNIQUE 제약조건 찾기 (단일 컬럼 UNIQUE)
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'listings'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 1
      AND conkey[1] = (
          SELECT attnum 
          FROM pg_attribute 
          WHERE attrelid = 'listings'::regclass 
            AND attname = 'ebay_item_id'
      );
    
    -- 제약조건이 존재하면 삭제
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE listings DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE '✅ 기존 UNIQUE 제약조건 삭제됨: %', constraint_name;
    ELSE
        RAISE NOTICE 'ℹ️ 기존 UNIQUE 제약조건을 찾을 수 없습니다. (이미 삭제되었거나 존재하지 않음)';
    END IF;
END $$;

-- ============================================================
-- Step 2: (user_id, ebay_item_id) 복합 UNIQUE 제약조건 생성
-- ============================================================
-- 이 제약조건은 같은 user_id 내에서 ebay_item_id가 유일해야 함을 보장합니다.
-- 다른 user_id의 listings는 동일한 ebay_item_id를 가질 수 있습니다.

-- 기존 제약조건이 있는지 확인 후 생성
DO $$
BEGIN
    -- 복합 UNIQUE 제약조건이 이미 존재하는지 확인
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'listings'::regclass
          AND conname = 'unique_user_ebay_item_id'
    ) THEN
        -- 제약조건 생성
        ALTER TABLE listings 
        ADD CONSTRAINT unique_user_ebay_item_id 
        UNIQUE (user_id, ebay_item_id);
        
        RAISE NOTICE '✅ 복합 UNIQUE 제약조건 생성 완료: unique_user_ebay_item_id (user_id, ebay_item_id)';
    ELSE
        RAISE NOTICE 'ℹ️ 복합 UNIQUE 제약조건이 이미 존재합니다: unique_user_ebay_item_id';
    END IF;
END $$;

-- Step 3: 인덱스 확인 (복합 UNIQUE 제약조건은 자동으로 인덱스를 생성하지만, 명시적으로 확인)
-- 인덱스가 자동 생성되었는지 확인
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'listings'
    AND indexname LIKE '%user_ebay%';

-- ============================================================
-- 참고사항:
-- ============================================================
-- 1. 이 마이그레이션은 이미 존재하는 데이터에 영향을 주지 않습니다.
-- 2. 기존 데이터에 중복이 있는 경우 제약조건 생성이 실패할 수 있습니다.
--    중복 데이터 정리가 필요한 경우 아래 쿼리를 먼저 실행하세요:
--
--    -- 중복 데이터 확인
--    SELECT user_id, ebay_item_id, COUNT(*) 
--    FROM listings 
--    GROUP BY user_id, ebay_item_id 
--    HAVING COUNT(*) > 1;
--
--    -- 중복 데이터 정리 (가장 오래된 것만 남기기)
--    DELETE FROM listings
--    WHERE id NOT IN (
--        SELECT MIN(id)
--        FROM listings
--        GROUP BY user_id, ebay_item_id
--    );
-- ============================================================

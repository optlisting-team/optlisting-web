-- listings 테이블 완전 초기화
-- 즉시 실행: Supabase SQL Editor에서 실행하거나 MCP로 실행

TRUNCATE TABLE listings CASCADE;

-- 실행 확인
SELECT COUNT(*) as remaining_count FROM listings;





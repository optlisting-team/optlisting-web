-- eBay API 레이트리밋 추적 테이블
-- 목적: (1) 전역 일일 호출 총량 추적 (Trading API 5,000/일, Analytics API 100/일, 앱 전체 공유)
--       (2) 스토어별 429 백오프 상태 관리
--       (3) 스토어별 24시간 풀싱크 쿨다운, 트래픽(Analytics) 갱신 회전 추적
-- Supabase SQL Editor에서 실행하세요

-- 1) 호출 로그 (append-only) — 전역 일일 총량 계산의 기준 데이터
CREATE TABLE IF NOT EXISTS ebay_api_call_log (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL,                 -- 어느 스토어(shop)의 호출인지
    api_type VARCHAR NOT NULL,                -- 'trading' | 'analytics'
    endpoint VARCHAR,                         -- 예: 'GetMyeBaySelling', 'traffic_report'
    status_code INTEGER,                      -- eBay 응답 HTTP 상태 코드
    called_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebay_api_call_log_type_time ON ebay_api_call_log(api_type, called_at);
CREATE INDEX IF NOT EXISTS idx_ebay_api_call_log_user ON ebay_api_call_log(user_id, called_at);

-- 2) 스토어별 상태 (429 백오프 + 동기화 쿨다운) — 1 row per store
CREATE TABLE IF NOT EXISTS ebay_api_calls (
    user_id VARCHAR PRIMARY KEY,
    backoff_level INTEGER DEFAULT 0,          -- 429 연속 발생 횟수 (쿨다운 지수 증가에 사용)
    cooldown_until TIMESTAMP,                 -- 이 시각까지 이 스토어의 신규 호출 차단 (429 백오프)
    last_full_sync_at TIMESTAMP,              -- 마지막 풀싱크(Trading API) 완료 시각 — 24시간 쿨다운 기준
    last_traffic_sync_at TIMESTAMP,           -- 마지막 트래픽(Analytics API) 갱신 시각
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3) listings 테이블에 "이 리스팅 트래픽을 마지막으로 언제 갱신했는지" 컬럼 추가
--    (하루 400개 회전식 갱신 시 "가장 오래된 것부터" 골라내는 기준)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_traffic_synced_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_listings_last_traffic_synced ON listings(user_id, last_traffic_synced_at);

DO $$
BEGIN
    RAISE NOTICE '✅ ebay_api_call_log, ebay_api_calls 테이블 생성 완료!';
    RAISE NOTICE '✅ listings.last_traffic_synced_at 컬럼 추가 완료!';
END $$;

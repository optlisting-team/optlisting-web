-- =============================================
-- OptListing Credit System Migration
-- 3-Way Hybrid Pricing 지원을 위한 크레딧 필드 추가
-- =============================================

-- 1. 크레딧 관련 컬럼 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS purchased_credits INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS consumed_credits INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS current_plan TEXT DEFAULT 'free';

-- 2. 크레딧 잔액 체크를 위한 CHECK 제약조건 (음수 방지)
ALTER TABLE profiles
ADD CONSTRAINT check_credits_non_negative 
CHECK (purchased_credits >= 0 AND consumed_credits >= 0);

-- 3. 소비 크레딧이 구매 크레딧을 초과하지 않도록 제약
ALTER TABLE profiles
ADD CONSTRAINT check_consumed_not_exceed_purchased
CHECK (consumed_credits <= purchased_credits);

-- 4. 크레딧 이력 테이블 (감사 추적용)
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    
    -- 트랜잭션 유형
    transaction_type TEXT NOT NULL, -- 'purchase', 'consume', 'refund', 'bonus'
    
    -- 크레딧 변동
    amount INTEGER NOT NULL, -- 양수: 추가, 음수: 차감
    
    -- 잔액 스냅샷 (트랜잭션 후)
    balance_after INTEGER NOT NULL,
    
    -- 메타데이터
    description TEXT,
    reference_id TEXT, -- 분석 작업 ID, 결제 ID 등
    
    -- 타임스탬프
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 5. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id 
ON credit_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_type 
ON credit_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at 
ON credit_transactions(created_at DESC);

-- 6. RLS 정책 (credit_transactions 테이블)
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_credit_transactions_select ON credit_transactions
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY user_credit_transactions_insert ON credit_transactions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 7. 크레딧 잔액 조회 함수 (원자적 읽기)
CREATE OR REPLACE FUNCTION get_available_credits(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    available INTEGER;
BEGIN
    SELECT (purchased_credits - consumed_credits)
    INTO available
    FROM profiles
    WHERE user_id = p_user_id
    FOR UPDATE; -- Row-level lock for consistency
    
    RETURN COALESCE(available, 0);
END;
$$ LANGUAGE plpgsql;

-- 8. 원자적 크레딧 차감 함수 (동시성 안전)
CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id TEXT,
    p_amount INTEGER,
    p_description TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, remaining_credits INTEGER, message TEXT) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_consumed INTEGER;
BEGIN
    -- 1. Row-level lock으로 현재 잔액 조회
    SELECT (purchased_credits - consumed_credits)
    INTO v_current_balance
    FROM profiles
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- 2. 사용자 존재 확인
    IF v_current_balance IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'User not found'::TEXT;
        RETURN;
    END IF;
    
    -- 3. 잔액 충분 여부 확인
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, v_current_balance, 
            format('Insufficient credits: available=%s, requested=%s', v_current_balance, p_amount)::TEXT;
        RETURN;
    END IF;
    
    -- 4. 원자적 업데이트 (동시성 안전)
    UPDATE profiles
    SET consumed_credits = consumed_credits + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND (purchased_credits - consumed_credits) >= p_amount
    RETURNING consumed_credits INTO v_new_consumed;
    
    -- 5. 업데이트 성공 확인
    IF v_new_consumed IS NULL THEN
        RETURN QUERY SELECT FALSE, v_current_balance, 
            'Concurrent modification detected, please retry'::TEXT;
        RETURN;
    END IF;
    
    -- 6. 트랜잭션 이력 기록
    INSERT INTO credit_transactions (
        user_id, transaction_type, amount, balance_after, description, reference_id
    ) VALUES (
        p_user_id, 'consume', -p_amount, 
        (SELECT purchased_credits - consumed_credits FROM profiles WHERE user_id = p_user_id),
        p_description, p_reference_id
    );
    
    -- 7. 성공 반환
    RETURN QUERY SELECT TRUE, (v_current_balance - p_amount), 'Credits deducted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 9. 크레딧 추가 함수 (구매, 보너스, 환불용)
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id TEXT,
    p_amount INTEGER,
    p_transaction_type TEXT DEFAULT 'purchase',
    p_description TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, total_credits INTEGER, message TEXT) AS $$
DECLARE
    v_new_purchased INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- 1. 원자적 업데이트
    UPDATE profiles
    SET purchased_credits = purchased_credits + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING purchased_credits, (purchased_credits - consumed_credits) 
    INTO v_new_purchased, v_new_balance;
    
    -- 2. 사용자 존재 확인
    IF v_new_purchased IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'User not found'::TEXT;
        RETURN;
    END IF;
    
    -- 3. 트랜잭션 이력 기록
    INSERT INTO credit_transactions (
        user_id, transaction_type, amount, balance_after, description, reference_id
    ) VALUES (
        p_user_id, p_transaction_type, p_amount, v_new_balance, p_description, p_reference_id
    );
    
    -- 4. 성공 반환
    RETURN QUERY SELECT TRUE, v_new_balance, 'Credits added successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 10. 기존 사용자에게 기본 크레딧 부여 (free 플랜: 100 크레딧)
UPDATE profiles
SET purchased_credits = 100,
    consumed_credits = 0,
    current_plan = 'free'
WHERE purchased_credits = 0 AND current_plan IS NULL;

COMMENT ON COLUMN profiles.purchased_credits IS '총 구매/부여된 크레딧';
COMMENT ON COLUMN profiles.consumed_credits IS '총 사용된 크레딧';
COMMENT ON COLUMN profiles.current_plan IS '현재 플랜: free, starter, pro, enterprise';


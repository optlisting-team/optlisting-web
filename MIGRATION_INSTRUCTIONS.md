# 데이터베이스 마이그레이션 안내

## free_tier_count 컬럼 추가

eBay 연결이 작동하려면 `profiles` 테이블에 `free_tier_count` 컬럼을 추가해야 합니다.

### Supabase에서 마이그레이션 실행 방법:

1. Supabase 대시보드에 로그인
2. 왼쪽 메뉴에서 "SQL Editor" 클릭
3. 아래 SQL 코드를 복사하여 붙여넣기:

```sql
-- Add free_tier_count column to profiles table for tracking free tier usage
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS free_tier_count INTEGER DEFAULT 0 NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.free_tier_count IS 'Number of free tier analyses used (max 3)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_free_tier_count ON profiles(free_tier_count);
```

4. "Run" 버튼 클릭하여 실행
5. 마이그레이션 완료 후 `backend/models.py` 파일에서 `free_tier_count` 컬럼의 주석을 해제하세요:

```python
free_tier_count = Column(Integer, default=0, nullable=False)  # 무료티어 사용 횟수 (최대 3회)
```

### 마이그레이션 파일 위치:
- `backend/migrations/add_free_tier_count.sql`

### 참고:
- 마이그레이션을 실행하지 않으면 eBay 연결이 작동하지 않습니다
- 마이그레이션은 기존 데이터에 영향을 주지 않습니다 (기본값 0으로 설정)


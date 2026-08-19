# Supabase + Railway 연결 가이드

## 1. Supabase 연결 문자열 가져오기

### 방법 1: Supabase 대시보드에서
1. https://supabase.com/dashboard 접속
2. "optlisting" 프로젝트 선택
3. Settings > Database 메뉴로 이동
4. "Connection string" 섹션에서 "URI" 선택
5. 연결 문자열 복사 (형식: `postgresql://postgres:[YOUR-PASSWORD]@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres`)

### 방법 2: Supabase CLI 사용
```bash
supabase status
```

## 2. Railway 환경 변수 설정

### Railway 대시보드에서:
1. Railway 대시보드 접속: https://railway.app
2. optlisting 프로젝트 선택
3. "Variables" 탭 클릭
4. "New Variable" 클릭
5. 다음 변수 추가:

```
Key: DATABASE_URL
Value: postgresql://postgres:[YOUR-PASSWORD]@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres
```

**중요:** `[YOUR-PASSWORD]`를 실제 Supabase 데이터베이스 비밀번호로 교체하세요!

### Supabase 비밀번호 찾기:
1. Supabase 대시보드 > Settings > Database
2. "Database password" 섹션에서 비밀번호 확인
3. 비밀번호를 잊었다면 "Reset database password" 클릭

## 3. 데이터베이스 스키마 생성

Railway 배포 후, Railway 터미널에서 다음 명령 실행:

```bash
cd backend
python -c "from models import init_db; init_db()"
```

또는 Supabase SQL Editor에서 직접 실행:

```sql
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
    watch_count INTEGER DEFAULT 0
);

-- deletion_logs 테이블
CREATE TABLE IF NOT EXISTS deletion_logs (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    platform VARCHAR,
    source VARCHAR NOT NULL,
    deleted_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_listings_ebay_item_id ON listings(ebay_item_id);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_item_id ON deletion_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_at ON deletion_logs(deleted_at);
```

## 4. 더미 데이터 생성 (선택사항)

Railway 터미널에서:

```bash
cd backend
python -c "from models import get_db; from dummy_data import generate_dummy_listings; from models import get_db; db = next(get_db()); generate_dummy_listings(db, 5000)"
```

## 5. 연결 테스트

Railway 배포 후:
1. Railway 대시보드 > Settings > Domains에서 생성된 URL 확인
2. 브라우저에서 `https://your-app.railway.app/` 접속
3. `{"message": "OptListing API is running"}` 응답 확인

## 문제 해결

### 연결 오류가 발생하면:
1. DATABASE_URL 형식 확인 (postgresql://로 시작해야 함)
2. 비밀번호에 특수문자가 있으면 URL 인코딩 필요
3. Supabase 방화벽 설정 확인 (Settings > Database > Connection pooling)

### 테이블이 없다는 오류:
- Railway 터미널에서 `init_db()` 실행
- 또는 Supabase SQL Editor에서 직접 스키마 생성




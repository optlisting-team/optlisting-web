# OptListing 배포 가이드

## Railway 배포 (추천)

### 1. Railway 계정 생성
1. https://railway.app 접속
2. GitHub 계정으로 로그인

### 2. 프로젝트 배포
1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. `optlisting` 저장소 선택
4. "Deploy" 클릭

### 3. 환경 변수 설정
Railway 대시보드에서 다음 환경 변수를 설정:

```
DATABASE_URL=postgresql://user:password@host:port/dbname
FRONTEND_URL=https://your-frontend-url.com
PORT=8000
```

**Supabase PostgreSQL 사용 시:**
1. Supabase 프로젝트 생성
2. Settings > Database > Connection String (URI) 복사
3. Railway 환경 변수에 `DATABASE_URL`로 설정

### 4. 데이터베이스 마이그레이션
배포 후 Railway 터미널에서:
```bash
cd backend
python -c "from models import init_db; init_db()"
```

또는 Python 스크립트 실행:
```bash
python -c "from models import init_db, get_db; init_db(); db = next(get_db()); from dummy_data import generate_dummy_listings; generate_dummy_listings(db, 5000)"
```

### 5. 도메인 설정
1. Railway 프로젝트 > Settings > Domains
2. "Generate Domain" 클릭
3. 생성된 URL을 `FRONTEND_URL` 환경 변수에 추가

---

## Render 배포

### 1. Render 계정 생성
1. https://render.com 접속
2. GitHub 계정으로 로그인

### 2. Web Service 생성
1. "New +" > "Web Service" 선택
2. GitHub 저장소 연결
3. 설정:
   - **Name**: optlisting-backend
   - **Environment**: Python 3
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

### 3. 환경 변수 설정
Render 대시보드에서:
- `DATABASE_URL`: PostgreSQL 연결 문자열
- `FRONTEND_URL`: 프론트엔드 URL
- `PORT`: 8000

---

## Supabase 배포 (Edge Functions)

### 1. Supabase 프로젝트 생성
1. https://supabase.com 접속
2. 새 프로젝트 생성

### 2. 데이터베이스 설정
1. Settings > Database > Connection String 복사
2. `DATABASE_URL` 환경 변수로 설정

### 3. 테이블 생성
Supabase SQL Editor에서:
```sql
-- listings 테이블
CREATE TABLE listings (
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
CREATE TABLE deletion_logs (
    id SERIAL PRIMARY KEY,
    item_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    platform VARCHAR,
    source VARCHAR NOT NULL,
    deleted_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_listings_ebay_item_id ON listings(ebay_item_id);
CREATE INDEX idx_deletion_logs_item_id ON deletion_logs(item_id);
CREATE INDEX idx_deletion_logs_deleted_at ON deletion_logs(deleted_at);
```

---

## 프론트엔드 배포 (Vercel)

### 1. Vercel 계정 생성
1. https://vercel.com 접속
2. GitHub 계정으로 로그인

### 2. 프로젝트 배포
1. "New Project" 클릭
2. `optlisting` 저장소 선택
3. **Root Directory**: `frontend` 설정
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. **Install Command**: `npm install`

### 3. 환경 변수 설정
Vercel 대시보드에서:
```
VITE_API_URL=https://your-backend-url.railway.app
```

### 4. 프론트엔드 코드 업데이트
`frontend/src/components/Dashboard.jsx`에서:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

---

## 배포 후 확인 사항

1. ✅ 백엔드 API 응답 확인: `https://your-backend-url.railway.app/`
2. ✅ CORS 설정 확인 (프론트엔드 URL 허용)
3. ✅ 데이터베이스 연결 확인
4. ✅ 더미 데이터 생성 확인
5. ✅ 프론트엔드에서 API 호출 테스트

---

## 빠른 배포 (Railway 추천)

1. **Railway 설치**: https://railway.app
2. **CLI 로그인**: `railway login`
3. **프로젝트 초기화**: `railway init`
4. **배포**: `railway up`
5. **환경 변수 설정**: `railway variables set DATABASE_URL=...`

더 자세한 내용은 Railway 문서 참조: https://docs.railway.app


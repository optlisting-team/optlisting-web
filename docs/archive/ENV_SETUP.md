# OptListing 환경변수 설정 가이드

## Railway 환경변수

### 필수 환경변수

```bash
# Database
DATABASE_URL=postgresql://postgres.xxx:password@xxx.pooler.supabase.com:5432/postgres?sslmode=require

# eBay OAuth (토큰 자동 갱신 Worker용)
EBAY_CLIENT_ID=your_ebay_app_client_id
EBAY_CLIENT_SECRET=your_ebay_app_client_secret
EBAY_ENVIRONMENT=PRODUCTION  # SANDBOX or PRODUCTION

# eBay Webhook (Keysel 활성화 필수!)
EBAY_VERIFICATION_SECRET=your_verification_token
EBAY_WEBHOOK_ENDPOINT=https://optlisting-production.up.railway.app/api/ebay/deletion
```

### 선택적 환경변수

```bash
# Sentry (에러 모니터링)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
ENVIRONMENT=production

# 기타
PORT=8080
```

---

## eBay Webhook (Marketplace Account Deletion) 설정

### 1. eBay Developer Console에서 Webhook 설정

1. https://developer.ebay.com → **Alerts & Notifications**
2. **Marketplace Account Deletion** 섹션
3. **Endpoint URL** 설정:
   ```
   https://optlisting-production.up.railway.app/api/ebay/deletion
   ```
4. **Verification Token** 생성 및 저장

### 2. Railway 환경변수 추가

```bash
EBAY_VERIFICATION_SECRET=your_verification_token_from_ebay
EBAY_WEBHOOK_ENDPOINT=https://optlisting-production.up.railway.app/api/ebay/deletion
```

### 3. Challenge-Response 검증 방식

```
eBay Request:
GET /api/ebay/deletion?challenge_code=abc123

Backend Response:
{
  "challengeResponse": "sha256(challenge_code + verification_token + endpoint_url)"
}
```

### 4. 테스트

```bash
# Health Check
curl https://optlisting-production.up.railway.app/api/ebay/health

# Challenge Simulation (로컬)
curl "http://localhost:8000/api/ebay/deletion?challenge_code=test123"
```

---

## eBay Developer 설정

### 1. eBay Developer Program 가입
1. https://developer.ebay.com 접속
2. 계정 생성 및 로그인
3. **Application Keys** 생성

### 2. OAuth Application 설정
1. **User Tokens** 탭에서 **Add eBay Redirect URL** 클릭
2. Redirect URL 추가:
   ```
   https://optlisting-three.vercel.app/api/ebay/callback
   ```
3. **OAuth Scopes** 설정:
   - `https://api.ebay.com/oauth/api_scope`
   - `https://api.ebay.com/oauth/api_scope/sell.inventory.readonly`
   - `https://api.ebay.com/oauth/api_scope/sell.marketing.readonly`

### 3. Keys 복사
- **App ID (Client ID)** → `EBAY_CLIENT_ID`
- **Cert ID (Client Secret)** → `EBAY_CLIENT_SECRET`

---

## Sentry 설정 (에러 모니터링)

### 1. Sentry 계정 생성
1. https://sentry.io 접속
2. 무료 계정 생성

### 2. 프로젝트 생성
1. **Create Project** → **Python** 선택
2. **DSN** 복사 → `SENTRY_DSN`

### 3. Railway에 추가
```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

## Railway Worker 배포

### 1. Worker 서비스 추가
1. Railway Dashboard → **+ New Service** → **Empty Service**
2. GitHub 연결 (같은 repo)
3. **Settings** → **Start Command**:
   ```
   cd backend && python -m workers.ebay_token_worker --scheduler
   ```

### 2. 환경변수 설정
Worker 서비스에도 동일한 환경변수 추가:
- `DATABASE_URL`
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_ENVIRONMENT`
- `SENTRY_DSN`

### 3. Deploy

---

## Token 갱신 Worker 동작

### 실행 주기
- **1시간마다** 자동 실행
- 만료 **30분 전** 또는 **이미 만료된** 토큰 갱신

### 갱신 프로세스
1. `profiles` 테이블에서 갱신 필요한 사용자 조회
2. eBay OAuth API로 Refresh Token 전송
3. 새 Access Token 수신
4. DB 업데이트 (`ebay_access_token`, `ebay_token_expires_at`)

### 모니터링
- Railway Logs에서 실시간 확인
- Sentry에서 에러 알림 수신

---

## 수동 테스트

```bash
# 단일 실행 (테스트용)
cd backend
python -m workers.ebay_token_worker --once

# 스케줄러 실행 (프로덕션)
python -m workers.ebay_token_worker --scheduler
```


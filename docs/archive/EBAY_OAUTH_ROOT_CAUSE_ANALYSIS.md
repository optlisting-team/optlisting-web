# eBay OAuth 연결 실패 원인 분석

## 🔍 현재 상황

1. **Railway 로그 확인 결과:**
   - 프로필은 존재 (`default-user`)
   - 하지만 토큰이 없음 (`Has access token: False`)
   - OAuth 콜백 로그가 전혀 없음

2. **프론트엔드 동작:**
   - Connect 버튼 클릭 시 콘솔에 로그는 찍힘
   - 하지만 eBay 로그인 페이지로 리다이렉트되지 않음

## 🚨 핵심 문제점

### 문제 1: OAuth 시작 요청이 Railway에 도달하지 않음

**증상:**
- Connect 버튼 클릭해도 Railway 로그에 `🚀 eBay OAuth Start Request` 로그가 없음
- 프론트엔드 콘솔에는 로그가 찍히지만 실제 요청이 전송되지 않음

**가능한 원인:**
1. **CORS 문제**: 브라우저가 요청을 차단
2. **네트워크 문제**: 요청이 Railway에 도달하지 않음
3. **URL 문제**: 잘못된 API URL 사용

### 문제 2: eBay RuName 설정 불일치

**eBay OAuth Flow:**
```
1. 사용자가 Connect 클릭
2. 백엔드가 eBay Authorization URL 생성
   - redirect_uri = EBAY_RU_NAME (예: "OptListing-OptListin-optl-abcde")
3. eBay가 사용자를 로그인 페이지로 리다이렉트
4. 사용자가 로그인 및 권한 승인
5. eBay가 RuName에 매핑된 실제 URL로 리다이렉트
   - 예: https://optlisting-production.up.railway.app/api/ebay/auth/callback
6. 백엔드가 콜백을 받아 토큰 교환
```

**문제:**
- eBay Developer Console에서 RuName이 실제 Railway 콜백 URL로 설정되어 있어야 함
- 만약 RuName이 다른 URL로 설정되어 있으면, 콜백이 다른 곳으로 가서 우리 백엔드가 받지 못함

### 문제 3: 환경 변수 설정 누락

**필수 환경 변수:**
- `EBAY_CLIENT_ID`: eBay App ID
- `EBAY_CLIENT_SECRET`: eBay Client Secret
- `EBAY_RU_NAME`: eBay Developer Console에 등록된 RuName
- `FRONTEND_URL`: 프론트엔드 URL (리다이렉트용)

**확인 필요:**
- Railway에 모든 환경 변수가 제대로 설정되어 있는지
- RuName이 실제 콜백 URL과 일치하는지

## 🔧 해결 방법

### Step 1: Railway 로그 확인

1. Railway 대시보드 → Logs
2. Connect 버튼 클릭
3. 다음 로그가 나타나는지 확인:
   - `🚀 eBay OAuth Start Request` (없으면 요청이 도달하지 않음)
   - `🔐 eBay OAuth Callback Received` (없으면 콜백이 도달하지 않음)

### Step 2: eBay Developer Console 확인

1. **eBay Developer Console 접속**
   - https://developer.ebay.com/my/keys
   
2. **RuName 확인:**
   - OAuth 설정에서 RuName 확인
   - RuName이 실제 Railway 콜백 URL로 설정되어 있는지 확인
   - 예: `https://optlisting-production.up.railway.app/api/ebay/auth/callback`

3. **RuName 수정 (필요시):**
   - RuName을 Railway 콜백 URL로 변경
   - 변경 후 Railway의 `EBAY_RU_NAME` 환경 변수도 업데이트

### Step 3: Railway 환경 변수 확인

Railway 대시보드 → Variables에서 확인:
- [ ] `EBAY_CLIENT_ID` 설정됨
- [ ] `EBAY_CLIENT_SECRET` 설정됨
- [ ] `EBAY_RU_NAME` 설정됨 (eBay Developer Console의 RuName과 일치)
- [ ] `FRONTEND_URL` 설정됨 (예: `https://optlisting.com`)

### Step 4: 브라우저 Network 탭 확인

1. 개발자 도구 → Network 탭 열기
2. Connect 버튼 클릭
3. 다음 요청이 보이는지 확인:
   - `GET /api/ebay/auth/start?user_id=default-user`
   - Status: 302 (리다이렉트)
   - Response Headers에 `Location` 헤더 확인

### Step 5: 직접 테스트

브라우저 콘솔에서 직접 테스트:
```javascript
// OAuth 시작 URL 직접 접속
const apiUrl = 'https://optlisting-production.up.railway.app'
const oauthUrl = `${apiUrl}/api/ebay/auth/start?user_id=default-user`
console.log('OAuth URL:', oauthUrl)
window.location.href = oauthUrl
```

## 📋 체크리스트

### Railway 설정
- [ ] `EBAY_CLIENT_ID` 환경 변수 설정
- [ ] `EBAY_CLIENT_SECRET` 환경 변수 설정
- [ ] `EBAY_RU_NAME` 환경 변수 설정 (eBay RuName과 일치)
- [ ] `FRONTEND_URL` 환경 변수 설정

### eBay Developer Console
- [ ] RuName이 Railway 콜백 URL로 설정됨
- [ ] OAuth App이 Production 모드로 설정됨
- [ ] 필요한 Scopes가 활성화됨

### 테스트
- [ ] Connect 버튼 클릭 시 Railway 로그에 요청이 나타남
- [ ] eBay 로그인 페이지로 리다이렉트됨
- [ ] 로그인 후 콜백이 Railway로 전달됨
- [ ] Railway 로그에 콜백 로그가 나타남
- [ ] 토큰이 DB에 저장됨

## 🎯 가장 가능성 높은 원인

1. **RuName 설정 불일치** (80% 확률)
   - eBay Developer Console의 RuName이 Railway 콜백 URL과 일치하지 않음
   - 해결: eBay Developer Console에서 RuName을 Railway URL로 변경

2. **OAuth 시작 요청이 도달하지 않음** (15% 확률)
   - CORS 또는 네트워크 문제
   - 해결: Network 탭에서 요청 확인

3. **환경 변수 누락** (5% 확률)
   - Railway에 필수 환경 변수가 설정되지 않음
   - 해결: Railway Variables 확인 및 추가


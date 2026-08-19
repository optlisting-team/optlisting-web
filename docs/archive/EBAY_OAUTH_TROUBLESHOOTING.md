# eBay OAuth 연결 문제 해결 가이드

## 현재 문제
Connect 버튼을 눌러도 실제 eBay OAuth 연결이 되지 않고, 프론트엔드에서만 "연결됨"으로 표시됨

## 확인 사항

### 1. Railway 환경 변수 확인

Railway 대시보드에서 다음 환경 변수가 설정되어 있는지 확인:

#### 필수 환경 변수:
- `EBAY_CLIENT_ID` - eBay Developer Console에서 발급받은 App ID
- `EBAY_CLIENT_SECRET` - eBay Developer Console에서 발급받은 Cert ID
- `EBAY_RU_NAME` - eBay Redirect URL Name (RuName)
- `EBAY_ENVIRONMENT` - `PRODUCTION` 또는 `SANDBOX`

#### 확인 방법:
1. Railway 대시보드 접속
2. 프로젝트 선택
3. Variables 탭 클릭
4. 위 환경 변수들이 모두 있는지 확인

### 2. eBay Developer Console 설정 확인

1. https://developer.ebay.com 접속
2. **User Tokens** 탭 확인
3. **Redirect URLs** 확인:
   - 백엔드 콜백 URL이 등록되어 있어야 함
   - 예: `https://web-production-3dc73.up.railway.app/api/ebay/auth/callback`
4. **OAuth Scopes** 확인:
   - `https://api.ebay.com/oauth/api_scope`
   - `https://api.ebay.com/oauth/api_scope/sell.inventory`
   - `https://api.ebay.com/oauth/api_scope/sell.marketing.readonly`
   - `https://api.ebay.com/oauth/api_scope/sell.analytics.readonly`
   - `https://api.ebay.com/oauth/api_scope/sell.account.readonly`

### 3. 백엔드 OAuth 엔드포인트 테스트

브라우저에서 직접 접속해보기:
```
https://web-production-3dc73.up.railway.app/api/ebay/auth/start?user_id=test-user
```

**예상 결과:**
- ✅ eBay 로그인 페이지로 리다이렉트됨
- ❌ 에러 메시지 표시 (환경 변수 누락 등)

### 4. 콘솔 로그 확인

Connect 버튼 클릭 시 브라우저 콘솔에서 확인:
- `🔗 eBay OAuth 연결 시도` 메시지가 보이는지
- `API URL`이 올바른지
- `OAuth URL`이 올바른지

### 5. Network 탭 확인

브라우저 개발자 도구 → Network 탭에서:
- `/api/ebay/auth/start` 요청이 보이는지
- 응답 상태 코드가 무엇인지 (200, 302, 500 등)
- 리다이렉트가 발생하는지

## 해결 방법

### 방법 1: 환경 변수 추가 (Railway)

1. Railway 대시보드 → Variables 탭
2. 다음 환경 변수 추가:

```bash
EBAY_CLIENT_ID=your_ebay_app_id
EBAY_CLIENT_SECRET=your_ebay_cert_id
EBAY_RU_NAME=your_ru_name
EBAY_ENVIRONMENT=PRODUCTION
```

3. Railway 재배포 (자동 또는 수동)

### 방법 2: eBay Developer Console 설정

1. https://developer.ebay.com 접속
2. **User Tokens** → **Add eBay Redirect URL**
3. Redirect URL 추가:
   ```
   https://web-production-3dc73.up.railway.app/api/ebay/auth/callback
   ```
4. **Save** 클릭

### 방법 3: 백엔드 로그 확인

Railway 대시보드 → Deployments → Logs에서:
- OAuth 시작 요청이 들어오는지 확인
- 에러 메시지 확인
- 환경 변수 누락 에러 확인

## 테스트 순서

1. ✅ Railway 환경 변수 확인
2. ✅ eBay Developer Console 설정 확인
3. ✅ 브라우저에서 직접 OAuth URL 접속 테스트
4. ✅ Connect 버튼 클릭 후 콘솔/Network 탭 확인
5. ✅ Railway 로그 확인

## 예상되는 정상 동작

1. Connect 버튼 클릭
2. 브라우저가 백엔드 `/api/ebay/auth/start`로 요청
3. 백엔드가 eBay 로그인 페이지로 리다이렉트 (302)
4. 사용자가 eBay 로그인 및 권한 승인
5. eBay가 백엔드 `/api/ebay/auth/callback`로 리다이렉트
6. 백엔드가 토큰 저장 및 프론트엔드로 리다이렉트
7. 프론트엔드에서 연결 상태 업데이트

## 문제가 계속되면

다음 정보를 확인해주세요:
1. Railway 로그의 에러 메시지
2. 브라우저 콘솔의 에러 메시지
3. Network 탭의 요청/응답
4. Railway 환경 변수 설정 상태


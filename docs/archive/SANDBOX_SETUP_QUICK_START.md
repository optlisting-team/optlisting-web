# eBay 샌드박스 빠른 시작 가이드

실제 테스트 계정을 만들어서 AutoDS와 연동하여 테스트하는 방법입니다.

## 🚀 빠른 시작 (5단계)

### 1단계: eBay 샌드박스 테스트 계정 생성

1. **eBay Developer Console 접속**
   - https://developer.ebay.com
   - 로그인

2. **Sandbox 탭으로 이동**
   - 상단 메뉴에서 **Sandbox** 클릭

3. **샌드박스 사용자 생성**
   - **Sandbox Users** 섹션 → **Create a Sandbox User**
   - 정보 입력:
     ```
     User ID: optlisting_test
     Email: test@optlisting.com (또는 원하는 이메일)
     Password: [강력한 비밀번호]
     First Name: Test
     Last Name: Account
     ```
   - **Create User** 클릭
   - ✅ 생성된 계정 정보를 안전한 곳에 저장!

4. **샌드박스 eBay에 로그인 확인**
   - https://www.sandbox.ebay.com 접속
   - 생성한 계정으로 로그인
   - 로그인 성공 확인

---

### 2단계: 샌드박스 앱 키 생성

1. **앱 생성**
   - https://developer.ebay.com → **Sandbox** 탭
   - **Get Your App Keys** → **Create an App Key**
   - **App Name**: `OptListing Sandbox Test`
   - **App Type**: `OAuth Client ID`
   - **Create** 클릭

2. **앱 키 복사**
   - **App ID (Client ID)**: 복사하여 저장
   - **Cert ID (Client Secret)**: 복사하여 저장

3. **Redirect URL 설정**
   - **User Tokens** 탭 클릭
   - **Add eBay Redirect URL** 클릭
   - URL 추가:
     ```
     https://your-frontend-url.com/api/ebay/auth/callback
     ```
     (실제 프론트엔드 URL로 변경)

4. **OAuth Scopes 활성화**
   - 다음 스코프들 체크:
     - ✅ `https://api.ebay.com/oauth/api_scope`
     - ✅ `https://api.ebay.com/oauth/api_scope/sell.inventory`
     - ✅ `https://api.ebay.com/oauth/api_scope/sell.marketing.readonly`
     - ✅ `https://api.ebay.com/oauth/api_scope/sell.analytics.readonly`
     - ✅ `https://api.ebay.com/oauth/api_scope/sell.account.readonly`

5. **RuName 확인**
   - **User Tokens** 탭에서 **RuName** 복사
   - 예: `OptListing_Prod_Sandbox_optlisting_test`

---

### 3단계: Railway 환경변수 설정

Railway Dashboard → **Variables** 탭에서 다음 환경변수 추가:

```bash
# eBay 샌드박스 설정
EBAY_CLIENT_ID=your_sandbox_app_id_here
EBAY_CLIENT_SECRET=your_sandbox_client_secret_here
EBAY_ENVIRONMENT=SANDBOX
EBAY_RU_NAME=your_ru_name_here
FRONTEND_URL=https://your-frontend-url.com
```

⚠️ **중요**: `EBAY_ENVIRONMENT=SANDBOX`로 설정해야 샌드박스 API를 사용합니다!

---

### 4단계: 샌드박스 계정에 테스트 리스팅 추가

1. **샌드박스 eBay에 로그인**
   - https://www.sandbox.ebay.com
   - 생성한 테스트 계정으로 로그인

2. **테스트 리스팅 생성**
   - **Sell** → **List an item**
   - 제품 정보 입력:
     ```
     Title: Test Product - AutoDS SKU-AMZ-B08ABC1234
     SKU: AUTODS-AMZ-B08ABC1234
     Price: $19.99
     Quantity: 1
     Condition: New
     ```
   - **List your item** 클릭

3. **다양한 SKU 패턴으로 여러 리스팅 생성**
   - `AMZ-B08ABC1234` → Amazon 제품
   - `WM-123456` → Walmart 제품
   - `AE-789012` → AliExpress 제품
   - `AUTODS-AMZ-B08XYZ5678` → AutoDS 경유 Amazon
   - `SHOP-AMZ-B08DEF9012` → Shopify 경유 Amazon

4. **좀비 리스팅 조건으로 리스팅 생성** (선택사항)
   - 60일 이상 된 리스팅
   - 판매 0건
   - 관심목록 0개
   - 노출/조회 매우 낮음

---

### 5단계: OAuth 연결 및 테스트

1. **프론트엔드에서 연결**
   - Settings → **Connect eBay** 클릭
   - eBay 샌드박스 로그인 페이지로 리다이렉트
   - URL이 `https://auth.sandbox.ebay.com`로 시작하는지 확인

2. **샌드박스 계정으로 로그인**
   - 이메일: `test@optlisting.com` (1단계에서 생성한 계정)
   - 비밀번호: 설정한 비밀번호

3. **권한 승인**
   - **Agree** 클릭

4. **연결 성공 확인**
   - Callback URL로 리다이렉트
   - 성공 메시지 확인

5. **리스팅 가져오기**
   - Dashboard에서 **Analyze Listings** 클릭
   - 샌드박스 계정의 리스팅이 표시되는지 확인

---

## ✅ 테스트 체크리스트

- [ ] 샌드박스 테스트 계정 생성 완료
- [ ] 샌드박스 앱 키 생성 완료
- [ ] Railway 환경변수 설정 완료 (`EBAY_ENVIRONMENT=SANDBOX`)
- [ ] 샌드박스 계정에 테스트 리스팅 추가 완료
- [ ] OAuth 연결 성공
- [ ] 리스팅 가져오기 성공
- [ ] 공급처 감지 정확도 확인
- [ ] 좀비 필터링 테스트
- [ ] CSV Export 테스트
- [ ] AutoDS CSV 포맷 검증

---

## 🔧 문제 해결

### OAuth 연결 실패
- **문제**: Redirect URL이 일치하지 않음
- **해결**: eBay Developer Console에서 Redirect URL 정확히 확인

### 리스팅이 안 보임
- **문제**: 토큰 만료 또는 권한 부족
- **해결**: 
  1. Railway Logs에서 에러 확인
  2. 토큰 갱신 확인
  3. OAuth Scopes 재확인

### 공급처가 "Unverified"로 표시됨
- **문제**: SKU 패턴이 예상과 다름
- **해결**: 
  1. SKU 형식 확인 (예: `AUTODS-AMZ-...`)
  2. `backend/services.py`의 `extract_supplier_info` 함수에 패턴 추가

---

## 📚 추가 자료

- [상세 가이드](./EBAY_SANDBOX_TEST_GUIDE.md)
- [eBay Developer Portal](https://developer.ebay.com)
- [eBay Sandbox Guide](https://developer.ebay.com/my/keys)


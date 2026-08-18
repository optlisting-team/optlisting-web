# eBay 샌드박스 테스트 가이드

eBay 샌드박스 환경을 사용하여 실제 프로덕션 전에 모든 기능을 안전하게 테스트할 수 있습니다.

## 목차
1. [eBay 샌드박스 앱 생성](#1-ebay-샌드박스-앱-생성)
2. [환경변수 설정](#2-환경변수-설정)
3. [OAuth 연결 테스트](#3-oauth-연결-테스트)
4. [리스팅 가져오기 테스트](#4-리스팅-가져오기-테스트)
5. [좀비 필터링 테스트](#5-좀비-필터링-테스트)
6. [CSV Export 테스트](#6-csv-export-테스트)
7. [프로덕션 전환](#7-프로덕션-전환)

---

## 1. eBay 샌드박스 테스트 계정 생성

### 1.1 eBay Developer Console 접속
1. https://developer.ebay.com 접속
2. 로그인 (eBay 계정 필요)
3. 상단 메뉴에서 **Sandbox** 탭 클릭

### 1.2 샌드박스 사용자(Sandbox User) 생성
1. **Sandbox Users** 섹션 찾기
2. **Create a Sandbox User** 버튼 클릭
3. 다음 정보 입력:
   - **User ID**: 원하는 사용자명 (예: `optlisting_test`)
   - **Email**: 테스트용 이메일 (예: `test@optlisting.com`)
   - **Password**: 강력한 비밀번호 설정
   - **First Name**: 테스트
   - **Last Name**: 계정
4. **Create User** 클릭
5. 생성된 계정 정보를 안전한 곳에 저장:
   ```
   Sandbox User ID: optlisting_test
   Email: test@optlisting.com
   Password: [설정한 비밀번호]
   ```

### 1.3 샌드박스 테스트 계정으로 로그인 확인
1. https://www.sandbox.ebay.com 접속
2. 생성한 샌드박스 계정으로 로그인
3. 로그인 성공 확인

### 1.4 샌드박스 앱 생성
1. https://developer.ebay.com → **Sandbox** 탭
2. **Get Your App Keys** 클릭
3. **Create an App Key** 클릭
4. 다음 정보 입력:
   - **App Name**: `OptListing Sandbox Test`
   - **App Type**: `OAuth Client ID` 선택
5. **Create** 클릭

### 1.5 샌드박스 앱 키 확인 및 저장
생성된 앱에서 다음 정보를 복사하여 안전한 곳에 저장:
- **App ID (Client ID)**: `EBAY_CLIENT_ID_SANDBOX`
- **Cert ID (Client Secret)**: `EBAY_CLIENT_SECRET_SANDBOX`

⚠️ **중요**: 이 키들은 나중에 Railway 환경변수에 설정할 것입니다.

### 1.6 Redirect URL 설정
1. 생성한 앱의 **User Tokens** 탭 클릭
2. **Add eBay Redirect URL** 클릭
3. 샌드박스 Redirect URL 추가:
   ```
   https://your-frontend-url.com/api/ebay/auth/callback
   ```
   또는 로컬 테스트 시:
   ```
   http://localhost:8000/api/ebay/auth/callback
   ```
4. **Save** 클릭

### 1.7 OAuth Scopes 설정
다음 스코프들을 활성화 (체크박스 선택):
- ✅ `https://api.ebay.com/oauth/api_scope`
- ✅ `https://api.ebay.com/oauth/api_scope/sell.inventory`
- ✅ `https://api.ebay.com/oauth/api_scope/sell.marketing.readonly`
- ✅ `https://api.ebay.com/oauth/api_scope/sell.analytics.readonly`
- ✅ `https://api.ebay.com/oauth/api_scope/sell.account.readonly`

### 1.8 RuName 확인
1. **User Tokens** 탭에서 **RuName** 확인
2. RuName을 복사하여 저장 (예: `OptListing_Prod_Sandbox_optlisting_test`)
3. 이 값은 `EBAY_RU_NAME` 환경변수에 사용됩니다.

---

## 2. 환경변수 설정

### 2.1 Railway 환경변수 설정
Railway Dashboard → **Variables** 탭에서 다음 환경변수 추가/수정:

```bash
# eBay 샌드박스 설정
EBAY_CLIENT_ID=your_sandbox_app_id
EBAY_CLIENT_SECRET=your_sandbox_client_secret
EBAY_ENVIRONMENT=SANDBOX  # ⚠️ 중요: SANDBOX로 설정
EBAY_RU_NAME=your_redirect_url_name  # eBay Developer Console에서 확인

# Frontend URL (Callback URL에 사용)
FRONTEND_URL=https://your-frontend-url.com
```

### 2.2 로컬 테스트 시 (.env 파일)
`backend/.env` 파일 생성:

```bash
EBAY_CLIENT_ID=your_sandbox_app_id
EBAY_CLIENT_SECRET=your_sandbox_client_secret
EBAY_ENVIRONMENT=SANDBOX
EBAY_RU_NAME=your_redirect_url_name
FRONTEND_URL=http://localhost:5173
```

---

## 3. 샌드박스 테스트 계정에 리스팅 추가

### 3.1 샌드박스 eBay에 로그인
1. https://www.sandbox.ebay.com 접속
2. 생성한 샌드박스 테스트 계정으로 로그인

### 3.2 테스트 리스팅 생성 (수동)
1. **Sell** 메뉴 클릭
2. **List an item** 클릭
3. 간단한 테스트 제품 등록:
   - **Title**: `Test Product - AutoDS SKU-AMZ-B08ABC1234`
   - **SKU**: `AUTODS-AMZ-B08ABC1234` (AutoDS 포맷으로 설정)
   - **Price**: $19.99
   - **Quantity**: 1
   - **Condition**: New
   - **Category**: 선택
   - **Description**: 테스트용 제품입니다
4. **List your item** 클릭하여 등록
5. 여러 개의 테스트 리스팅 생성 권장 (다양한 SKU 패턴):
   - `AMZ-B08ABC1234` → Amazon 제품
   - `WM-123456` → Walmart 제품
   - `AE-789012` → AliExpress 제품
   - `AUTODS-AMZ-B08XYZ5678` → AutoDS 경유 Amazon 제품
   - `SHOP-AMZ-B08DEF9012` → Shopify 경유 Amazon 제품

### 3.3 AutoDS 연결 (선택사항)
실제 AutoDS를 샌드박스 eBay 계정에 연결하려면:
1. AutoDS Dashboard 로그인
2. **Stores** → **Add Store** → **eBay**
3. eBay 샌드박스 계정 연결
4. AutoDS가 리스팅을 동기화하도록 설정

⚠️ **참고**: AutoDS가 샌드박스 eBay를 지원하는지 확인이 필요합니다. 
일반적으로 AutoDS는 프로덕션 eBay만 지원할 수 있으므로, 
수동으로 리스팅을 생성하는 것이 더 확실합니다.

## 4. OAuth 연결 테스트

### 4.1 Railway 환경변수 설정 확인
Railway Dashboard → **Variables** 탭에서 다음이 설정되어 있는지 확인:
```bash
EBAY_CLIENT_ID=your_sandbox_app_id
EBAY_CLIENT_SECRET=your_sandbox_client_secret
EBAY_ENVIRONMENT=SANDBOX
EBAY_RU_NAME=your_ru_name
FRONTEND_URL=https://your-frontend-url.com
```

### 4.2 OAuth 연결 플로우 테스트
1. 프론트엔드에서 **Settings** → **Connect eBay** 클릭
2. eBay 샌드박스 로그인 페이지로 리다이렉트됨
   - URL이 `https://auth.sandbox.ebay.com`로 시작하는지 확인
3. **샌드박스 테스트 계정**으로 로그인
   - 이메일: `test@optlisting.com` (1.2에서 생성한 계정)
   - 비밀번호: 설정한 비밀번호
4. 권한 승인 화면에서 **Agree** 클릭
5. Callback URL로 리다이렉트되어 성공 메시지 확인

### 4.3 토큰 저장 확인
Railway Logs 또는 DB에서 확인:
```sql
SELECT 
  user_id, 
  ebay_access_token, 
  ebay_token_expires_at,
  ebay_user_id,
  ebay_token_updated_at
FROM profiles 
WHERE ebay_access_token IS NOT NULL;
```

토큰이 정상적으로 저장되었는지 확인:
- `ebay_access_token`: NULL이 아님
- `ebay_token_expires_at`: 미래 날짜
- `ebay_user_id`: 샌드박스 테스트 계정의 eBay User ID

---

## 5. 리스팅 가져오기 테스트

### 5.1 API 엔드포인트 테스트
```bash
# Health Check
curl https://your-backend-url.com/api/health

# 리스팅 가져오기 (자동 트리거 또는 수동)
# 프론트엔드에서 "Analyze Listings" 버튼 클릭
```

### 5.2 리스팅 데이터 확인
DB에서 확인:
```sql
SELECT 
  item_id, 
  title, 
  supplier_name, 
  marketplace,
  metrics->>'sales' as sales,
  metrics->>'watches' as watches,
  metrics->>'impressions' as impressions,
  metrics->>'views' as views,
  created_at
FROM listings 
WHERE user_id = 'your_user_id'
ORDER BY created_at DESC
LIMIT 20;
```

### 5.3 공급처 감지 확인
샌드박스 리스팅의 SKU를 확인하여 공급처가 올바르게 감지되는지 확인:
- `AMZ-*` → Amazon
- `WM-*` → Walmart
- `AE-*` → AliExpress
- `AUTODS-*` → AutoDS (Amazon 제품)
- 기타 패턴 확인

---

## 6. 좀비 필터링 테스트

### 6.1 좀비 리스팅 생성 조건
좀비 리스팅은 다음 조건을 만족해야 합니다:
- **Days (Age)**: 60일 이상
- **Sales**: 0
- **Watches**: 0 또는 매우 낮음
- **Impressions**: 매우 낮음
- **Views**: 매우 낮음

### 6.2 필터링 테스트
1. 프론트엔드에서 필터 설정:
   - **Days**: 60
   - **Sales**: 0
   - **Watches**: 0
   - **Impressions**: 100 이하
   - **Views**: 50 이하

2. **Apply Filters** 클릭

3. 좀비 리스팅이 올바르게 필터링되는지 확인

### 6.3 좀비 통계 확인
```sql
SELECT 
  COUNT(*) as total_zombies,
  supplier_name,
  COUNT(*) FILTER (WHERE metrics->>'management_hub' = 'Shopify') as shopify_routed
FROM listings
WHERE user_id = 'your_user_id'
  AND (metrics->>'sales')::int = 0
  AND (metrics->>'watches')::int = 0
  AND age(created_at) >= interval '60 days'
GROUP BY supplier_name;
```

---

## 7. CSV Export 테스트

### 7.1 AutoDS CSV 포맷 확인
1. 프론트엔드에서 좀비 리스팅 선택
2. **Add to Queue** 클릭
3. **Review Queue** 패널에서 **Download CSV** 클릭
4. 생성된 CSV 파일 확인

### 7.2 AutoDS CSV 필수 컬럼
다음 컬럼들이 포함되어야 합니다:
- `SKU` (또는 `Item SKU`)
- `Action` (또는 `Delete`, `Remove`)
- 기타 AutoDS 요구사항

### 7.3 CSV 파일 검증
```python
import pandas as pd

# CSV 파일 읽기
df = pd.read_csv('autods_delete.csv')

# 필수 컬럼 확인
required_columns = ['SKU', 'Action']  # AutoDS 요구사항에 맞게 수정
assert all(col in df.columns for col in required_columns), "필수 컬럼 누락"

# 데이터 확인
print(df.head())
print(f"Total rows: {len(df)}")
```

### 7.4 AutoDS에 업로드 테스트
1. AutoDS Dashboard 로그인
2. **Products** → **Bulk Actions** (또는 유사 메뉴)
3. 생성된 CSV 파일 업로드
4. 삭제 작업이 올바르게 처리되는지 확인

### 7.5 Shopify 경유 항목 테스트
Shopify 경유 항목의 경우:
1. **Download Shopify CSV** 버튼 클릭
2. Shopify Matrixify 포맷 또는 Shopify Tagging 포맷 확인
3. Shopify에 업로드하여 삭제 테스트

---

## 8. 프로덕션 전환

### 8.1 프로덕션 앱 생성
1. https://developer.ebay.com → **Production** 탭
2. 프로덕션 앱 생성 (샌드박스와 동일한 과정)
3. 프로덕션 앱 키 복사

### 8.2 환경변수 업데이트
```bash
# Railway 환경변수 수정
EBAY_CLIENT_ID=your_production_app_id
EBAY_CLIENT_SECRET=your_production_client_secret
EBAY_ENVIRONMENT=PRODUCTION  # ⚠️ PRODUCTION으로 변경
```

### 8.3 최종 테스트 체크리스트
- [ ] OAuth 연결 성공
- [ ] 리스팅 가져오기 성공
- [ ] 공급처 감지 정확도 확인
- [ ] Shopify 경유 감지 확인
- [ ] 좀비 필터링 정확도 확인
- [ ] CSV Export 포맷 검증
- [ ] AutoDS 업로드 테스트 성공
- [ ] 에러 핸들링 확인
- [ ] 로그 모니터링 설정

---

## 문제 해결

### OAuth 연결 실패
- **문제**: Redirect URL이 일치하지 않음
- **해결**: eBay Developer Console에서 Redirect URL 정확히 확인

### 리스팅 가져오기 실패
- **문제**: 토큰 만료 또는 권한 부족
- **해결**: 토큰 갱신 확인, OAuth Scopes 재확인

### 공급처 감지 실패
- **문제**: SKU 패턴이 예상과 다름
- **해결**: `backend/services.py`의 `extract_supplier_info` 함수에 패턴 추가

### CSV 포맷 오류
- **문제**: AutoDS가 CSV를 인식하지 못함
- **해결**: `backend/services.py`의 `generate_export_csv` 함수에서 포맷 확인

---

## 참고 자료
- [eBay Developer Portal](https://developer.ebay.com)
- [eBay OAuth 2.0 Guide](https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html)
- [eBay Sandbox Guide](https://developer.ebay.com/my/keys)
- [AutoDS CSV Format](https://help.autods.com/) (AutoDS 문서 확인 필요)


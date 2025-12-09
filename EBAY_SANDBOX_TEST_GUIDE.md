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

## 1. eBay 샌드박스 앱 생성

### 1.1 eBay Developer Console 접속
1. https://developer.ebay.com 접속
2. **Sandbox** 탭으로 이동 (상단 메뉴)
3. **Get Your App Keys** 클릭

### 1.2 샌드박스 앱 생성
1. **Create an App Key** 클릭
2. **App Name**: `OptListing Sandbox` (또는 원하는 이름)
3. **App Type**: `OAuth Client ID` 선택
4. **Create** 클릭

### 1.3 샌드박스 앱 키 확인
생성된 앱에서 다음 정보를 복사:
- **App ID (Client ID)**: `EBAY_CLIENT_ID_SANDBOX`
- **Cert ID (Client Secret)**: `EBAY_CLIENT_SECRET_SANDBOX`

### 1.4 Redirect URL 설정
1. **User Tokens** 탭 클릭
2. **Add eBay Redirect URL** 클릭
3. 샌드박스 Redirect URL 추가:
   ```
   https://your-frontend-url.com/api/ebay/auth/callback
   ```
   또는 로컬 테스트 시:
   ```
   http://localhost:8000/api/ebay/auth/callback
   ```

### 1.5 OAuth Scopes 설정
다음 스코프들을 활성화:
- `https://api.ebay.com/oauth/api_scope`
- `https://api.ebay.com/oauth/api_scope/sell.inventory`
- `https://api.ebay.com/oauth/api_scope/sell.marketing.readonly`
- `https://api.ebay.com/oauth/api_scope/sell.analytics.readonly`
- `https://api.ebay.com/oauth/api_scope/sell.account.readonly`

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

## 3. OAuth 연결 테스트

### 3.1 샌드박스 테스트 계정 생성
1. https://developer.ebay.com → **Sandbox** 탭
2. **Sandbox Users** 섹션
3. **Create a Sandbox User** 클릭
4. 테스트 계정 정보 저장 (이메일, 비밀번호)

### 3.2 OAuth 연결 플로우 테스트
1. 프론트엔드에서 **Settings** → **Connect eBay** 클릭
2. eBay 샌드박스 로그인 페이지로 리다이렉트됨
3. **샌드박스 테스트 계정**으로 로그인
4. 권한 승인
5. Callback URL로 리다이렉트되어 토큰 저장 확인

### 3.3 토큰 저장 확인
Railway Logs 또는 DB에서 확인:
```sql
SELECT user_id, ebay_access_token, ebay_token_expires_at 
FROM profiles 
WHERE ebay_access_token IS NOT NULL;
```

---

## 4. 리스팅 가져오기 테스트

### 4.1 샌드박스 리스팅 생성 (선택사항)
eBay 샌드박스 환경에서 테스트 리스팅을 직접 생성할 수도 있지만, 
실제 샌드박스 계정에 있는 리스팅을 가져오는 것이 더 현실적입니다.

### 4.2 API 엔드포인트 테스트
```bash
# Health Check
curl https://your-backend-url.com/api/health

# 리스팅 가져오기 (자동 트리거 또는 수동)
# 프론트엔드에서 "Analyze Listings" 버튼 클릭
```

### 4.3 리스팅 데이터 확인
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

### 4.4 공급처 감지 확인
샌드박스 리스팅의 SKU를 확인하여 공급처가 올바르게 감지되는지 확인:
- `AMZ-*` → Amazon
- `WM-*` → Walmart
- `AE-*` → AliExpress
- `AUTODS-*` → AutoDS (Amazon 제품)
- 기타 패턴 확인

---

## 5. 좀비 필터링 테스트

### 5.1 좀비 리스팅 생성 조건
좀비 리스팅은 다음 조건을 만족해야 합니다:
- **Days (Age)**: 60일 이상
- **Sales**: 0
- **Watches**: 0 또는 매우 낮음
- **Impressions**: 매우 낮음
- **Views**: 매우 낮음

### 5.2 필터링 테스트
1. 프론트엔드에서 필터 설정:
   - **Days**: 60
   - **Sales**: 0
   - **Watches**: 0
   - **Impressions**: 100 이하
   - **Views**: 50 이하

2. **Apply Filters** 클릭

3. 좀비 리스팅이 올바르게 필터링되는지 확인

### 5.3 좀비 통계 확인
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

## 6. CSV Export 테스트

### 6.1 AutoDS CSV 포맷 확인
1. 프론트엔드에서 좀비 리스팅 선택
2. **Add to Queue** 클릭
3. **Review Queue** 패널에서 **Download CSV** 클릭
4. 생성된 CSV 파일 확인

### 6.2 AutoDS CSV 필수 컬럼
다음 컬럼들이 포함되어야 합니다:
- `SKU` (또는 `Item SKU`)
- `Action` (또는 `Delete`, `Remove`)
- 기타 AutoDS 요구사항

### 6.3 CSV 파일 검증
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

### 6.4 AutoDS에 업로드 테스트
1. AutoDS Dashboard 로그인
2. **Products** → **Bulk Actions** (또는 유사 메뉴)
3. 생성된 CSV 파일 업로드
4. 삭제 작업이 올바르게 처리되는지 확인

### 6.5 Shopify 경유 항목 테스트
Shopify 경유 항목의 경우:
1. **Download Shopify CSV** 버튼 클릭
2. Shopify Matrixify 포맷 또는 Shopify Tagging 포맷 확인
3. Shopify에 업로드하여 삭제 테스트

---

## 7. 프로덕션 전환

### 7.1 프로덕션 앱 생성
1. https://developer.ebay.com → **Production** 탭
2. 프로덕션 앱 생성 (샌드박스와 동일한 과정)
3. 프로덕션 앱 키 복사

### 7.2 환경변수 업데이트
```bash
# Railway 환경변수 수정
EBAY_CLIENT_ID=your_production_app_id
EBAY_CLIENT_SECRET=your_production_client_secret
EBAY_ENVIRONMENT=PRODUCTION  # ⚠️ PRODUCTION으로 변경
```

### 7.3 최종 테스트 체크리스트
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


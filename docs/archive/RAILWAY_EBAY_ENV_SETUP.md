# Railway eBay 환경 변수 설정 (긴급!)

## 🚨 현재 에러
- `500 Internal Server Error`: "eBay RuName not configured"
- `/api/ebay/auth/start` 엔드포인트가 작동하지 않음

## ✅ 해결 방법

### Railway 환경 변수 추가

1. **Railway 대시보드 접속**
   - https://railway.app 접속
   - OptListing 프로젝트 선택

2. **Variables 탭 클릭**

3. **다음 환경 변수 추가:**

#### 필수 환경 변수:
```bash
EBAY_CLIENT_ID=your_ebay_app_id
EBAY_CLIENT_SECRET=your_ebay_cert_id
EBAY_RU_NAME=your_ru_name
EBAY_ENVIRONMENT=PRODUCTION
```

### eBay Developer Console에서 값 확인

1. **https://developer.ebay.com** 접속
2. **User Tokens** 탭 클릭
3. **Application Keys** 섹션에서:
   - **App ID (Client ID)** → `EBAY_CLIENT_ID`
   - **Cert ID (Client Secret)** → `EBAY_CLIENT_SECRET`
4. **RuName 확인:**
   - **User Tokens** → **Add eBay Redirect URL** 클릭
   - 등록된 Redirect URL의 **RuName** 복사 → `EBAY_RU_NAME`

### Redirect URL 설정

eBay Developer Console에서:
1. **User Tokens** → **Add eBay Redirect URL**
2. 다음 URL 추가:
   ```
   https://web-production-3dc73.up.railway.app/api/ebay/auth/callback
   ```
3. **RuName** 복사하여 Railway 환경 변수에 추가

### 환경 변수 추가 후

1. **Railway 재배포** (자동 또는 수동)
2. **배포 완료 대기** (1-2분)
3. **다시 테스트**

## 확인 방법

배포 후 다음 URL로 테스트:
```
https://web-production-3dc73.up.railway.app/api/ebay/auth/start?user_id=test-user
```

**예상 결과:**
- ✅ eBay 로그인 페이지로 리다이렉트됨
- ❌ 여전히 500 에러 → 환경 변수 확인 필요

## 빠른 체크리스트

- [ ] `EBAY_CLIENT_ID` 추가됨
- [ ] `EBAY_CLIENT_SECRET` 추가됨
- [ ] `EBAY_RU_NAME` 추가됨 (⚠️ 가장 중요!)
- [ ] `EBAY_ENVIRONMENT=PRODUCTION` 추가됨
- [ ] Railway 재배포 완료
- [ ] 테스트 완료


# eBay RuName 확인 방법

## 📍 현재 화면에서 확인할 수 있는 것

현재 **"Application Keys"** 화면에서는:
- ✅ **App ID (Client ID)**: (eBay Developer Console에서 확인)
- ✅ **Cert ID (Client Secret)**: (eBay Developer Console에서 확인)
- ❌ **RuName**: 여기서는 보이지 않음

## 🔍 RuName 확인 방법

### 방법 1: User Tokens 탭에서 확인 (권장)

1. **현재 화면에서 "User Tokens" 링크 클릭**
   - Production 섹션의 "User Tokens" 링크 클릭

2. **"Add eBay Redirect URL" 또는 "eBay Redirect URLs" 섹션 찾기**
   - 이미 등록된 Redirect URL이 있으면 목록에 표시됨
   - 각 Redirect URL 옆에 **RuName**이 표시됨

3. **RuName 형식:**
   - 예: `OptListing-OptListi-optl-abcde`
   - 또는: `Supersel-OptListi-PRD-abcde`

### 방법 2: Redirect URL 추가하면서 RuName 확인

1. **"Add eBay Redirect URL" 클릭**

2. **Redirect URL 입력:**
   ```
   https://optlisting-production.up.railway.app/api/ebay/auth/callback
   ```

3. **"Save" 또는 "Add" 클릭**

4. **생성된 RuName 복사**
   - 저장 후 RuName이 자동 생성되어 표시됨
   - 이 RuName을 Railway 환경 변수에 추가해야 함

## ⚠️ 중요: RuName과 Redirect URL의 관계

**RuName은 Redirect URL의 별칭(alias)입니다:**
- eBay는 RuName을 실제 URL로 매핑합니다
- OAuth 요청 시 `redirect_uri` 파라미터에 **RuName**을 사용합니다
- eBay는 RuName을 실제 URL로 변환하여 콜백을 보냅니다

**따라서:**
1. eBay Developer Console에서 RuName이 Railway 콜백 URL로 설정되어 있어야 함
2. Railway의 `EBAY_RU_NAME` 환경 변수는 eBay의 RuName과 **정확히 일치**해야 함

## 📋 확인 체크리스트

### eBay Developer Console:
- [ ] "User Tokens" 탭으로 이동
- [ ] Redirect URL이 등록되어 있는지 확인
- [ ] RuName 복사 (예: `OptListing-OptListi-optl-abcde`)
- [ ] Redirect URL이 Railway 콜백 URL과 일치하는지 확인:
  ```
  https://optlisting-production.up.railway.app/api/ebay/auth/callback
  ```

### Railway 환경 변수:
- [ ] `EBAY_RU_NAME` 환경 변수가 eBay의 RuName과 **정확히 일치**하는지 확인
- [ ] `EBAY_CLIENT_ID` = (eBay Developer Console의 App ID)
- [ ] `EBAY_CLIENT_SECRET` = (eBay Developer Console의 Cert ID)
- [ ] `EBAY_ENVIRONMENT` = `PRODUCTION`

## 🎯 다음 단계

1. **"User Tokens" 탭 클릭**
2. **RuName 확인 및 복사**
3. **Railway 환경 변수에 추가:**
   - Key: `EBAY_RU_NAME`
   - Value: (eBay에서 복사한 RuName)
4. **Railway 재배포**
5. **다시 테스트**


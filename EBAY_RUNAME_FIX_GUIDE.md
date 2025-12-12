# eBay RuName 설정 수정 가이드

## 🔍 현재 확인된 정보

**eBay Developer Console:**
- ✅ RuName: `Supersell_Inter-Supersel-OptLis-ikjzwgcjy`
- ✅ OAuth Enabled: 활성화됨
- ✅ Auth Accepted URL: `https://optlisting.com/dashboard`
- ⚠️ **문제**: OAuth Redirect URI가 백엔드 URL로 설정되어 있지 않음

## 🚨 핵심 문제

eBay OAuth는 **두 가지 URL**이 필요합니다:

1. **Redirect URI (RuName에 매핑)**: 
   - OAuth 콜백을 받는 **백엔드 URL**
   - 현재: 설정되지 않음 또는 잘못된 URL
   - **필요한 URL**: `https://optlisting-production.up.railway.app/api/ebay/auth/callback`

2. **Auth Accepted URL**:
   - 사용자가 동의한 후 리다이렉트될 **프론트엔드 URL**
   - 현재: `https://optlisting.com/dashboard` ✅ (올바름)

## ✅ 해결 방법

### Step 1: eBay Developer Console에서 Redirect URI 확인/수정

현재 화면에서:

1. **"Your auth accepted URL" 필드 확인**
   - 현재: `https://optlisting.com/dashboard` ✅

2. **중요: Redirect URI 확인 필요**
   - eBay Developer Console에서 RuName 설정 시 **실제 콜백 URL**을 입력해야 함
   - 하지만 현재 화면에는 Redirect URI 필드가 보이지 않음

3. **RuName 편집 또는 새로 만들기**
   - 현재 RuName을 클릭하거나 "Clone" 버튼 사용
   - **Redirect URI** 필드에 다음 URL 입력:
     ```
     https://optlisting-production.up.railway.app/api/ebay/auth/callback
     ```

### Step 2: Railway 환경 변수 확인

Railway 대시보드 → Variables에서 확인:

```bash
EBAY_RU_NAME=Supersell_Inter-Supersel-OptLis-ikjzwgcjy
EBAY_CLIENT_ID=(eBay Developer Console의 App ID)
EBAY_CLIENT_SECRET=(eBay Developer Console의 Cert ID)
EBAY_ENVIRONMENT=PRODUCTION
FRONTEND_URL=https://optlisting.com
```

**확인 사항:**
- [ ] `EBAY_RU_NAME`이 `Supersell_Inter-Supersel-OptLis-ikjzwgcjy`와 **정확히 일치**하는지
- [ ] 모든 환경 변수가 설정되어 있는지

### Step 3: eBay RuName의 Redirect URI 확인

**문제 가능성:**
- RuName이 생성될 때 Redirect URI가 다른 URL로 설정되었을 수 있음
- 예: `https://optlisting.com/dashboard` (프론트엔드 URL)
- 하지만 실제로는 `https://optlisting-production.up.railway.app/api/ebay/auth/callback` (백엔드 URL)이어야 함

**확인 방법:**
1. eBay Developer Console에서 RuName 편집
2. Redirect URI 필드 확인
3. 만약 프론트엔드 URL로 되어 있으면 백엔드 URL로 변경

## 🎯 테스트 방법

### 1. Railway 로그 확인
Connect 버튼 클릭 후:
- `🚀 eBay OAuth Start Request` 로그 확인
- `🔐 eBay OAuth Callback Received` 로그 확인

### 2. 브라우저 Network 탭 확인
- `/api/ebay/auth/start` 요청이 302로 리다이렉트되는지
- eBay 로그인 페이지로 이동하는지

### 3. OAuth 콜백 확인
- eBay 로그인 후 콜백이 Railway로 전달되는지
- Railway 로그에 콜백 로그가 나타나는지

## 📋 체크리스트

### eBay Developer Console:
- [ ] RuName: `Supersell_Inter-Supersel-OptLis-ikjzwgcjy` 확인
- [ ] Redirect URI가 `https://optlisting-production.up.railway.app/api/ebay/auth/callback`로 설정되어 있는지 확인
- [ ] Auth Accepted URL이 `https://optlisting.com/dashboard`로 설정되어 있는지 확인 (이미 확인됨 ✅)

### Railway 환경 변수:
- [ ] `EBAY_RU_NAME=Supersell_Inter-Supersel-OptLis-ikjzwgcjy` (정확히 일치)
- [ ] `EBAY_CLIENT_ID` = (eBay Developer Console의 App ID)
- [ ] `EBAY_CLIENT_SECRET` = (eBay Developer Console의 Cert ID)
- [ ] `EBAY_ENVIRONMENT=PRODUCTION`
- [ ] `FRONTEND_URL=https://optlisting.com`

## ⚠️ 가장 가능성 높은 문제

**RuName의 Redirect URI가 백엔드 URL이 아닌 프론트엔드 URL로 설정되어 있을 가능성**

**해결:**
1. eBay Developer Console에서 RuName 편집
2. Redirect URI를 `https://optlisting-production.up.railway.app/api/ebay/auth/callback`로 변경
3. 저장 후 Railway 재배포
4. 다시 테스트


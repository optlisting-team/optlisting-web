# OAuth 시작 요청 디버깅 가이드

## 🔍 현재 상황

Railway 로그에 `🚀 eBay OAuth Start Request`가 없음
→ Connect 버튼 클릭이 Railway에 도달하지 않음

## 📋 확인 단계

### Step 1: 브라우저 Network 탭 확인

1. **개발자 도구 열기** (F12)
2. **Network 탭 선택**
3. **Connect 버튼 클릭**
4. **다음 요청이 보이는지 확인:**
   - `/api/ebay/auth/start?user_id=default-user`
   - Status: 302 (리다이렉트)
   - Response Headers에 `Location` 헤더 확인

**예상 결과:**
- ✅ 요청이 보임 → eBay 로그인 페이지로 리다이렉트됨
- ❌ 요청이 안 보임 → 프론트엔드 문제

### Step 2: 브라우저 콘솔 확인

1. **Console 탭 선택**
2. **Connect 버튼 클릭**
3. **다음 로그가 보이는지 확인:**
   - `🔗 eBay OAuth 버튼 클릭됨`
   - `리다이렉트 시작...`
   - 에러 메시지가 있는지 확인

### Step 3: 직접 URL 테스트

브라우저 주소창에 직접 입력:
```
https://optlisting-production.up.railway.app/api/ebay/auth/start?user_id=default-user
```

**예상 결과:**
- ✅ eBay 로그인 페이지로 리다이렉트됨
- ❌ 500 에러 → Railway 환경 변수 문제
- ❌ 404 에러 → 엔드포인트 경로 문제

### Step 4: Railway 로그 확인

Connect 버튼 클릭 직후 Railway 로그에서 확인:
- `🚀 eBay OAuth Start Request` 로그가 나타나는지
- 에러 메시지가 있는지

## 🚨 가능한 원인

### 1. 프론트엔드 리다이렉트 문제
- Connect 버튼의 `onClick` 핸들러가 작동하지 않음
- `window.location.href`가 차단됨

### 2. CORS 문제
- 브라우저가 요청을 차단
- Network 탭에 CORS 에러 표시

### 3. API URL 문제
- `VITE_API_URL` 환경 변수가 잘못 설정됨
- 기본값이 잘못된 URL 사용

### 4. eBay 환경 변수 문제
- Railway에 `EBAY_CLIENT_ID` 또는 `EBAY_RU_NAME`이 없음
- 500 에러 발생

## ✅ 해결 방법

### 방법 1: 브라우저 콘솔에서 직접 테스트

```javascript
// 브라우저 콘솔에서 실행
const apiUrl = 'https://optlisting-production.up.railway.app'
const oauthUrl = `${apiUrl}/api/ebay/auth/start?user_id=default-user`
console.log('OAuth URL:', oauthUrl)
window.location.href = oauthUrl
```

### 방법 2: Connect 버튼 코드 확인

현재 코드:
```javascript
<button
  onClick={(e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const apiUrl = import.meta.env.VITE_API_URL || 'https://optlisting-production.up.railway.app'
    const oauthUrl = `${apiUrl}/api/ebay/auth/start?user_id=default-user`
    
    console.log('🔗 eBay OAuth 버튼 클릭됨')
    console.log('API URL:', apiUrl)
    console.log('OAuth URL:', oauthUrl)
    
    window.location.href = oauthUrl
  }}
>
  Connect
</button>
```

### 방법 3: Railway 환경 변수 확인

Railway → Variables에서 확인:
- [ ] `EBAY_CLIENT_ID` 설정됨
- [ ] `EBAY_RU_NAME` 설정됨
- [ ] `EBAY_CLIENT_SECRET` 설정됨
- [ ] `EBAY_ENVIRONMENT=PRODUCTION` 설정됨

## 🎯 다음 단계

1. **브라우저 Network 탭에서 요청 확인**
2. **브라우저 콘솔에서 로그 확인**
3. **직접 URL 테스트**
4. **결과를 알려주세요**




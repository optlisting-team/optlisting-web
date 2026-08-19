# eBay OAuth Redirect URI 설명

## 🔍 현재 화면에 보이는 URL들

### 1. "Your auth accepted URL"
- **값**: `https://optlisting.com/dashboard`
- **용도**: 사용자가 OAuth 동의 후 리다이렉트될 **프론트엔드 URL**
- **타이밍**: 백엔드가 토큰을 저장한 **후** 사용자를 이 URL로 보냄
- **역할**: ✅ 올바르게 설정됨

### 2. "Your auth declined URL"
- **값**: `https://optlisting.com`
- **용도**: 사용자가 OAuth 거부 후 리다이렉트될 **프론트엔드 URL**
- **타이밍**: 사용자가 "거부" 버튼을 클릭한 **즉시**
- **역할**: ✅ 올바르게 설정됨

## ❌ 하지만 이것들은 Redirect URI가 아닙니다!

**Redirect URI는 OAuth 콜백을 받는 백엔드 URL입니다:**
```
https://optlisting-production.up.railway.app/api/ebay/auth/callback
```

## 🔍 Redirect URI는 어디에 있나요?

eBay Developer Console에서 RuName을 만들 때:
1. **RuName 생성 시** Redirect URI를 입력하는 필드가 있습니다
2. 또는 **RuName 편집 화면**에서 확인/수정할 수 있습니다

### 확인 방법:

1. **현재 RuName 항목을 클릭**하여 편집 화면 열기
2. 또는 **"Clone" 버튼** 클릭하여 새 RuName 만들기 화면 확인
3. **"Redirect URI" 또는 "eBay Redirect URL"** 필드 찾기

## 📋 eBay OAuth Flow 설명

```
1. 사용자가 Connect 버튼 클릭
   ↓
2. 백엔드가 eBay Authorization URL 생성
   - redirect_uri = RuName (예: Supersell_Inter-Supersel-OptLis-ikjzwgcjy)
   ↓
3. eBay가 사용자를 로그인 페이지로 리다이렉트
   ↓
4. 사용자가 로그인 및 권한 승인
   ↓
5. eBay가 RuName에 매핑된 실제 URL로 콜백 전송
   - 예: https://optlisting-production.up.railway.app/api/ebay/auth/callback
   - 이 URL이 "Redirect URI"입니다!
   ↓
6. 백엔드가 authorization code를 받아 토큰 교환
   ↓
7. 백엔드가 토큰을 DB에 저장
   ↓
8. 백엔드가 사용자를 "Your auth accepted URL"로 리다이렉트
   - 예: https://optlisting.com/dashboard
```

## ⚠️ 문제 가능성

**만약 RuName이 생성될 때 Redirect URI가 설정되지 않았거나 잘못 설정되었다면:**
- eBay가 콜백을 어디로 보낼지 모름
- 백엔드가 콜백을 받지 못함
- 토큰을 저장할 수 없음

## ✅ 해결 방법

1. **RuName 편집 화면 열기**
   - 현재 RuName 클릭
   - 또는 "Clone" 버튼으로 새로 만들기

2. **Redirect URI 필드 확인**
   - 다음 URL이 설정되어 있는지 확인:
     ```
     https://optlisting-production.up.railway.app/api/ebay/auth/callback
     ```

3. **없거나 다르면 수정**
   - 올바른 URL로 변경
   - 저장

## 💡 요약

- **"Your auth accepted URL"** = 프론트엔드 (사용자 동의 후)
- **"Your auth declined URL"** = 프론트엔드 (사용자 거부 후)
- **"Redirect URI"** = 백엔드 (OAuth 콜백 받는 곳) ← **이게 중요!**

현재 화면에는 Redirect URI 필드가 보이지 않으므로, RuName 편집 화면을 열어서 확인해야 합니다.


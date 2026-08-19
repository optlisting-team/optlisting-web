# eBay RuName Redirect URI 확인 방법 (단계별)

## ✅ Step 1: Railway 환경 변수 확인 완료

Railway에서 확인됨:
- `EBAY_RU_NAME` = `Supersell_Inter-Supersel-OptLis-ikjzwgcjy` ✅

## 🔍 Step 2: eBay Developer Console에서 Redirect URI 확인

### 방법 A: 현재 RuName 편집하기 (권장)

1. **eBay Developer Console 접속**
   - https://developer.ebay.com/my/keys
   - 로그인

2. **"User Tokens" 탭 클릭**
   - 상단 메뉴에서 "User Tokens" 선택
   - 또는 Production 섹션의 "User Tokens" 링크 클릭

3. **현재 RuName 찾기**
   - 목록에서 `Supersell_Inter-Supersel-OptLis-ikjzwgcjy` 찾기
   - 또는 "OptListing Production" Display Title 찾기

4. **RuName 클릭 또는 편집 버튼 클릭**
   - RuName 항목을 클릭하면 편집 화면이 열림
   - 또는 "Edit" 또는 "수정" 버튼 클릭

5. **Redirect URI 필드 확인**
   - 편집 화면에서 "Redirect URI" 또는 "eBay Redirect URL" 필드 찾기
   - 현재 설정된 URL 확인

6. **올바른 URL로 수정 (필요시)**
   - 현재 URL이 다음이 아닌 경우:
     ```
     https://optlisting-production.up.railway.app/api/ebay/auth/callback
     ```
   - 위 URL로 변경
   - "Save" 또는 "저장" 클릭

### 방법 B: 새 RuName 만들기 (기존 것이 수정 안 될 때)

1. **"Add eBay Redirect URL" 클릭**
   - User Tokens 화면에서 "+ Add eBay Redirect URL" 버튼 클릭

2. **새 RuName 생성**
   - **Display Title**: `OptListing Production Backend`
   - **Redirect URI**: 
     ```
     https://optlisting-production.up.railway.app/api/ebay/auth/callback
     ```
   - **Your auth accepted URL**: `https://optlisting.com/dashboard`
   - **Your auth declined URL**: `https://optlisting.com`

3. **"Save" 또는 "Add" 클릭**

4. **생성된 RuName 복사**
   - 새로 생성된 RuName 복사 (예: `OptListing-OptListi-optl-xyz123`)

5. **Railway 환경 변수 업데이트**
   - Railway → Variables → `EBAY_RU_NAME` 편집
   - 새 RuName으로 변경
   - 저장

## 📸 화면에서 찾아야 할 것

편집 화면에서 다음 필드들을 찾으세요:

```
┌─────────────────────────────────────────┐
│ RuName: Supersell_Inter-Supersel-...   │
│                                         │
│ Display Title: [OptListing Production] │
│                                         │
│ ⚠️ 여기가 중요!                          │
│ Redirect URI: [________________]        │
│   ↑ 이 필드에 백엔드 URL이 있어야 함     │
│                                         │
│ Your auth accepted URL:                │
│ [https://optlisting.com/dashboard]     │
│                                         │
│ Your auth declined URL:                │
│ [https://optlisting.com]               │
└─────────────────────────────────────────┘
```

## 🎯 확인해야 할 URL

**Redirect URI 필드에 다음 URL이 있어야 함:**
```
https://optlisting-production.up.railway.app/api/ebay/auth/callback
```

**만약 다른 URL이 있다면:**
- ❌ `https://optlisting.com/dashboard` (프론트엔드 URL - 잘못됨)
- ❌ `https://optlisting.com` (프론트엔드 URL - 잘못됨)
- ✅ `https://optlisting-production.up.railway.app/api/ebay/auth/callback` (백엔드 URL - 올바름)

## ⚠️ 중요 참고사항

**eBay OAuth는 두 가지 URL을 사용합니다:**

1. **Redirect URI (RuName에 매핑)**
   - OAuth 콜백을 받는 **백엔드 URL**
   - 예: `https://optlisting-production.up.railway.app/api/ebay/auth/callback`
   - 이 URL로 authorization code가 전달됨

2. **Auth Accepted URL**
   - 사용자가 동의한 후 리다이렉트될 **프론트엔드 URL**
   - 예: `https://optlisting.com/dashboard`
   - 백엔드가 토큰을 저장한 후 사용자를 이 URL로 리다이렉트

**따라서:**
- Redirect URI = 백엔드 (Railway)
- Auth Accepted URL = 프론트엔드 (Vercel)

## 🔧 수정 후 해야 할 일

1. **eBay Developer Console에서 저장**
2. **Railway 재배포** (환경 변수 변경 시 자동 재배포됨)
3. **테스트:**
   - Connect 버튼 클릭
   - eBay 로그인
   - Railway 로그에서 콜백 확인

## 💡 팁

만약 편집 화면이 안 보이거나 Redirect URI 필드가 없다면:
- eBay Developer Console의 UI가 업데이트되었을 수 있음
- "Clone" 버튼을 사용하여 새 RuName 만들기
- 또는 eBay 지원팀에 문의


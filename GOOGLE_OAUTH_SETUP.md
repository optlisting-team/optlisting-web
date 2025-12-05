# Google OAuth 설정 가이드

## 🎯 개요
OptListing에서 Google 로그인을 사용하려면 Supabase와 Google Cloud Console에서 설정이 필요합니다.

---

## 📋 Step 1: Google Cloud Console 설정

### 1.1 프로젝트 생성/선택
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. 프로젝트 이름: `OptListing` (권장)

### 1.2 OAuth 동의 화면 구성
1. **API 및 서비스** → **OAuth 동의 화면**
2. User Type: **External** 선택
3. 앱 정보 입력:
   - 앱 이름: `OptListing`
   - 사용자 지원 이메일: 본인 이메일
   - 앱 로고: (선택사항)
   - 개발자 연락처 이메일: 본인 이메일
4. **저장 후 계속**

### 1.3 OAuth 2.0 클라이언트 ID 생성
1. **API 및 서비스** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. 이름: `OptListing Web Client`
5. **승인된 JavaScript 원본**:
   ```
   https://hjbmoncohuuwnywrpwpi.supabase.co
   https://optlisting.com
   http://localhost:5173
   ```
6. **승인된 리디렉션 URI**:
   ```
   https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback
   ```
7. **만들기** 클릭
8. ⚠️ **클라이언트 ID**와 **클라이언트 보안 비밀번호** 복사해서 저장!

---

## 📋 Step 2: Supabase 설정

### 2.1 Google Provider 활성화
1. [Supabase Dashboard](https://supabase.com/dashboard/project/hjbmoncohuuwnywrpwpi) 접속
2. **Authentication** → **Providers**
3. **Google** 찾아서 클릭
4. **Enable Google** 토글 켜기
5. 입력:
   - **Client ID**: Google Cloud에서 복사한 클라이언트 ID
   - **Client Secret**: Google Cloud에서 복사한 보안 비밀번호
6. **Save** 클릭

### 2.2 Redirect URLs 확인
1. **Authentication** → **URL Configuration**
2. **Site URL**: `https://optlisting.com`
3. **Redirect URLs** 추가:
   ```
   https://optlisting.com/**
   http://localhost:5173/**
   ```

---

## 📋 Step 3: Vercel 환경 변수 설정

Vercel Dashboard → OptListing 프로젝트 → Settings → Environment Variables

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://hjbmoncohuuwnywrpwpi.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon` key |

### anon key 찾는 법:
1. Supabase Dashboard
2. **Settings** → **API**
3. **Project API keys** 섹션
4. `anon` `public` 키 복사

---

## 📋 Step 4: 테스트

### 로컬 테스트
```bash
cd frontend
npm run dev
```
1. http://localhost:5173 접속
2. **Sign In** 클릭
3. **Continue with Google** 클릭
4. Google 계정 선택
5. 대시보드로 리다이렉트 확인

### 프로덕션 테스트
1. https://optlisting.com 접속
2. **Sign In** 클릭
3. Google 로그인 테스트

---

## ⚠️ 트러블슈팅

### "redirect_uri_mismatch" 에러
- Google Cloud Console에서 **승인된 리디렉션 URI**에 Supabase callback URL이 정확히 등록되어 있는지 확인
- URL: `https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback`

### "OAuth app not verified" 경고
- 개발 중에는 정상. 프로덕션 출시 전 Google 앱 인증 필요
- **테스트 사용자**에 본인 이메일 추가하면 경고 없이 테스트 가능

### 로그인 후 리다이렉트 안 됨
- Supabase **Site URL**이 `https://optlisting.com`인지 확인
- **Redirect URLs**에 `https://optlisting.com/**` 있는지 확인

### CORS 에러
- Vercel 환경 변수가 정확한지 확인
- `VITE_` 접두사 필수

---

## ✅ 체크리스트

- [ ] Google Cloud 프로젝트 생성
- [ ] OAuth 동의 화면 구성
- [ ] OAuth 클라이언트 ID 생성
- [ ] 리디렉션 URI 설정
- [ ] Supabase Google Provider 활성화
- [ ] Client ID/Secret 입력
- [ ] Supabase Site URL 설정
- [ ] Vercel 환경 변수 설정
- [ ] 로컬 테스트 완료
- [ ] 프로덕션 테스트 완료


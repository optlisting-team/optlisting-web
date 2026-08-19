# 🎯 OptListing 도메인 전환 완전 가이드
## Supabase 임시 도메인 → 공식 도메인 (optlisting.com)

---

## 📋 전환 체크리스트

### ✅ 1단계: Google Cloud Console - 도메인 정리

#### 1.1 승인된 도메인 순서 변경
1. **Google Cloud Console** 접속: https://console.cloud.google.com
2. **Google 인증 플랫폼** → **브랜딩** 메뉴로 이동
3. **승인된 도메인** 섹션에서:
   - **승인된 도메인 1**: `optlisting.com` (첫 번째로 이동)
   - **승인된 도메인 2**: `hjbmoncohuuwnywrpwpi.supabase.co` (두 번째로 이동)
4. **저장** 클릭

#### 1.2 OAuth 클라이언트 ID 설정 확인
1. **Google 인증 플랫폼** → **클라이언트** 메뉴로 이동
2. **OptListing Web** 클라이언트 클릭
3. **승인된 JavaScript 원본** 확인:
   ```
   https://optlisting.com
   https://www.optlisting.com
   https://hjbmoncohuuwnywrpwpi.supabase.co
   ```
4. **승인된 리디렉션 URI** 확인:
   ```
   https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback
   ```
   ⚠️ **중요**: Supabase는 여전히 OAuth 콜백을 처리하므로 이 URI는 유지해야 합니다.

#### 1.3 (선택사항) 테스트 완료 후 임시 도메인 제거
- 프로덕션 배포 후 모든 테스트가 완료되면:
- **승인된 도메인**에서 `hjbmoncohuuwnywrpwpi.supabase.co` 제거 가능
- **주의**: Supabase Redirect URI는 유지해야 함 (OAuth 콜백 처리용)

---

### ✅ 2단계: Supabase Dashboard - Redirect URI 및 Site URL 설정

#### 2.1 Site URL 변경
1. **Supabase Dashboard** 접속: https://supabase.com/dashboard/project/hjbmoncohuuwnywrpwpi
2. **Authentication** → **URL Configuration** 메뉴로 이동
3. **Site URL** 필드:
   - 현재: `https://hjbmoncohuuwnywrpwpi.supabase.co`
   - 변경: `https://optlisting.com`
4. **Redirect URLs** 확인 및 추가:
   ```
   https://optlisting.com/**
   https://optlisting.vercel.app/**
   http://localhost:5173/**
   ```
5. **Save** 클릭

#### 2.2 Google Provider 설정 확인
1. **Authentication** → **Providers** → **Google** 클릭
2. **Client ID**와 **Client Secret**이 올바르게 설정되어 있는지 확인
3. **Redirect URI** 확인:
   - Supabase가 자동으로 생성한 URI: `https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback`
   - ⚠️ **이 URI는 변경하지 마세요!** Supabase가 OAuth 콜백을 처리합니다.
4. **Save** 클릭

#### 2.3 Supabase Redirect URI 동작 방식 이해
- **Supabase는 OAuth 콜백을 처리하는 중간 서버 역할**을 합니다
- 사용자가 Google에서 로그인하면 → Supabase로 리디렉션 → Supabase가 다시 optlisting.com으로 리디렉션
- 따라서 Supabase의 Redirect URI (`https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback`)는 **반드시 유지**해야 합니다

---

### ✅ 3단계: 클라이언트 코드 확인 (이미 올바르게 설정됨)

#### 3.1 현재 코드 상태 확인
현재 코드는 이미 올바르게 설정되어 있습니다:

**frontend/src/contexts/AuthContext.jsx:**
```javascript
redirectTo: `${window.location.origin}/dashboard`
```
- ✅ 자동으로 현재 도메인(optlisting.com)을 사용합니다

**frontend/src/lib/supabase.js:**
```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
```
- ✅ 환경 변수에서 Supabase URL을 가져옵니다

#### 3.2 환경 변수 확인
**Vercel Environment Variables**에서 확인:
- `VITE_SUPABASE_URL`: `https://hjbmoncohuuwnywrpwpi.supabase.co` (변경 불필요)
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key (변경 불필요)

⚠️ **중요**: Supabase URL은 그대로 유지합니다. OAuth 콜백 처리를 위해 필요합니다.

---

### ✅ 4단계: DNS 및 SSL/TLS 확인

#### 4.1 DNS 설정 확인
1. 도메인 관리 패널 접속 (도메인 등록업체)
2. **A 레코드** 또는 **CNAME 레코드** 확인:
   - `optlisting.com` → Vercel IP 또는 CNAME
   - `www.optlisting.com` → Vercel IP 또는 CNAME

#### 4.2 Vercel 도메인 설정 확인
1. **Vercel Dashboard** → **OptListing 프로젝트** → **Settings** → **Domains**
2. `optlisting.com`이 추가되어 있는지 확인
3. SSL 인증서가 자동으로 발급되었는지 확인 (보통 자동)

#### 4.3 SSL 인증서 확인
1. 브라우저에서 `https://optlisting.com` 접속
2. 주소창의 자물쇠 아이콘 확인
3. "연결이 안전합니다" 또는 "Secure" 표시 확인

---

## 🔄 OAuth 플로우 이해

### 현재 플로우 (Supabase 사용 시)
```
1. 사용자가 optlisting.com에서 "Google 로그인" 클릭
   ↓
2. Google OAuth 화면 표시 (optlisting.com으로 표시됨)
   ↓
3. 사용자가 Google 계정 선택 및 승인
   ↓
4. Google이 Supabase로 리디렉션: 
   https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback
   ↓
5. Supabase가 인증 처리 후 optlisting.com으로 리디렉션:
   https://optlisting.com/dashboard
```

### 왜 Supabase Redirect URI를 유지해야 하는가?
- Supabase가 OAuth 콜백을 처리하는 **중간 서버** 역할
- Google → Supabase → OptListing 순서로 리디렉션
- 따라서 Supabase의 callback URI는 반드시 Google Cloud Console에 등록되어 있어야 함

---

## ✅ 최종 확인 사항

### Google Cloud Console
- [ ] 승인된 도메인 1: `optlisting.com`
- [ ] 승인된 도메인 2: `hjbmoncohuuwnywrpwpi.supabase.co` (Supabase 콜백용)
- [ ] 승인된 JavaScript 원본: `https://optlisting.com` 포함
- [ ] 승인된 리디렉션 URI: `https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback` 포함

### Supabase Dashboard
- [ ] Site URL: `https://optlisting.com`
- [ ] Redirect URLs: `https://optlisting.com/**` 포함
- [ ] Google Provider 활성화 및 Client ID/Secret 설정됨

### Vercel
- [ ] `optlisting.com` 도메인 연결됨
- [ ] SSL 인증서 발급됨
- [ ] 환경 변수 설정됨

### 테스트
- [ ] 브라우저 캐시 완전히 지우기
- [ ] 시크릿 모드에서 테스트
- [ ] Google 로그인 화면에 `optlisting.com` 표시 확인
- [ ] 로그인 후 `/dashboard`로 정상 리디렉션 확인

---

## 🚨 주의사항

1. **Supabase Redirect URI는 절대 변경하지 마세요**
   - `https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback`는 Google Cloud Console에 반드시 등록되어 있어야 합니다

2. **변경사항 적용 시간**
   - Google Cloud Console: 즉시 반영 (캐시 지우기 필요)
   - Supabase: 몇 분 소요될 수 있음

3. **테스트 완료 전에는 임시 도메인 제거하지 마세요**
   - 모든 테스트가 완료된 후에만 `hjbmoncohuuwnywrpwpi.supabase.co`를 승인된 도메인에서 제거하세요

---

## 📝 요약

1. ✅ **Google Cloud Console**: 승인된 도메인 순서 변경 (optlisting.com을 첫 번째로)
2. ✅ **Supabase Dashboard**: Site URL을 optlisting.com으로 변경
3. ✅ **코드**: 이미 올바르게 설정됨 (변경 불필요)
4. ✅ **DNS/SSL**: 확인 및 테스트

이제 Google 로그인 화면에 `optlisting.com`이 표시됩니다! 🎉


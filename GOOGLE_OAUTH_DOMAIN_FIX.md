# Google 로그인 화면 도메인 변경 완전 가이드

## 🔴 문제
Google 로그인 화면에 "hjbmoncohuuwnywrpwpi.supabase.co(으)로 이동"이 표시됨

## ✅ 해결 방법 (3단계 모두 필요!)

### ⚠️ 중요: Google 로그인 화면의 도메인은 Google Cloud Console에서 설정됩니다!

---

## 1단계: Google Cloud Console - OAuth 동의 화면 설정

### 1. Google Cloud Console 접속
1. https://console.cloud.google.com/ 접속
2. OptListing 프로젝트 선택

### 2. OAuth 동의 화면 수정
1. **API 및 서비스** → **OAuth 동의 화면** 메뉴로 이동
2. **앱 정보** 섹션 확인:
   - **앱 이름**: `OptListing` (또는 원하는 이름)
   - **사용자 지원 이메일**: 본인 이메일
   - **앱 로고**: (선택사항) 업로드
   - **앱 도메인**: `optlisting.com` ⚠️ **이게 중요!**
   - **개발자 연락처 정보**: 이메일

3. **승인된 도메인** 섹션:
   - `+` 버튼 클릭
   - `optlisting.com` 추가
   - `www.optlisting.com` 추가 (필요한 경우)
   - **저장**

### 3. OAuth 클라이언트 ID 확인
1. **사용자 인증 정보** 탭으로 이동
2. OAuth 클라이언트 ID 확인:
   - **승인된 JavaScript 원본**에 `https://optlisting.com` 포함되어 있는지 확인
   - **승인된 리디렉션 URI**에 Supabase callback URL 포함되어 있는지 확인:
     ```
     https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback
     ```

---

## 2단계: Supabase Dashboard 설정

### 1. Site URL 확인
1. https://supabase.com/dashboard/project/hjbmoncohuuwnywrpwpi 접속
2. **Authentication** → **URL Configuration**
3. **Site URL**: `https://optlisting.com`으로 설정
4. **Redirect URLs** 확인:
   ```
   https://optlisting.com/**
   https://optlisting.vercel.app/**
   http://localhost:5173/**
   ```
5. **Save** 클릭

### 2. Google Provider 설정 확인
1. **Authentication** → **Providers** → **Google**
2. **Client ID**와 **Client Secret**이 올바르게 설정되어 있는지 확인
3. **Save** 클릭

---

## 3단계: 브라우저 캐시 및 테스트

### 1. 완전한 캐시 지우기
1. **Chrome/Edge**: `Ctrl + Shift + Delete`
2. **시간 범위**: "전체 기간" 선택
3. **쿠키 및 기타 사이트 데이터** 체크
4. **캡처된 이미지 및 파일** 체크
5. **데이터 삭제** 클릭

### 2. 시크릿 모드에서 테스트
1. **시크릿 창 열기**: `Ctrl + Shift + N` (Chrome) 또는 `Ctrl + Shift + P` (Edge)
2. https://optlisting.com 접속
3. 로그인 시도
4. Google 로그인 화면에서 도메인 확인

### 3. Google 계정에서 앱 권한 제거 (필요한 경우)
1. https://myaccount.google.com/permissions 접속
2. "OptListing" 또는 관련 앱 찾기
3. **제거** 클릭
4. 다시 로그인 시도

---

## 🔍 확인 사항

### Google Cloud Console에서 확인:
- [ ] OAuth 동의 화면 → 앱 도메인: `optlisting.com`
- [ ] 승인된 도메인에 `optlisting.com` 추가됨
- [ ] OAuth 클라이언트 ID → 승인된 JavaScript 원본에 `https://optlisting.com` 포함

### Supabase Dashboard에서 확인:
- [ ] Site URL: `https://optlisting.com`
- [ ] Redirect URLs에 `https://optlisting.com/**` 포함
- [ ] Google Provider 활성화 및 Client ID/Secret 설정됨

---

## ⚠️ 주의사항

1. **변경 사항 반영 시간**
   - Google Cloud Console 변경: 즉시 반영 (캐시 지우기 필요)
   - Supabase 변경: 몇 분 소요될 수 있음

2. **도메인 검증 필요**
   - Google에서 도메인 소유권을 확인할 수 있습니다
   - Google Search Console에서 도메인을 확인하면 더 빠르게 반영됩니다

3. **테스트 사용자**
   - 개발 중에는 Google Cloud Console에서 테스트 사용자 이메일을 추가하면 경고 없이 사용 가능합니다

---

## 🚨 여전히 안 되면?

### 추가 확인:
1. **Google Cloud Console** → **OAuth 동의 화면** → **앱 도메인**이 정확히 `optlisting.com`인지 확인 (공백 없이)
2. **승인된 도메인**에 `optlisting.com`이 추가되어 있는지 확인
3. **브라우저 완전히 종료 후 재시작**
4. **다른 브라우저에서 테스트** (Chrome, Edge, Firefox)

### 최종 확인:
Google 로그인 화면에서 표시되는 도메인은 **Google Cloud Console의 OAuth 동의 화면 → 앱 도메인** 설정에 의해 결정됩니다. Supabase Site URL은 리디렉션에만 영향을 줍니다.

---

## ✅ 성공 확인

로그인 화면에서 다음이 표시되면 성공:
- ✅ "optlisting.com(으)로 이동" (또는 설정한 도메인)
- ❌ "hjbmoncohuuwnywrpwpi.supabase.co(으)로 이동" (더 이상 표시되지 않음)


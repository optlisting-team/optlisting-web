# 🔴 Google 로그인 화면 도메인 변경 최종 해결 방법

## 문제
Google 로그인 화면에 계속 `hjbmoncohuuwnywrpwpi.supabase.co`가 표시됨

## ✅ 확실한 해결 방법

### ⚠️ 중요: Google OAuth 동의 화면의 "앱 도메인" 설정이 핵심입니다!

---

## 1단계: Google Cloud Console - OAuth 동의 화면 직접 수정

### 방법 1: 직접 URL로 접근
1. 브라우저 주소창에 다음 입력:
   ```
   https://console.cloud.google.com/apis/credentials/consent/edit?project=optlisting
   ```
2. Enter 키 누르기

### 방법 2: 검색으로 찾기
1. Google Cloud Console 상단 검색창 클릭
2. "OAuth consent screen edit" 입력
3. 검색 결과에서 선택

---

## 2단계: OAuth 동의 화면에서 설정

### 1. 앱 정보 섹션
1. **앱 도메인** 필드 찾기
2. **반드시** `optlisting.com` 입력 (www 없이)
3. **저장** 클릭

### 2. 승인된 도메인 섹션
1. **승인된 도메인** 섹션 찾기
2. 도메인 목록 확인:
   - `optlisting.com`이 **첫 번째**에 있는지 확인
   - `hjbmoncohuuwnywrpwpi.supabase.co`는 두 번째로
3. 순서가 다르면:
   - `hjbmoncohuuwnywrpwpi.supabase.co` 삭제
   - `optlisting.com`을 첫 번째로 추가
   - `hjbmoncohuuwnywrpwpi.supabase.co`를 두 번째로 다시 추가
4. **저장** 클릭

### 3. 게시 상태 확인
1. 페이지 상단 또는 하단에 **"게시 상태"** 또는 **"Publishing status"** 확인
2. **"테스트 중"** 또는 **"In testing"** 상태인지 확인
3. 필요시 **"앱 게시"** 또는 **"Publish app"** 클릭

---

## 3단계: Google Cloud Console - 클라이언트 설정

### 1. OAuth 클라이언트 ID 확인
1. **Google 인증 플랫폼** → **클라이언트** 메뉴
2. **OptListing Web** 클라이언트 클릭
3. **승인된 JavaScript 원본** 확인:
   - `https://optlisting.com`이 **첫 번째**에 있는지 확인
   - 순서가 다르면 순서 변경
4. **저장** 클릭

---

## 4단계: 완전한 캐시 지우기 및 재시도

### 1. Google 계정에서 완전히 로그아웃
1. https://myaccount.google.com 접속
2. **보안** → **내 기기** 또는 **활동**
3. **모든 기기에서 로그아웃** 클릭

### 2. 브라우저 완전히 종료
1. 모든 브라우저 창 닫기
2. 작업 관리자에서 브라우저 프로세스 완전히 종료

### 3. 브라우저 캐시 완전히 지우기
1. 브라우저 재시작
2. `Ctrl + Shift + Delete`
3. **시간 범위**: "전체 기간"
4. **모든 항목** 체크:
   - 쿠키 및 기타 사이트 데이터
   - 캐시된 이미지 및 파일
   - 자동 완성 양식 데이터
   - 암호
5. **데이터 삭제** 클릭

### 4. 시크릿 모드에서 테스트
1. `Ctrl + Shift + N` (Chrome) 또는 `Ctrl + Shift + P` (Edge)
2. https://optlisting.com 접속
3. 로그인 시도

---

## 5단계: Google Search Console에서 도메인 확인 (선택사항)

### 도메인 소유권 확인
1. https://search.google.com/search-console 접속
2. **속성 추가** → **도메인** 선택
3. `optlisting.com` 입력
4. DNS 레코드 추가하여 소유권 확인
5. 확인 완료 후 Google Cloud Console에서 도메인 인식 개선

---

## 🔍 추가 확인 사항

### Google Cloud Console에서 확인할 것들:

1. **OAuth 동의 화면**:
   - [ ] 앱 도메인: `optlisting.com`
   - [ ] 승인된 도메인 1: `optlisting.com`
   - [ ] 게시 상태: "테스트 중" 또는 "게시됨"

2. **OAuth 클라이언트**:
   - [ ] 승인된 JavaScript 원본 1: `https://optlisting.com`
   - [ ] 승인된 리디렉션 URI: `https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback`

3. **Supabase**:
   - [ ] Site URL: `https://optlisting.com`
   - [ ] Redirect URLs: `https://optlisting.com/**`

---

## 🚨 여전히 안 되면?

### 최후의 수단: 새 OAuth 클라이언트 ID 생성

1. **Google Cloud Console** → **클라이언트**
2. 기존 클라이언트 삭제 (또는 비활성화)
3. **새 클라이언트 ID 생성**:
   - 이름: `OptListing Web v2`
   - 승인된 JavaScript 원본: `https://optlisting.com` (첫 번째)
   - 승인된 리디렉션 URI: `https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback`
4. **Supabase**에서 새 Client ID와 Secret 업데이트
5. 다시 테스트

---

## ⏰ 시간이 필요한 경우

Google의 변경사항 적용에는 시간이 걸릴 수 있습니다:
- **최소**: 5분
- **일반**: 1-2시간
- **최대**: 24시간

설정을 변경한 후 몇 시간 기다렸다가 다시 시도해보세요.

---

## ✅ 성공 확인

로그인 화면에서 다음이 표시되면 성공:
- ✅ "optlisting.com(으)로 이동"
- ❌ "hjbmoncohuuwnywrpwpi.supabase.co(으)로 이동" (더 이상 표시되지 않음)


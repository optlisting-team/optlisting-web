# 🚨 Google 로그인 화면 도메인 변경 - 긴급 해결 방법

## 문제
Google 로그인 화면에 계속 `hjbmoncohuuwnywrpwpi.supabase.co`가 표시됨

---

## ✅ 확실한 해결 방법 (단계별)

### ⚠️ 핵심: OAuth 동의 화면의 "앱 도메인" 필드가 가장 중요합니다!

---

## 1단계: OAuth 동의 화면 직접 접근

### 방법 1: 직접 URL (가장 확실)
브라우저 주소창에 다음을 입력:
```
https://console.cloud.google.com/apis/credentials/consent/edit?project=optlisting
```

### 방법 2: 프로젝트 ID 확인 후
1. Google Cloud Console 상단에서 프로젝트 ID 확인
2. 주소창에 입력 (PROJECT_ID를 실제 프로젝트 ID로 교체):
```
https://console.cloud.google.com/apis/credentials/consent/edit?project=PROJECT_ID
```

---

## 2단계: OAuth 동의 화면에서 필수 설정

### 🔴 가장 중요: 앱 도메인 설정
1. 페이지에서 **"앱 도메인"** 또는 **"App domain"** 필드 찾기
2. **반드시** `optlisting.com` 입력 (www 없이, https 없이)
3. **저장** 클릭

### 승인된 도메인 순서 변경
1. **승인된 도메인** 섹션 찾기
2. 현재 상태 확인:
   - 도메인 1: `hjbmoncohuuwnywrpwpi.supabase.co`
   - 도메인 2: `optlisting.com`
3. **순서 변경**:
   - `hjbmoncohuuwnywrpwpi.supabase.co` 삭제 (X 버튼 클릭)
   - `optlisting.com`이 첫 번째인지 확인
   - 필요시 `hjbmoncohuuwnywrpwpi.supabase.co`를 두 번째로 다시 추가
4. **저장** 클릭

### 게시 상태 확인
1. 페이지 상단 또는 하단에 **"게시 상태"** 확인
2. **"테스트 중"** 또는 **"In testing"** 상태인지 확인
3. 필요시 **"앱 게시"** 또는 **"Publish app"** 클릭

---

## 3단계: OAuth 클라이언트 설정 확인

### 승인된 JavaScript 원본 순서
1. **Google 인증 플랫폼** → **클라이언트** → **OptListing Web** 클릭
2. **승인된 JavaScript 원본** 섹션 확인
3. 순서 확인:
   - 첫 번째: `https://optlisting.com`
   - 두 번째: `https://hjbmoncohuuwnywrpwpi.supabase.co`
4. 순서가 다르면:
   - `hjbmoncohuuwnywrpwpi.supabase.co` 삭제
   - `https://optlisting.com`을 첫 번째로 추가
   - `https://hjbmoncohuuwnywrpwpi.supabase.co`를 두 번째로 추가
5. **저장** 클릭

---

## 4단계: 완전한 초기화 및 재시도

### 1. Google 계정에서 완전히 로그아웃
1. https://myaccount.google.com 접속
2. **보안** 메뉴
3. **모든 기기에서 로그아웃** 클릭

### 2. 브라우저 완전히 종료
1. 모든 브라우저 창 닫기
2. 작업 관리자 (`Ctrl + Shift + Esc`)에서 브라우저 프로세스 종료

### 3. 브라우저 캐시 완전히 지우기
1. 브라우저 재시작
2. `Ctrl + Shift + Delete`
3. **시간 범위**: "전체 기간"
4. **모든 항목** 체크
5. **데이터 삭제**

### 4. 시크릿 모드에서 테스트
1. `Ctrl + Shift + N` (Chrome)
2. https://optlisting.com 접속
3. 로그인 시도

---

## 5단계: 최후의 수단 - 새 OAuth 클라이언트 생성

### 기존 클라이언트가 문제일 수 있습니다

1. **Google Cloud Console** → **클라이언트**
2. 기존 **OptListing Web** 클라이언트 확인
3. **새 클라이언트 ID 생성**:
   - 이름: `OptListing Web Production`
   - 승인된 JavaScript 원본:
     ```
     https://optlisting.com
     https://www.optlisting.com
     https://hjbmoncohuuwnywrpwpi.supabase.co
     ```
   - 승인된 리디렉션 URI:
     ```
     https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback
     ```
4. **새 Client ID와 Secret 복사**
5. **Supabase** → **Authentication** → **Providers** → **Google**
6. 새 Client ID와 Secret으로 업데이트
7. **Save** 클릭
8. 다시 테스트

---

## 🔍 확인 체크리스트

### Google Cloud Console - OAuth 동의 화면
- [ ] **앱 도메인**: `optlisting.com` (www 없이)
- [ ] **승인된 도메인 1**: `optlisting.com` (첫 번째)
- [ ] **승인된 도메인 2**: `hjbmoncohuuwnywrpwpi.supabase.co` (두 번째)
- [ ] **게시 상태**: "테스트 중" 또는 "게시됨"

### Google Cloud Console - OAuth 클라이언트
- [ ] **승인된 JavaScript 원본 1**: `https://optlisting.com` (첫 번째)
- [ ] **승인된 리디렉션 URI**: `https://hjbmoncohuuwnywrpwpi.supabase.co/auth/v1/callback` 포함

### Supabase
- [ ] **Site URL**: `https://optlisting.com`
- [ ] **Redirect URLs**: `https://optlisting.com/**` 포함

---

## ⏰ 시간이 필요한 경우

Google의 변경사항 적용에는 시간이 걸릴 수 있습니다:
- **최소**: 5-10분
- **일반**: 1-2시간
- **최대**: 24시간

**설정을 변경한 후 최소 10분 이상 기다렸다가 다시 시도하세요.**

---

## 🚨 여전히 안 되면?

### 추가 확인 사항:
1. **프로젝트 선택 확인**: Google Cloud Console 상단에서 올바른 프로젝트가 선택되어 있는지 확인
2. **권한 확인**: 프로젝트 편집 권한이 있는지 확인
3. **다른 브라우저 테스트**: Chrome, Edge, Firefox 등에서 테스트
4. **모바일에서 테스트**: 스마트폰 브라우저에서 테스트

---

## ✅ 성공 확인

로그인 화면에서 다음이 표시되면 성공:
- ✅ "optlisting.com(으)로 이동"
- ❌ "hjbmoncohuuwnywrpwpi.supabase.co(으)로 이동" (더 이상 표시되지 않음)


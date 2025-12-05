# Google OAuth 도메인 설정 가이드

Google 로그인 시 서비스가 공식 도메인(예: `optlisting.com`)으로 표시되도록 설정하는 방법입니다.

## 1단계: Google Cloud Console 설정

### 1. Google Cloud Console 접속

1. https://console.cloud.google.com/ 접속
2. 프로젝트 선택 또는 새 프로젝트 생성

### 2. OAuth 동의 화면 구성

1. **API 및 서비스** > **OAuth 동의 화면** 메뉴로 이동
2. **외부** 사용자 유형 선택 (일반 사용자용)
3. **앱 정보** 입력:
   - **앱 이름**: `OptListing` (또는 원하는 서비스 이름)
   - **사용자 지원 이메일**: `dev@optlisting.com` (또는 지원 이메일)
   - **앱 로고**: (선택사항) 서비스 로고 업로드
   - **앱 도메인**: `optlisting.com` (공식 도메인)
   - **개발자 연락처 정보**: 이메일 주소

4. **승인된 도메인** 추가:
   - **승인된 도메인** 섹션에서 `+` 버튼 클릭
   - `optlisting.com` 추가
   - `www.optlisting.com` 추가 (필요한 경우)

5. **저장 후 계속** 클릭

### 3. 범위(Scopes) 설정

1. **범위** 탭에서:
   - 기본 범위는 유지 (이메일, 프로필, OpenID)
   - 필요시 추가 범위 추가

2. **저장 후 계속** 클릭

### 4. 테스트 사용자 추가 (선택사항)

- 개발 중에는 테스트 사용자 이메일 추가 가능
- 프로덕션에서는 Google 검토 필요

### 5. OAuth 2.0 클라이언트 ID 생성

1. **사용자 인증 정보** 탭으로 이동
2. **+ 사용자 인증 정보 만들기** > **OAuth 클라이언트 ID** 선택
3. **애플리케이션 유형**: `웹 애플리케이션` 선택
4. **이름**: `OptListing Web Client` (또는 원하는 이름)
5. **승인된 자바스크립트 원본** 추가:
   ```
   https://optlisting.com
   https://www.optlisting.com
   https://your-supabase-project.supabase.co
   ```
6. **승인된 리디렉션 URI** 추가:
   ```
   https://your-supabase-project.supabase.co/auth/v1/callback
   ```
   - Supabase 프로젝트 URL은 Supabase Dashboard > Settings > API에서 확인 가능

7. **만들기** 클릭
8. **클라이언트 ID**와 **클라이언트 보안 비밀번호** 복사 (나중에 Supabase에 입력)

## 2단계: Supabase 설정

### 1. Supabase Dashboard 접속

1. https://supabase.com/dashboard 접속
2. OptListing 프로젝트 선택

### 2. Google Provider 설정

1. **Authentication** > **Providers** 메뉴로 이동
2. **Google** Provider 찾기
3. **Enable Google provider** 토글 활성화
4. 다음 정보 입력:
   - **Client ID (for OAuth)**: Google Cloud Console에서 복사한 클라이언트 ID
   - **Client Secret (for OAuth)**: Google Cloud Console에서 복사한 클라이언트 보안 비밀번호

5. **Save** 클릭

### 3. Redirect URL 확인

Supabase가 자동으로 생성한 Redirect URL:
```
https://your-supabase-project.supabase.co/auth/v1/callback
```

이 URL이 Google Cloud Console의 **승인된 리디렉션 URI**에 추가되어 있는지 확인하세요.

## 3단계: 프론트엔드 설정 (선택사항)

현재 코드는 이미 올바르게 설정되어 있습니다:

```javascript
// frontend/src/contexts/AuthContext.jsx
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
}
```

## 확인 사항

### Google 로그인 화면에서 확인

1. 앱에서 Google 로그인 클릭
2. Google 로그인 화면에서 다음이 표시되는지 확인:
   - **서비스 이름**: `optlisting.com 서비스로 로그인` (또는 설정한 이름)
   - **도메인**: `optlisting.com`

### 문제 해결

#### 1. 도메인이 표시되지 않는 경우

- Google Cloud Console > OAuth 동의 화면에서 **승인된 도메인** 확인
- 도메인이 정확히 입력되었는지 확인 (예: `optlisting.com`, `www.optlisting.com`)

#### 2. "앱이 Google에서 확인되지 않음" 경고

- OAuth 동의 화면에서 **앱 검증** 완료 필요
- Google 검토 제출 (프로덕션 사용 시)

#### 3. 리디렉션 오류

- Google Cloud Console의 **승인된 리디렉션 URI**에 Supabase URL이 정확히 추가되었는지 확인
- Supabase 프로젝트 URL 확인

## 추가 참고사항

### 개발 환경 vs 프로덕션 환경

- **개발 환경**: 테스트 사용자 추가하여 즉시 사용 가능
- **프로덕션 환경**: Google 검토 제출 필요 (보통 1-2주 소요)

### 보안 고려사항

- 클라이언트 Secret은 절대 프론트엔드 코드에 노출하지 마세요
- Supabase Dashboard에서만 관리하세요
- 환경 변수로 관리하지 마세요 (Supabase가 자동 관리)

## 완료!

이제 Google 로그인 시 `optlisting.com` 도메인으로 서비스가 표시됩니다! 🎉


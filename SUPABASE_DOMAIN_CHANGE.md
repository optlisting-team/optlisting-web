# Google 로그인 화면 도메인 변경 가이드

## 🎯 문제
Google 로그인 화면에서 "hjbmoncohuuwnywrpwpi.supabase.co(으)로 이동"이라는 Supabase 도메인이 표시됨

## ✅ 해결 방법

Google 로그인 화면에 표시되는 도메인은 **Supabase Dashboard의 Site URL 설정**에 의해 결정됩니다.

### Step 1: Supabase Dashboard 접속
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택: `hjbmoncohuuwnywrpwpi`

### Step 2: Site URL 변경
1. **Authentication** → **URL Configuration** 메뉴로 이동
2. **Site URL** 필드 찾기
3. 현재 값: `https://hjbmoncohuuwnywrpwpi.supabase.co`
4. 변경할 값: `https://optlisting.com` (또는 원하는 도메인)
5. **Save** 클릭

### Step 3: Redirect URLs 확인
**Redirect URLs** 섹션에 다음 URL들이 포함되어 있는지 확인:
```
https://optlisting.com/**
https://optlisting.vercel.app/**
http://localhost:5173/**
```

### Step 4: Google Cloud Console 확인 (선택사항)
Google Cloud Console에서도 도메인을 확인할 수 있습니다:
1. https://console.cloud.google.com 접속
2. **API 및 서비스** → **OAuth 동의 화면**
3. **승인된 JavaScript 원본**에 `https://optlisting.com` 추가되어 있는지 확인

## ⚠️ 주의사항

1. **Site URL 변경 후 즉시 반영되지 않을 수 있음**
   - 변경 후 몇 분 정도 기다려야 할 수 있습니다
   - 브라우저 캐시를 지우고 다시 시도해보세요

2. **프로덕션 도메인 사용 권장**
   - `https://optlisting.com` 같은 실제 도메인 사용
   - Supabase 도메인은 개발/테스트용으로만 사용

3. **Redirect URLs 필수**
   - Site URL을 변경해도 Redirect URLs는 반드시 설정되어 있어야 합니다
   - 그렇지 않으면 로그인 후 리다이렉트가 실패할 수 있습니다

## 🔍 확인 방법

1. 브라우저에서 로그아웃
2. 다시 로그인 시도
3. Google 로그인 화면에서 도메인이 변경되었는지 확인
   - 변경 전: "hjbmoncohuuwnywrpwpi.supabase.co(으)로 이동"
   - 변경 후: "optlisting.com(으)로 이동"

## 📝 추가 설정 (선택사항)

### 커스텀 브랜딩
Supabase Dashboard에서 추가 설정 가능:
- **Authentication** → **Settings**
- **Custom SMTP** (이메일 템플릿 커스터마이징)
- **Email Templates** (로그인 이메일 등)

---

## ✅ 체크리스트

- [ ] Supabase Dashboard 접속
- [ ] Authentication → URL Configuration 이동
- [ ] Site URL을 `https://optlisting.com`으로 변경
- [ ] Redirect URLs 확인 및 추가
- [ ] Save 클릭
- [ ] 브라우저 캐시 지우기
- [ ] 로그인 테스트
- [ ] Google 로그인 화면에서 도메인 확인


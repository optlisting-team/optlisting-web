# Test Credits Button 배포 검증 체크리스트

## 문제 진단

VITE_ENABLE_TEST_CREDITS 플래그가 배포 환경에서 작동하지 않는 경우 다음을 확인합니다.

## 1. 빌드 산출물 확인

### 로컬 빌드 확인
```bash
cd frontend
npm run build

# 빌드된 JS 파일에서 문자열 검색
# Windows PowerShell:
Get-Content dist/assets/*.js | Select-String "VITE_ENABLE_TEST_CREDITS" | Select-Object -First 5

# 또는 grep (Git Bash/WSL):
grep -r "VITE_ENABLE_TEST_CREDITS" dist/
```

**확인 사항:**
- [ ] `VITE_ENABLE_TEST_CREDITS` 문자열이 빌드 산출물에 존재하는가?
- [ ] 값이 `'true'`인지 확인 (빌드 시점의 값이 포함됨)
- [ ] 문자열이 없으면: 환경변수가 빌드 시점에 주입되지 않은 것

### 배포 환경 빌드 확인
1. Railway/Vercel에서 빌드 로그 확인
2. 빌드 로그에서 환경변수 주입 여부 확인
3. 배포된 사이트에서 브라우저 개발자 도구 → Network → JS 파일 다운로드
4. 다운로드한 JS 파일에서 `VITE_ENABLE_TEST_CREDITS` 검색

## 2. 버튼 렌더링 위치 확인

### 컴포넌트 위치

**버튼이 렌더링되는 위치:**

1. **Sidebar.jsx (크레딧 모달)**
   - 파일: `frontend/src/components/Sidebar.jsx`
   - 위치: 450-534줄 (크레딧 모달 내부)
   - 조건: `import.meta.env.VITE_ENABLE_TEST_CREDITS === 'true'`
   - 접근: 우측 상단 "MY CREDITS" 버튼 클릭 → 크레딧 모달 열림

2. **Dashboard.jsx**
   - 파일: `frontend/src/components/Dashboard.jsx`
   - 위치: 1538줄 근처
   - 조건: `import.meta.env.VITE_ENABLE_TEST_CREDITS === 'true'`
   - 접근: Dashboard 페이지에서 FilterBar 아래

3. **Settings.jsx**
   - 파일: `frontend/src/components/Settings.jsx`
   - 위치: 329줄 근처 (Credits Card 섹션)
   - 조건: `import.meta.env.VITE_ENABLE_TEST_CREDITS === 'true'`
   - 접근: Settings 페이지 → Credits Card 섹션

### 버튼 라벨
- "🧪 Grant Test Credits (+1000)" (Sidebar 모달)
- "🧪 Grant Test Credits +1000" (Dashboard)
- "🧪 Grant Test Credits (+1000)" (Settings)

## 3. 환경변수 설정 검증 체크리스트

### 로컬 개발 환경 (.env.local)

**파일 위치:** `frontend/.env.local`

**설정:**
```bash
VITE_ENABLE_TEST_CREDITS=true
VITE_ADMIN_API_KEY=your-admin-api-key-here
```

**검증 단계:**
1. [ ] `.env.local` 파일이 `frontend/` 디렉토리에 존재하는가?
2. [ ] `VITE_ENABLE_TEST_CREDITS=true` (문자열 `'true'`)로 설정되어 있는가?
3. [ ] 개발 서버를 중지하고 재시작했는가? (`npm run dev`)
4. [ ] 브라우저에서 개발자 도구 → Console에서 `import.meta.env.VITE_ENABLE_TEST_CREDITS` 확인
5. [ ] 우측 상단 "MY CREDITS" 클릭 → 크레딧 모달에서 버튼이 보이는가?
6. [ ] Dashboard 페이지에서 버튼이 보이는가?
7. [ ] Settings 페이지에서 버튼이 보이는가?

**중요:**
- Vite는 **빌드 시점**에 환경변수를 주입합니다
- 개발 모드(`npm run dev`)에서는 서버 재시작 필요
- 프로덕션 빌드(`npm run build`)는 환경변수 변경 시 재빌드 필요

### Railway 프론트엔드 서비스 (Production)

**설정 위치:** Railway 대시보드 → 프론트엔드 서비스 → Variables 탭

**설정:**
- **Key**: `VITE_ENABLE_TEST_CREDITS`
- **Value**: `true` (문자열, 따옴표 없이)
- **Key**: `VITE_ADMIN_API_KEY` (선택사항)
- **Value**: 백엔드 `ADMIN_API_KEY`와 동일한 값

**검증 단계:**
1. [ ] Railway 대시보드 → 프론트엔드 서비스 선택
2. [ ] Variables 탭에서 `VITE_ENABLE_TEST_CREDITS` 변수가 존재하는가?
3. [ ] 값이 정확히 `true`인가? (문자열, 따옴표 없이)
4. [ ] 변수를 추가/수정한 후 **반드시 재배포**를 트리거했는가?
5. [ ] Railway 빌드 로그에서 환경변수가 주입되었는지 확인
6. [ ] 배포 완료 후 브라우저에서 사이트 접속
7. [ ] 브라우저 개발자 도구 → Network → JS 파일 다운로드 → `VITE_ENABLE_TEST_CREDITS` 검색
8. [ ] 배포된 사이트에서 "MY CREDITS" 클릭 → 버튼이 보이는가?

**중요:**
- Railway에서 환경변수를 변경한 후 **반드시 재배포 필요**
- 환경변수 변경만으로는 적용되지 않음 (빌드 시점 주입)
- 배포 로그에서 환경변수 확인 가능

### Vercel (Production)

**설정 위치:** Vercel 프로젝트 → Settings → Environment Variables

**설정:**
- **Key**: `VITE_ENABLE_TEST_CREDITS`
- **Value**: `true`
- **Environments**: Production, Preview, Development 선택
- **Key**: `VITE_ADMIN_API_KEY` (선택사항)

**검증 단계:**
1. [ ] Vercel 프로젝트 → Settings → Environment Variables
2. [ ] `VITE_ENABLE_TEST_CREDITS` 변수가 존재하는가?
3. [ ] 값이 `true`인가?
4. [ ] Production 환경에 포함되어 있는가?
5. [ ] 변수를 추가/수정한 후 **Redeploy** 실행했는가?
6. [ ] 빌드 로그에서 환경변수 확인
7. [ ] 배포 완료 후 사이트 접속하여 버튼 확인

## 4. 디버깅 방법

### 개발 모드에서 환경변수 확인

코드에 추가된 디버깅 로그:
```javascript
// 개발 모드에서만 출력
if (import.meta.env.DEV) {
  console.log('[DEBUG] VITE_ENABLE_TEST_CREDITS:', import.meta.env.VITE_ENABLE_TEST_CREDITS)
  console.log('[DEBUG] import.meta.env:', import.meta.env)
}
```

**확인 방법:**
1. 개발 서버 실행 (`npm run dev`)
2. 브라우저 개발자 도구 → Console
3. `[DEBUG] VITE_ENABLE_TEST_CREDITS:` 로그 확인
4. 값이 `'true'`인지 확인

### 프로덕션 모드에서 확인

프로덕션 빌드에서는 디버그 로그가 출력되지 않습니다.

**확인 방법:**
1. 브라우저 개발자 도구 → Console
2. 수동으로 확인: `import.meta.env.VITE_ENABLE_TEST_CREDITS` 입력
3. 또는 Network 탭 → JS 파일 다운로드 → 텍스트 검색

## 5. 문제 해결

### 문제: 버튼이 보이지 않음

**가능한 원인:**
1. 환경변수가 설정되지 않음
2. 환경변수 값이 `'true'`가 아님 (예: `True`, `TRUE`, `1`)
3. 재빌드/재배포를 하지 않음
4. 프론트엔드 서비스가 아닌 백엔드 서비스에 변수 설정
5. 빌드 시점에 환경변수가 주입되지 않음

**해결:**
1. 환경변수 확인 (`VITE_ENABLE_TEST_CREDITS=true`)
2. 값이 정확히 문자열 `'true'`인지 확인
3. 변수 변경 후 **반드시 재빌드/재배포**
4. 빌드 로그에서 환경변수 확인
5. 배포된 JS 파일에서 문자열 검색

### 문제: 버튼이 보이지만 클릭 시 에러

**가능한 원인:**
1. `VITE_ADMIN_API_KEY`가 설정되지 않음
2. 백엔드 `ADMIN_API_KEY`와 불일치
3. 백엔드 엔드포인트 접근 불가

**해결:**
1. `VITE_ADMIN_API_KEY` 설정 확인
2. 백엔드 `ADMIN_API_KEY`와 일치하는지 확인
3. 브라우저 개발자 도구 → Network → 에러 메시지 확인

## 6. 체크리스트 요약

### 로컬 개발
- [ ] `.env.local` 파일 생성
- [ ] `VITE_ENABLE_TEST_CREDITS=true` 설정
- [ ] 개발 서버 재시작
- [ ] 브라우저 Console에서 값 확인
- [ ] 버튼이 3곳 모두에 보이는지 확인

### Railway 배포
- [ ] 프론트엔드 서비스 Variables에 `VITE_ENABLE_TEST_CREDITS=true` 설정
- [ ] 변수 변경 후 재배포 트리거
- [ ] 빌드 로그 확인
- [ ] 배포된 JS 파일에서 문자열 검색
- [ ] 배포된 사이트에서 버튼 확인

### Vercel 배포
- [ ] Environment Variables에 `VITE_ENABLE_TEST_CREDITS=true` 설정
- [ ] Production 환경에 포함
- [ ] Redeploy 실행
- [ ] 빌드 로그 확인
- [ ] 배포된 사이트에서 버튼 확인


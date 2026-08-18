# VITE_ENABLE_TEST_CREDITS 배포 가이드

## 문제 진단

배포 환경에서 테스트 크레딧 버튼이 보이지 않는 경우, **환경변수가 빌드 산출물에 주입되지 않았을 가능성**이 높습니다.

## 1. 빌드 산출물 확인

### 로컬 빌드로 확인

```bash
cd frontend
# 환경변수 없이 빌드 (기본값)
npm run build

# 빌드된 JS 파일에서 검색
# Windows PowerShell:
Get-ChildItem dist\assets\*.js | ForEach-Object { Select-String -Path $_.FullName -Pattern "VITE_ENABLE_TEST_CREDITS" }

# 결과:
# - 문자열이 없으면: 환경변수가 빌드에 주입되지 않음 (정상, 기본값 false)
# - 문자열이 있으면: 값 확인 (예: "VITE_ENABLE_TEST_CREDITS":"false")
```

### 환경변수와 함께 빌드 (테스트)

```bash
# Windows PowerShell:
$env:VITE_ENABLE_TEST_CREDITS="true"; npm run build

# 또는 .env.local 파일 생성:
# frontend/.env.local
# VITE_ENABLE_TEST_CREDITS=true

npm run build

# 다시 검색
Get-ChildItem dist\assets\*.js | ForEach-Object { Select-String -Path $_.FullName -Pattern "VITE_ENABLE_TEST_CREDITS" }

# 예상 결과:
# index-XXXXX.js: "VITE_ENABLE_TEST_CREDITS":"true"
```

## 2. 배포 환경별 설정

### Vercel (프론트엔드 배포)

**현재 프론트엔드가 Vercel에 배포되어 있다면:**

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard
   - `optlisting` 프로젝트 선택

2. **Settings → Environment Variables**
   - **Key**: `VITE_ENABLE_TEST_CREDITS`
   - **Value**: `true` (따옴표 없이)
   - **Environments**: 
     - ✅ Production
     - ✅ Preview  
     - ✅ Development

3. **변수 추가 후 반드시 Redeploy**
   - 프로젝트 페이지에서 "Redeploy" 버튼 클릭
   - 또는 Git push 후 자동 배포 대기

4. **빌드 로그 확인**
   - Deployment → Build Logs
   - 환경변수가 주입되었는지 확인

### Railway (프론트엔드 배포)

**만약 프론트엔드도 Railway에 배포되어 있다면:**

1. **Railway 대시보드 접속**
   - https://railway.app/dashboard
   - 프론트엔드 서비스 선택 (별도 서비스가 있는 경우)

2. **Variables 탭**
   - **Key**: `VITE_ENABLE_TEST_CREDITS`
   - **Value**: `true` (따옴표 없이)

3. **변수 추가 후 재배포**
   - Variables 저장 후 자동으로 재배포 트리거
   - 또는 수동으로 Redeploy 실행

4. **빌드 로그 확인**
   - Deployments → 최신 배포 → Logs
   - 환경변수 주입 여부 확인

## 3. 배포된 사이트에서 확인

### 브라우저 개발자 도구로 확인

1. **배포된 사이트 접속**
   - 예: `https://optlisting.com`

2. **개발자 도구 열기**
   - F12 또는 우클릭 → 검사

3. **Network 탭**
   - JS 파일 다운로드 (예: `index-XXXXX.js`)
   - 파일 내용 확인 (Search: `VITE_ENABLE_TEST_CREDITS`)

4. **Console 탭**
   - 개발 모드에서만 출력되는 디버깅 로그 확인:
   ```javascript
   // Dashboard.jsx, Sidebar.jsx, Settings.jsx에 추가된 로그:
   console.log('VITE_ENABLE_TEST_CREDITS:', import.meta.env.VITE_ENABLE_TEST_CREDITS)
   ```
   - **참고**: 프로덕션 빌드에서는 이 로그가 제거됩니다.

## 4. 문제 해결 체크리스트

### 환경변수가 빌드에 주입되지 않는 경우

- [ ] **변수 이름 확인**: `VITE_ENABLE_TEST_CREDITS` (정확히 일치)
- [ ] **Vite 접두사 확인**: `VITE_`로 시작하는지 확인
- [ ] **값 확인**: `true` (문자열, 따옴표 없이)
- [ ] **환경 확인**: Production 환경에 변수가 설정되었는지
- [ ] **재배포 확인**: 변수 추가/수정 후 재배포가 실행되었는지
- [ ] **빌드 로그 확인**: 배포 로그에서 환경변수가 보이는지

### 재배포가 필요한 경우

**Vercel:**
- Environment Variables 변경 후 → **Redeploy** 버튼 클릭
- 또는 Git push → 자동 배포 대기

**Railway:**
- Variables 변경 후 → 자동 재배포 (또는 수동 Redeploy)

## 5. 예상 결과

### 성공한 경우

1. **빌드 산출물**에 `"VITE_ENABLE_TEST_CREDITS":"true"` 포함
2. **배포된 사이트**에서 버튼 표시:
   - 우측 상단 "MY CREDITS" 클릭 → 크레딧 모달 → "🧪 Grant Test Credits (+1000)" 버튼
   - Dashboard 페이지 → "🧪 Grant Test Credits +1000" 버튼
   - Settings 페이지 → Credits Card → "🧪 Grant Test Credits (+1000)" 버튼

### 실패한 경우

1. **빌드 산출물**에 `VITE_ENABLE_TEST_CREDITS` 문자열 없음 또는 `"false"`
2. **배포된 사이트**에서 버튼이 보이지 않음
3. **조치**: 위 체크리스트 다시 확인 → 재배포

## 6. 빠른 해결 방법

### Vercel 사용 시

```bash
# 1. Vercel 대시보드에서:
#    Settings → Environment Variables
#    Key: VITE_ENABLE_TEST_CREDITS
#    Value: true
#    Environments: Production, Preview, Development

# 2. Redeploy 실행
#    프로젝트 페이지 → "Redeploy" 버튼 클릭
```

### Railway 사용 시

```bash
# 1. Railway 대시보드에서:
#    프론트엔드 서비스 → Variables
#    Key: VITE_ENABLE_TEST_CREDITS
#    Value: true

# 2. 자동 재배포 대기 (또는 수동 Redeploy)
```

## 참고

- Vite는 **빌드 시점**에 환경변수를 주입합니다
- 환경변수 변경 후 **반드시 재배포 필요**
- 개발 모드(`npm run dev`)에서는 서버 재시작으로 반영
- 프로덕션 빌드에서는 재빌드/재배포 필요


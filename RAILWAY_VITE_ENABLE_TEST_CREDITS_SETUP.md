# Railway에서 VITE_ENABLE_TEST_CREDITS 설정 가이드

## 문제
테스트 크레딧 버튼이 배포 환경에서 보이지 않습니다.
원인: `VITE_ENABLE_TEST_CREDITS` 환경변수가 빌드 시점에 주입되지 않았습니다.

## 해결 방법

### 1. Railway 대시보드 접속
1. https://railway.app/dashboard 접속
2. `optlisting` 프로젝트 선택

### 2. 프론트엔드 서비스 확인
**중요**: 프론트엔드가 별도 서비스로 배포되어 있는지 확인합니다.
- Vercel에 배포되어 있다면 → Vercel 설정 참고
- Railway에 프론트엔드 서비스가 있다면 → 아래 단계 진행

### 3. 환경변수 추가
1. **프론트엔드 서비스 선택** (별도 서비스가 있는 경우)
2. **Variables 탭** 클릭
3. **New Variable** 클릭
4. 다음 변수 추가:
   - **Key**: `VITE_ENABLE_TEST_CREDITS`
   - **Value**: `true` (따옴표 없이, 문자열 `true`)
5. **Save** 클릭

### 4. 재배포 실행
**중요**: 환경변수 변경 후 반드시 재배포가 필요합니다.

#### 방법 1: 자동 재배포
- Variables 저장 후 Railway가 자동으로 재배포를 트리거할 수 있습니다.
- Deployments 탭에서 새 배포가 시작되는지 확인합니다.

#### 방법 2: 수동 재배포
1. **Deployments 탭** 클릭
2. **Redeploy** 버튼 클릭 (또는 최신 배포의 "..." 메뉴 → Redeploy)

### 5. 빌드 로그 확인
1. **Deployments 탭** → 최신 배포 선택
2. **Logs** 탭에서 빌드 로그 확인
3. 환경변수가 주입되었는지 확인:
   ```
   VITE_ENABLE_TEST_CREDITS=true
   ```

### 6. 배포 완료 후 확인
1. 배포 완료 대기 (보통 2-5분)
2. 배포된 사이트 접속
3. **Settings 페이지** 접속
4. **Credits Card** 섹션 확인
5. "Buy Credits" 버튼 아래에 "🧪 Grant Test Credits (+1000)" 버튼이 보이는지 확인

## 버튼 위치

### Settings 페이지
- **위치**: Credits Card 섹션 내부
- **구조**:
  ```
  Credits Card
    ├─ Credits 정보 (잔액, 사용량)
    ├─ "Buy Credits" 버튼
    └─ [VITE_ENABLE_TEST_CREDITS === 'true'일 때만 표시]
        └─ "🧪 Grant Test Credits (+1000)" 버튼
  ```

### 다른 위치
- **Sidebar.jsx**: 크레딧 모달 내부
- **Dashboard.jsx**: FilterBar 위

## 검증 체크리스트

- [ ] Railway Variables에 `VITE_ENABLE_TEST_CREDITS=true` 추가됨
- [ ] 변수 값이 정확히 `true` (문자열, 따옴표 없이)
- [ ] 재배포가 실행됨
- [ ] 빌드 로그에서 환경변수 확인됨
- [ ] 배포 완료 후 Settings 페이지에서 버튼 확인됨

## 문제 해결

### 버튼이 여전히 보이지 않는 경우

1. **브라우저 개발자 도구 확인**
   - F12 → Console 탭
   - `import.meta.env.VITE_ENABLE_TEST_CREDITS` 값 확인
   - 개발 모드에서만 출력되는 디버깅 로그 확인:
     ```
     [DEBUG] Settings - VITE_ENABLE_TEST_CREDITS: true
     ```

2. **빌드 산출물 확인**
   - 배포된 사이트 → Network 탭 → JS 파일 다운로드
   - 파일 내용에서 `VITE_ENABLE_TEST_CREDITS` 검색
   - 값이 `"true"`인지 확인

3. **환경변수 재확인**
   - Railway Variables에서 변수 이름 확인 (대소문자 정확히 일치)
   - 값이 `true`인지 확인 (따옴표 없이)
   - 프론트엔드 서비스에 설정되었는지 확인 (백엔드 서비스가 아님)

4. **재배포 확인**
   - Variables 변경 후 재배포가 실행되었는지 확인
   - 빌드 로그에서 환경변수가 보이는지 확인

## 참고

- Vite는 **빌드 시점**에 환경변수를 주입합니다
- 환경변수 변경 후 **반드시 재배포 필요**
- 변수 이름은 `VITE_` 접두사로 시작해야 합니다
- 값은 문자열 `'true'`여야 합니다 (boolean true가 아님)


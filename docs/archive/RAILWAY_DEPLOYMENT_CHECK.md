# Railway 배포 상태 확인 가이드

## 현재 상황
- GitHub에 main 브랜치 푸시 완료 ✅
- Railway에서 여전히 500 에러 발생 ❌

## 확인 사항

### 1. Railway 배포 상태 확인
Railway 대시보드에서:
1. 프로젝트 선택
2. "Deployments" 탭 확인
3. 최신 배포가 완료되었는지 확인
4. 배포 로그에서 에러 메시지 확인

### 2. Railway 브랜치 설정 확인
Railway가 어떤 브랜치를 배포하는지 확인:
1. 프로젝트 → Settings → Source
2. "Branch" 설정 확인
3. `main` 브랜치로 설정되어 있는지 확인
4. `develop` 브랜치로 설정되어 있다면 `main`으로 변경

### 3. 배포 로그 확인
Railway 대시보드에서:
1. 최신 배포 선택
2. "View Logs" 클릭
3. 에러 메시지 확인:
   - 데이터베이스 연결 에러?
   - 모듈 임포트 에러?
   - 기타 런타임 에러?

### 4. 서버 재시작
Railway에서 수동으로 재배포:
1. 프로젝트 → "Redeploy" 버튼 클릭
2. 또는 Settings → "Redeploy" 클릭

## 가능한 문제점

### 문제 1: 브랜치 설정
- Railway가 `develop` 브랜치를 배포하고 있을 수 있음
- 해결: Settings에서 `main` 브랜치로 변경

### 문제 2: 배포 미완료
- 방금 푸시했으므로 배포가 아직 진행 중일 수 있음
- 해결: 2-3분 대기 후 다시 테스트

### 문제 3: 데이터베이스 연결
- Railway의 PostgreSQL 연결 문제
- 해결: DATABASE_URL 환경 변수 확인

### 문제 4: 모듈 경로
- `gunicorn backend.main:app` 경로 문제
- 해결: Railway.json의 startCommand 확인

## 빠른 해결 방법

### 방법 1: Railway에서 수동 재배포
1. Railway 대시보드 접속
2. 프로젝트 선택
3. "Redeploy" 버튼 클릭

### 방법 2: Railway CLI로 재배포
```bash
railway login
railway link
railway up
```

### 방법 3: 빈 커밋으로 재배포 트리거
```bash
git commit --allow-empty -m "trigger redeploy"
git push origin main
```

## 배포 확인 체크리스트

- [ ] Railway 배포 로그 확인
- [ ] 브랜치 설정 확인 (main으로 설정)
- [ ] 배포 완료 대기 (2-3분)
- [ ] API 문서 접속: https://web-production-3dc73.up.railway.app/docs
- [ ] `/api/listings` 엔드포인트 테스트
- [ ] 500 에러 해결 여부 확인

## 다음 단계

배포가 완료되면:
1. https://web-production-3dc73.up.railway.app/docs 접속
2. `/api/listings` 엔드포인트 테스트
3. 500 에러가 해결되었는지 확인


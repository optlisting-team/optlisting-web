# Railway 백엔드 배포 가이드

## 1. Railway 프로젝트 생성

### 방법 1: Railway 웹사이트에서 생성 (추천)

1. **Railway 접속**
   - https://railway.app 접속
   - GitHub 계정으로 로그인

2. **새 프로젝트 생성**
   - "New Project" 클릭
   - "Deploy from GitHub repo" 선택
   - `optlisting` 저장소 선택
   - "Deploy" 클릭

3. **서비스 타입 설정**
   - Railway가 자동으로 Python 프로젝트를 감지합니다
   - `railway.json` 파일의 설정이 자동으로 적용됩니다

### 방법 2: Railway CLI 사용

```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 초기화
railway init

# 배포
railway up
```

---

## 2. PostgreSQL 데이터베이스 추가

Railway에서 PostgreSQL 데이터베이스를 추가해야 합니다:

1. **Railway 대시보드에서**
   - 프로젝트 내에서 "New" 버튼 클릭
   - "Database" 선택
   - "Add PostgreSQL" 선택

2. **데이터베이스 URL 자동 연결**
   - Railway가 자동으로 `DATABASE_URL` 환경 변수를 설정합니다
   - 별도 설정이 필요 없습니다!

---

## 3. 환경 변수 설정

Railway 대시보드에서 프로젝트 > Variables 탭에서 다음 환경 변수를 설정:

### 필수 환경 변수

```env
# 데이터베이스 URL (PostgreSQL 추가 시 자동 설정됨)
DATABASE_URL=postgresql://user:password@host:port/dbname

# 프론트엔드 URL (CORS 설정용)
FRONTEND_URL=https://your-frontend-url.vercel.app

# 포트 (Railway가 자동으로 설정하므로 일반적으로 불필요)
PORT=8000
```

**참고**: `DATABASE_URL`은 Railway에서 PostgreSQL을 추가하면 자동으로 설정됩니다.

---

## 4. 데이터베이스 초기화

배포 후 Railway 터미널에서 데이터베이스 테이블을 생성:

### 방법 1: Railway 터미널 사용

1. Railway 대시보드에서 프로젝트 선택
2. "View Logs" 옆에 있는 "Shell" 탭 클릭
3. 다음 명령어 실행:

```bash
cd backend
python -c "from models import init_db, Base, engine; Base.metadata.create_all(bind=engine)"
```

### 방법 2: Railway CLI 사용

```bash
railway run python -c "from backend.models import init_db, Base, engine; Base.metadata.create_all(bind=engine)"
```

### 더미 데이터 생성 (선택사항)

```bash
railway run python -c "from backend.models import init_db, get_db, Base, engine; from backend.dummy_data import generate_dummy_listings; Base.metadata.create_all(bind=engine); db = next(get_db()); generate_dummy_listings(db, 5000)"
```

---

## 5. 도메인 설정

1. Railway 대시보드에서 프로젝트 선택
2. Settings 탭으로 이동
3. "Generate Domain" 버튼 클릭
4. 생성된 도메인 URL을 복사 (예: `https://optlisting-production.up.railway.app`)

---

## 6. 프론트엔드 설정 업데이트

생성된 Railway 도메인을 프론트엔드 환경 변수에 추가:

1. **Vercel 대시보드** (또는 사용 중인 프론트엔드 플랫폼)에서
2. 환경 변수 설정:
   ```
   VITE_API_URL=https://your-railway-domain.up.railway.app
   ```
3. 프론트엔드 재배포

---

## 7. CORS 설정 확인

백엔드가 프론트엔드 요청을 허용하도록 `backend/main.py`의 CORS 설정을 확인합니다.

현재 설정된 허용 오리진:
- Vercel 배포 URL
- Localhost (개발용)

프론트엔드 URL이 다르면 `backend/main.py`를 수정하거나 `FRONTEND_URL` 환경 변수를 설정하세요.

---

## 8. 배포 확인

### 백엔드 API 테스트

1. **Health Check**
   ```bash
   curl https://your-railway-domain.up.railway.app/
   ```

2. **API 문서 확인**
   - 브라우저에서 접속: `https://your-railway-domain.up.railway.app/docs`
   - Swagger UI가 자동으로 생성됩니다

3. **로그 확인**
   - Railway 대시보드 > "View Logs"에서 실시간 로그 확인

---

## 문제 해결

### 데이터베이스 연결 오류

- `DATABASE_URL` 환경 변수가 올바르게 설정되었는지 확인
- Railway에서 PostgreSQL 서비스가 실행 중인지 확인

### 포트 오류

- Railway는 자동으로 `$PORT` 환경 변수를 설정합니다
- `railway.json`의 `startCommand`에서 `$PORT` 사용 확인

### CORS 오류

- `FRONTEND_URL` 환경 변수가 올바르게 설정되었는지 확인
- `backend/main.py`의 `allowed_origins` 리스트 확인

### 빌드 실패

- `requirements.txt`에 모든 의존성이 포함되어 있는지 확인
- Railway 로그에서 구체적인 오류 메시지 확인

---

## 요약 체크리스트

- [ ] Railway 계정 생성 및 GitHub 연결
- [ ] 프로젝트 생성 및 저장소 연결
- [ ] PostgreSQL 데이터베이스 추가
- [ ] 환경 변수 설정 (`FRONTEND_URL` 등)
- [ ] 데이터베이스 테이블 생성
- [ ] 도메인 생성
- [ ] 프론트엔드 환경 변수 업데이트
- [ ] API 테스트

---

## 추가 리소스

- [Railway 공식 문서](https://docs.railway.app)
- [Railway Discord 커뮤니티](https://discord.gg/railway)



# 🚀 배포 시작 가이드

## 📋 배포 전 준비사항

✅ **완료된 작업:**
- ✅ 코드가 `optlisting-team/optlisting-` 저장소에 푸시됨
- ✅ Railway 배포 설정 파일(`railway.json`) 준비됨
- ✅ 백엔드 코드 준비 완료

---

## 1️⃣ Railway 백엔드 배포

### Step 1: Railway 가입 및 로그인

1. **Railway 접속**
   - https://railway.app 접속
   - **"Start a New Project"** 또는 **"Login"** 클릭

2. **GitHub로 로그인**
   - **"Continue with GitHub"** 버튼 클릭
   - GitHub 로그인 후 권한 승인
   - ⚠️ `optlisting-team` 조직 저장소 접근 권한 허용

### Step 2: 프로젝트 생성 및 배포

1. **새 프로젝트 생성**
   - Railway 대시보드에서 **"New Project"** 클릭
   - **"Deploy from GitHub repo"** 선택
   - 저장소 선택: `optlisting-team/optlisting-` (또는 `optlisting-`)
   - **"Deploy"** 클릭

2. **자동 감지 확인**
   - Railway가 자동으로 Python 프로젝트 감지
   - `railway.json` 설정 자동 적용
   - 빌드 시작

### Step 3: PostgreSQL 데이터베이스 추가

1. **데이터베이스 추가**
   - 프로젝트 대시보드에서 **"New"** 버튼 클릭
   - **"Database"** 선택
   - **"Add PostgreSQL"** 선택

2. **자동 연결 확인**
   - Railway가 자동으로 `DATABASE_URL` 환경 변수 설정
   - 별도 설정 불필요!

---

## 2️⃣ Supabase 데이터베이스 연결 (선택사항)

Railway PostgreSQL 대신 Supabase를 사용하려면:

### Step 1: Supabase 가입 및 프로젝트 생성

1. **Supabase 접속**
   - https://supabase.com 접속
   - **"Start your project"** 클릭

2. **GitHub로 로그인**
   - **"Continue with GitHub"** 버튼 클릭
   - GitHub 로그인 후 권한 승인

3. **새 프로젝트 생성**
   - **"New Project"** 클릭
   - Organization 선택 (또는 새로 생성)
   - 프로젝트 설정:
     - **Name**: `optlisting`
     - **Database Password**: 강력한 비밀번호 설정 (저장 필수!)
     - **Region**: 가장 가까운 지역 선택
   - **"Create new project"** 클릭

### Step 2: 데이터베이스 연결 문자열 가져오기

1. **Connection String 복사**
   - Supabase 대시보드에서 프로젝트 선택
   - **Settings** → **Database** 메뉴
   - **"Connection string"** 섹션
   - **"URI"** 탭 선택
   - 연결 문자열 복사
   - 형식: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

2. **비밀번호 교체**
   - 복사한 문자열에서 `[YOUR-PASSWORD]`를 실제 비밀번호로 교체

### Step 3: Railway 환경 변수 설정

1. **Railway 대시보드 접속**
   - 프로젝트 선택 → **"Variables"** 탭

2. **DATABASE_URL 설정**
   - **"New Variable"** 클릭
   - **Key**: `DATABASE_URL`
   - **Value**: Supabase에서 복사한 연결 문자열 (비밀번호 교체 완료)
   - **"Add"** 클릭

---

## 3️⃣ 환경 변수 설정 (Railway)

### 필수 환경 변수

Railway 대시보드 → 프로젝트 → **"Variables"** 탭에서 설정:

```env
# 프론트엔드 URL (CORS 설정용)
FRONTEND_URL=https://your-frontend-url.vercel.app

# 데이터베이스 URL은 Railway PostgreSQL 추가 시 자동 설정되거나
# Supabase 사용 시 수동으로 설정
DATABASE_URL=postgresql://...
```

---

## 4️⃣ 데이터베이스 초기화

배포가 완료되면 데이터베이스 테이블을 생성해야 합니다:

### Railway 터미널 사용

1. Railway 대시보드 → 프로젝트 선택
2. **"Shell"** 탭 클릭
3. 다음 명령어 실행:

```bash
cd backend
python -c "from models import init_db, Base, engine; Base.metadata.create_all(bind=engine)"
```

### 더미 데이터 생성 (선택사항)

```bash
python -c "from backend.models import init_db, get_db, Base, engine; from backend.dummy_data import generate_dummy_listings; Base.metadata.create_all(bind=engine); db = next(get_db()); generate_dummy_listings(db, 5000)"
```

---

## 5️⃣ 도메인 설정

1. Railway 대시보드 → 프로젝트 선택
2. **"Settings"** 탭 → **"Networking"**
3. **"Generate Domain"** 버튼 클릭
4. 생성된 도메인 복사 (예: `https://optlisting-production.up.railway.app`)

---

## 6️⃣ 프론트엔드 연결

1. **Vercel 대시보드** (또는 프론트엔드 플랫폼) 접속
2. 환경 변수 설정:
   ```
   VITE_API_URL=https://your-railway-domain.up.railway.app
   ```
3. 프론트엔드 재배포

---

## ✅ 배포 확인

### 백엔드 API 테스트

1. **Health Check**
   ```bash
   curl https://your-railway-domain.up.railway.app/
   ```

2. **API 문서 확인**
   - 브라우저에서 접속: `https://your-railway-domain.up.railway.app/docs`
   - Swagger UI 확인

---

## 📝 요약 체크리스트

- [ ] Railway에 GitHub로 가입
- [ ] Railway에서 프로젝트 생성 및 `optlisting-team/optlisting-` 저장소 연결
- [ ] PostgreSQL 데이터베이스 추가 (Railway 또는 Supabase)
- [ ] 환경 변수 설정 (`FRONTEND_URL` 등)
- [ ] 데이터베이스 테이블 생성
- [ ] 도메인 생성
- [ ] 프론트엔드 환경 변수 업데이트
- [ ] API 테스트

---

## 🔗 유용한 링크

- **Railway**: https://railway.app
- **Supabase**: https://supabase.com
- **Railway 문서**: https://docs.railway.app
- **Supabase 문서**: https://supabase.com/docs






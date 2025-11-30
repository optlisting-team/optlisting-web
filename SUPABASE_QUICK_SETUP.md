# 🚀 Supabase 빠른 설정 가이드

## 1단계: Supabase 프로젝트 생성

### 1. Supabase 가입 및 로그인

1. **Supabase 접속**
   - https://supabase.com 접속
   - **"Start your project"** 클릭

2. **GitHub로 로그인**
   - **"Continue with GitHub"** 버튼 클릭
   - GitHub 로그인 후 권한 승인

### 2. 새 프로젝트 생성

1. **프로젝트 생성**
   - **"New Project"** 클릭
   - Organization 선택 (없으면 새로 생성)

2. **프로젝트 설정**
   - **Name**: `optlisting`
   - **Database Password**: 🔑 **강력한 비밀번호 입력 (필수 저장!)**
     - ⚠️ 나중에 복구할 수 없으니 꼭 저장하세요!
   - **Region**: 가장 가까운 지역 선택
   - **Pricing Plan**: Free tier 선택

3. **프로젝트 생성**
   - **"Create new project"** 클릭
   - ⏳ 1-2분 정도 소요됩니다

---

## 2단계: 데이터베이스 연결 문자열 가져오기

### 1. Connection String 복사

1. Supabase 대시보드에서 프로젝트 선택
2. 좌측 메뉴에서 **"Settings"** (⚙️ 아이콘) 클릭
3. **"Database"** 메뉴 선택
4. **"Connection string"** 섹션으로 스크롤
5. **"URI"** 탭 선택
6. 연결 문자열 복사
   - 형식: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

### 2. 비밀번호 확인/설정

1. **"Database password"** 섹션 확인
2. 비밀번호를 잊었다면 **"Reset database password"** 클릭
3. 새 비밀번호 설정 후 저장

### 3. 연결 문자열에 비밀번호 적용

복사한 연결 문자열에서:
- `[YOUR-PASSWORD]`를 실제 비밀번호로 교체
- 예: `postgresql://postgres:MyPassword123@db.xxxxx.supabase.co:5432/postgres`

⚠️ **비밀번호에 특수문자가 있으면 URL 인코딩 필요:**
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- 등등...

---

## 3단계: Railway 환경 변수 설정

### 1. Railway 대시보드 접속

1. https://railway.app 접속
2. 생성한 프로젝트 선택

### 2. 환경 변수 추가

1. 프로젝트 대시보드에서 **"Variables"** 탭 클릭
2. **"+ New Variable"** 버튼 클릭
3. 다음 변수 추가:

```
Key: DATABASE_URL
Value: postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

⚠️ **YOUR_PASSWORD를 실제 비밀번호로 교체하세요!**

4. **"Add"** 클릭

### 3. 추가 환경 변수 (선택사항)

프론트엔드 URL이 있다면:

```
Key: FRONTEND_URL
Value: https://your-frontend-url.vercel.app
```

---

## 4단계: 데이터베이스 테이블 생성

Supabase에서 테이블을 생성하는 방법은 두 가지가 있습니다:

### 방법 1: Supabase SQL Editor 사용 (추천)

1. **Supabase 대시보드 → 프로젝트 선택**
2. 좌측 메뉴에서 **"SQL Editor"** 클릭
3. **"New query"** 클릭
4. 다음 SQL 코드 붙여넣기:

**파일 사용 (추천):**
1. 프로젝트 루트에 있는 `supabase_schema.sql` 파일 내용을 복사
2. Supabase SQL Editor에 붙여넣기
3. "Run" 버튼 클릭

**또는 아래 SQL 직접 실행:**

```sql
-- supabase_schema.sql 파일 참고
-- 모든 필드와 인덱스를 포함한 완전한 스키마입니다
```

5. **"Run"** 버튼 클릭 (또는 Ctrl+Enter)
6. ✅ 성공 메시지 확인

### 방법 2: Railway 터미널 사용 (Python)

Railway 배포 후:

1. Railway 대시보드 → 프로젝트 선택
2. **"Shell"** 탭 클릭
3. 다음 명령어 실행:

```bash
cd backend
python -c "from backend.models import Base, engine; Base.metadata.create_all(bind=engine)"
```

---

## 5단계: Railway 배포 확인

### 1. Railway 배포 상태 확인

1. Railway 대시보드에서 프로젝트 선택
2. **"web"** 서비스 확인
3. 배포 로그 확인

### 2. 도메인 생성

1. 프로젝트 선택 → **"Settings"** 탭
2. **"Networking"** 섹션
3. **"Generate Domain"** 버튼 클릭
4. 생성된 도메인 복사 (예: `https://optlisting-production.up.railway.app`)

### 3. API 테스트

1. 브라우저에서 접속: `https://your-railway-domain.up.railway.app/`
2. 응답 확인: `{"message": "OptListing API is running"}`

3. API 문서 확인:
   - `https://your-railway-domain.up.railway.app/docs`
   - Swagger UI 확인

---

## 6단계: 더미 데이터 생성 (선택사항)

테스트용 더미 데이터 생성:

### Railway 터미널에서:

```bash
cd backend
python -c "from backend.models import get_db, Base, engine; from backend.dummy_data import generate_dummy_listings; Base.metadata.create_all(bind=engine); db = next(get_db()); generate_dummy_listings(db, 5000)"
```

또는 Supabase SQL Editor에서 직접 데이터 삽입 가능

---

## ✅ 완료 체크리스트

- [ ] Supabase 프로젝트 생성 완료
- [ ] 데이터베이스 비밀번호 저장
- [ ] Connection String 복사
- [ ] Railway 환경 변수에 `DATABASE_URL` 설정
- [ ] 데이터베이스 테이블 생성 완료
- [ ] Railway 배포 확인
- [ ] 도메인 생성 완료
- [ ] API 테스트 성공

---

## 🔧 문제 해결

### 연결 오류

- `DATABASE_URL` 형식 확인 (`postgresql://`로 시작)
- 비밀번호에 특수문자가 있으면 URL 인코딩
- Supabase 방화벽 설정 확인 (Settings → Database → Connection pooling)

### 테이블 생성 오류

- SQL Editor에서 직접 실행
- 또는 Railway 터미널에서 Python 명령어 실행

### 배포 실패

- Railway 로그 확인
- `requirements.txt` 의존성 확인
- 환경 변수 설정 확인

---

## 🔗 유용한 링크

- **Supabase 대시보드**: https://supabase.com/dashboard
- **Railway 대시보드**: https://railway.app
- **Supabase 문서**: https://supabase.com/docs


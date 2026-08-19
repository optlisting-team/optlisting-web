# 새 Supabase 프로젝트 설정 가이드

## 새 프로젝트 정보
- 프로젝트 ID: `hjbmoncohuuwnywrpwpi`
- 대시보드: https://supabase.com/dashboard/project/hjbmoncohuuwnywrpwpi

## DATABASE_URL 구성 방법

### Step 1: Supabase 대시보드에서 연결 정보 확인

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard/project/hjbmoncohuuwnywrpwpi
   - Settings → Database

2. **Connection string 확인**
   - "Connection string" 섹션으로 스크롤
   - "URI" 탭 선택
   - 연결 문자열 복사

3. **Database password 확인**
   - "Database password" 섹션 확인
   - 비밀번호를 모르면 "Reset database password" 클릭
   - ⚠️ **새 비밀번호를 안전한 곳에 기록!**

### Step 2: DATABASE_URL 형식

**일반 형식:**
```
postgresql://postgres:[PASSWORD]@db.hjbmoncohuuwnywrpwpi.supabase.co:5432/postgres
```

**Pooler 형식 (권장):**
```
postgresql://postgres.hjbmoncohuuwnywrpwpi:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**예시:**
```
postgresql://postgres:YourPassword123@db.hjbmoncohuuwnywrpwpi.supabase.co:5432/postgres
```

### Step 3: Railway Environment Variables 설정

1. **Railway 대시보드 접속**
   - https://railway.app
   - 새로 연결한 프로젝트 선택

2. **Variables 탭**
   - "Variables" 탭 클릭

3. **DATABASE_URL 추가**
   - "+ New Variable" 클릭
   - **Key**: `DATABASE_URL`
   - **Value**: 위에서 구성한 연결 문자열 (비밀번호 포함)
   - "Add" 클릭

### Step 4: 특수문자 URL 인코딩

비밀번호에 특수문자가 있으면 URL 인코딩 필요:

| 문자 | 인코딩 |
|------|--------|
| `!` | `%21` |
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `/` | `%2F` |
| `:` | `%3A` |
| `?` | `%3F` |
| `&` | `%26` |
| `=` | `%3D` |
| `+` | `%2B` |
| 공백 | `%20` |

**예시:**
- 비밀번호: `Opt2026!!`
- 인코딩: `Opt2026%21%21`
- 전체 URL: `postgresql://postgres:Opt2026%21%21@db.hjbmoncohuuwnywrpwpi.supabase.co:5432/postgres`

## 확인 방법

### 1. Railway 배포 로그 확인
1. Railway 대시보드 → Deployments
2. 최신 배포 로그 확인
3. "Database connection successful" 메시지 확인

### 2. API 테스트
1. 배포 완료 후: https://web-production-3dc73.up.railway.app/docs
2. `/api/listings` 엔드포인트 테스트
3. 정상 응답 확인

## 마이그레이션 실행

새 프로젝트에 테이블을 생성해야 합니다:

### 방법 1: Supabase SQL Editor 사용

1. Supabase 대시보드 → SQL Editor
2. 다음 마이그레이션 실행:
   - `backend/migrations/fix_jsonb_queries.sql`
   - `backend/migrations/add_global_winner_columns.sql`
   - `backend/migrations/create_profiles_table.sql`

### 방법 2: Railway 터미널 사용

Railway 대시보드 → Shell 탭에서:
```bash
cd backend
python -c "from models import Base, engine; Base.metadata.create_all(bind=engine)"
```

## 체크리스트

- [ ] Supabase 대시보드에서 연결 문자열 확인
- [ ] Database password 확인/설정
- [ ] DATABASE_URL 구성 (비밀번호 포함)
- [ ] 특수문자 URL 인코딩 적용 (필요 시)
- [ ] Railway Variables에 DATABASE_URL 추가
- [ ] Railway 재배포 확인
- [ ] 배포 로그에서 연결 성공 확인
- [ ] 마이그레이션 실행 (테이블 생성)
- [ ] API 테스트 성공

## 문제 해결

### 연결 실패 시:
1. 비밀번호 확인
2. URL 인코딩 확인
3. 연결 문자열 형식 확인
4. Supabase 방화벽 설정 확인

### 권한 오류 시:
1. Supabase 프로젝트 설정 확인
2. API Keys 권한 확인
3. Database password 재설정


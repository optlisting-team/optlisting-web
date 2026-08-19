# Railway 새 연결 환경 변수 설정 가이드

## 현재 상황
- 기존 Railway 연결 해제 완료
- 새로운 GitHub 저장소 연결 완료
- 환경 변수 등록 필요

## 필수 환경 변수

### 1. DATABASE_URL (필수)

**Supabase 연결 정보:**
- 프로젝트 ID: `lmgghdbsxycgddptvwtn`
- 호스트: `db.lmgghdbsxycgddptvwtn.supabase.co`
- 포트: `5432`
- 데이터베이스: `postgres`

**연결 문자열 형식:**
```
postgresql://postgres:[PASSWORD]@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres
```

**비밀번호 확인 방법:**
1. Supabase 대시보드 접속: https://supabase.com/dashboard/project/lmgghdbsxycgddptvwtn
2. Settings → Database
3. Database password 확인 또는 Reset

**URL 인코딩 필요 시:**
- `!` → `%21`
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- 기타 특수문자도 URL 인코딩

### 2. FRONTEND_URL (선택사항)

프론트엔드 URL (CORS 설정용):
```
https://your-frontend-url.vercel.app
```

## Railway 환경 변수 설정 단계

### Step 1: Railway Variables 탭 열기

1. Railway 대시보드 접속: https://railway.app
2. 프로젝트 선택 (새로 연결한 프로젝트)
3. **"Variables"** 탭 클릭
   - 프로젝트 레벨 또는 서비스(web) 레벨에서 설정 가능

### Step 2: DATABASE_URL 추가

1. **"+ New Variable"** 버튼 클릭
2. 입력:
   - **Key**: `DATABASE_URL`
   - **Value**: Supabase 연결 문자열 (비밀번호 포함)
3. **"Add"** 클릭

**예시:**
```
Key: DATABASE_URL
Value: postgresql://postgres:YourPassword123@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres
```

### Step 3: FRONTEND_URL 추가 (선택사항)

1. **"+ New Variable"** 버튼 클릭
2. 입력:
   - **Key**: `FRONTEND_URL`
   - **Value**: 프론트엔드 URL
3. **"Add"** 클릭

### Step 4: 확인

- Variables 목록에서 두 변수가 표시되는지 확인
- 값은 보안상 마스킹되어 표시됨

## Supabase 비밀번호 확인/설정

### 방법 1: 기존 비밀번호 확인
1. Supabase 대시보드 접속
2. Settings → Database
3. Database password 확인

### 방법 2: 새 비밀번호 설정
1. Supabase 대시보드 접속
2. Settings → Database
3. "Reset database password" 클릭
4. 새 비밀번호 설정
5. **⚠️ 중요: 비밀번호를 안전한 곳에 기록!**

## 연결 문자열 예시

### 일반 비밀번호:
```
postgresql://postgres:MyPassword123@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres
```

### 특수문자 포함 비밀번호 (URL 인코딩):
```
postgresql://postgres:Opt2026%21%21@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres
```
(`!` → `%21`)

## 배포 후 확인

### 1. Railway 배포 로그 확인
1. Railway 대시보드 → Deployments
2. 최신 배포 로그 확인
3. "Database connection successful" 메시지 확인

### 2. API 테스트
1. 배포 완료 후: https://web-production-3dc73.up.railway.app/docs
2. `/api/listings` 엔드포인트 테스트
3. 500 에러 없이 정상 응답 확인

## 문제 해결

### DATABASE_URL 연결 실패 시:
1. 비밀번호 확인
2. URL 인코딩 적용 (특수문자 있는 경우)
3. 연결 문자열 형식 확인
4. Supabase 방화벽 설정 확인

### 환경 변수가 적용되지 않으면:
1. Railway 재배포 (자동 또는 수동)
2. Variables 탭에서 변수 확인
3. 서비스 레벨 vs 프로젝트 레벨 확인

## 체크리스트

- [ ] Supabase 비밀번호 확인/설정
- [ ] DATABASE_URL 환경 변수 추가
- [ ] FRONTEND_URL 환경 변수 추가 (선택사항)
- [ ] 환경 변수 저장 확인
- [ ] Railway 재배포 확인
- [ ] 배포 로그 확인
- [ ] API 테스트

## 보안 주의사항

- ✅ 환경 변수는 Railway에서 암호화되어 저장됨
- ✅ DATABASE_URL에 비밀번호가 포함되어 있으므로 절대 공유하지 마세요
- ✅ 코드에 하드코딩하지 마세요
- ✅ `.env` 파일을 Git에 커밋하지 마세요


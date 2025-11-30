# Railway 환경 변수 설정 가이드

## 1단계: Supabase 연결 문자열 가져오기

### 1. Supabase 대시보드 접속
1. https://supabase.com/dashboard 접속
2. `optlisting` 프로젝트 선택

### 2. 데이터베이스 연결 문자열 복사
1. 좌측 메뉴에서 **"Settings"** (⚙️ 아이콘) 클릭
2. **"Database"** 메뉴 선택
3. **"Connection string"** 섹션으로 스크롤
4. **"URI"** 탭 선택
5. 연결 문자열 복사
   - 형식: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

### 3. 비밀번호 확인/설정
1. **"Database password"** 섹션 확인
2. 비밀번호를 잊었다면 **"Reset database password"** 클릭
3. 새 비밀번호 설정 후 **저장** (나중에 필요하니 기록!)

### 4. 연결 문자열에 비밀번호 적용
복사한 연결 문자열에서:
- `[YOUR-PASSWORD]`를 실제 비밀번호로 교체
- 예: `postgresql://postgres:MyPassword123@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres`

⚠️ **비밀번호에 특수문자가 있으면 URL 인코딩 필요:**
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `/` → `%2F`
- `:` → `%3A`
- `?` → `%3F`
- `&` → `%26`
- `=` → `%3D`
- `+` → `%2B`
- ` ` (공백) → `%20`

---

## 2단계: Railway 환경 변수 설정

### 방법 1: Railway 웹 대시보드 (추천)

1. **Railway 대시보드 접속**
   - https://railway.app 접속
   - 프로젝트 선택

2. **Variables 탭 열기**
   - 프로젝트 대시보드에서 **"Variables"** 탭 클릭
   - 또는 서비스(web) 선택 → **"Variables"** 탭

3. **새 환경 변수 추가**
   - **"+ New Variable"** 버튼 클릭
   - 다음 변수 입력:
     - **Key**: `DATABASE_URL`
     - **Value**: Supabase 연결 문자열 (비밀번호 교체 완료)
     - **"Add"** 클릭

4. **추가 환경 변수 설정 (선택사항)**
   - **"+ New Variable"** 클릭
   - **Key**: `FRONTEND_URL`
   - **Value**: 프론트엔드 URL (예: `https://your-app.vercel.app`)
   - **"Add"** 클릭

5. **변수 확인**
   - 추가된 환경 변수가 목록에 표시되는지 확인
   - `DATABASE_URL`은 민감한 정보이므로 값이 마스킹되어 표시됨

### 방법 2: Railway CLI (터미널)

#### Railway CLI 로그인 먼저:
```bash
railway login
```

#### 환경 변수 설정:
```bash
# DATABASE_URL 설정
railway variables set DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres"

# FRONTEND_URL 설정 (선택사항)
railway variables set FRONTEND_URL="https://your-frontend-url.vercel.app"
```

#### 환경 변수 확인:
```bash
railway variables
```

---

## 3단계: 환경 변수 확인

### Railway 대시보드에서:
1. Variables 탭에서 `DATABASE_URL` 확인
2. 값이 올바르게 설정되었는지 확인 (마스킹되어 표시됨)

### 배포 후 확인:
1. Railway 대시보드 → 프로젝트 선택
2. **"Shell"** 탭 클릭
3. 다음 명령어 실행:
```bash
echo $DATABASE_URL
```
(보안상 실제 값은 표시되지 않을 수 있음)

---

## 4단계: 배포 재시작 (선택사항)

환경 변수를 추가한 후:
1. **자동 재배포**: Railway가 자동으로 재배포할 수 있음
2. **수동 재배포**: 필요시 "Deploy" 버튼으로 재배포

---

## 환경 변수 목록

### 필수 환경 변수:
- `DATABASE_URL`: Supabase PostgreSQL 연결 문자열

### 선택 환경 변수:
- `FRONTEND_URL`: 프론트엔드 URL (CORS 설정용)
- `PORT`: 포트 번호 (Railway가 자동 설정하므로 일반적으로 불필요)

---

## 문제 해결

### 연결 오류가 발생하면:

1. **비밀번호 확인**
   - Supabase 대시보드에서 데이터베이스 비밀번호 확인
   - 연결 문자열의 비밀번호가 올바른지 확인

2. **URL 인코딩 확인**
   - 비밀번호에 특수문자가 있으면 URL 인코딩 적용
   - 온라인 URL 인코더 사용 가능

3. **연결 문자열 형식 확인**
   - `postgresql://`로 시작해야 함
   - 포트는 `:5432`여야 함

4. **Supabase 방화벽 확인**
   - Supabase Settings → Database
   - Connection pooling 설정 확인

### 환경 변수가 적용되지 않으면:

1. **Railway 재배포**
   - 수동으로 재배포 실행

2. **환경 변수 확인**
   - Variables 탭에서 변수가 올바르게 저장되었는지 확인

3. **서비스별 설정 확인**
   - 환경 변수가 프로젝트 레벨인지 서비스 레벨인지 확인
   - 서비스(web)의 Variables 탭 확인

---

## 빠른 체크리스트

- [ ] Supabase 연결 문자열 복사
- [ ] 비밀번호 확인/설정
- [ ] 연결 문자열에 비밀번호 적용
- [ ] Railway Variables 탭에서 `DATABASE_URL` 추가
- [ ] 환경 변수 저장 확인
- [ ] 배포 상태 확인

---

## 보안 주의사항

- ✅ 환경 변수는 Railway에서 안전하게 암호화되어 저장됨
- ✅ 연결 문자열에 비밀번호가 포함되어 있으므로 절대 공유하지 마세요
- ✅ 코드에 하드코딩하지 마세요
- ✅ `.env` 파일을 Git에 커밋하지 마세요




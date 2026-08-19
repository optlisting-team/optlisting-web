# Railway DATABASE_URL 크래시 해결 가이드

## 문제
```
sqlalchemy.exc.ArgumentError: Could not parse SQLAlchemy URL from given URL string
```

## 원인
- Railway에 `DATABASE_URL` 환경 변수가 설정되지 않음
- 또는 `DATABASE_URL`이 빈 문자열이거나 잘못된 형식

## 해결 방법

### Step 1: Railway Variables에 DATABASE_URL 추가

1. **Railway 대시보드 접속**
   - https://railway.app 접속
   - 새로 연결한 프로젝트 선택

2. **Variables 탭 클릭**
   - 프로젝트 → "Variables" 탭

3. **DATABASE_URL 추가**
   - "+ New Variable" 클릭
   - **Key**: `DATABASE_URL`
   - **Value**: Supabase 연결 문자열

**Supabase 연결 문자열 형식:**
```
postgresql://postgres:[PASSWORD]@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres
```

**비밀번호 확인:**
1. Supabase 대시보드: https://supabase.com/dashboard/project/lmgghdbsxycgddptvwtn
2. Settings → Database
3. Database password 확인 또는 Reset

**URL 인코딩 필요 시:**
- 비밀번호에 특수문자(`!`, `@`, `#` 등)가 있으면 URL 인코딩
- 예: `!` → `%21`, `@` → `%40`

### Step 2: 코드 수정 (이미 완료)

`backend/models.py`에 다음 수정사항 적용:
- ✅ DATABASE_URL 검증 강화
- ✅ 빈 문자열 체크
- ✅ URL 형식 검증 (`postgresql://` 또는 `postgres://`로 시작)
- ✅ 파싱 실패 시 SQLite로 폴백

### Step 3: Railway 재배포

1. **코드 푸시** (이미 완료)
   ```bash
   git add backend/models.py
   git commit -m "fix: DATABASE_URL 검증 강화 및 에러 처리"
   git push origin main
   ```

2. **환경 변수 설정 후 자동 재배포**
   - Railway가 자동으로 재배포 시작
   - 또는 수동으로 "Redeploy" 클릭

## 확인 방법

### 1. Railway 배포 로그 확인
1. Railway 대시보드 → Deployments
2. 최신 배포 로그 확인
3. "Database connection successful" 메시지 확인
4. 또는 "Falling back to SQLite..." 메시지 확인 (임시)

### 2. API 테스트
1. 배포 완료 후: https://web-production-3dc73.up.railway.app/docs
2. `/api/listings` 엔드포인트 테스트
3. 정상 응답 확인

## 체크리스트

- [ ] Railway Variables에 `DATABASE_URL` 추가
- [ ] Supabase 비밀번호 확인/설정
- [ ] 연결 문자열 형식 확인 (`postgresql://`로 시작)
- [ ] URL 인코딩 적용 (특수문자 있는 경우)
- [ ] 코드 푸시 완료
- [ ] Railway 재배포 완료
- [ ] 배포 로그 확인
- [ ] API 테스트 성공

## 문제 해결

### 여전히 크래시 발생 시:

1. **DATABASE_URL 형식 확인**
   - `postgresql://` 또는 `postgres://`로 시작해야 함
   - 포트는 `:5432`여야 함

2. **비밀번호 URL 인코딩**
   - 특수문자가 있으면 URL 인코딩 적용
   - 온라인 URL 인코더 사용 가능

3. **Railway 로그 확인**
   - Deploy Logs에서 정확한 에러 메시지 확인
   - "Could not parse SQLAlchemy URL" 에러가 계속 발생하는지 확인

4. **임시 해결책**
   - 코드가 SQLite로 폴백하도록 수정됨
   - DATABASE_URL이 없으면 SQLite 사용 (로컬 개발용)

## 참고

- 코드 수정으로 DATABASE_URL이 없거나 잘못된 경우 SQLite로 폴백
- 프로덕션에서는 반드시 DATABASE_URL 설정 필요
- Supabase 연결 문자열은 보안상 안전하게 관리


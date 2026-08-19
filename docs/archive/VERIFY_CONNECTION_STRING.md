# 연결 문자열 확인 및 Railway 설정

## ✅ 연결 문자열 분석

```
postgresql://postgres.hjbmoncohuuwnywrpwpi:Opt2026!!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

### 확인사항:
- ✅ 프로토콜: `postgresql://`
- ✅ 사용자명: `postgres.hjbmoncohuuwnywrpwpi`
- ✅ 비밀번호: `Opt2026!!`
- ✅ 호스트: `aws-1-ap-southeast-1.pooler.supabase.com`
- ✅ 포트: `5432` (Session pooler ✅)
- ✅ 데이터베이스: `postgres`

### 특수문자 확인:
- 비밀번호: `Opt2026!!`
- `!` 문자는 URL에서 안전한 문자이므로 인코딩 불필요 ✅

---

## ⚠️ 주의: URL 인코딩 필요할 수도 있음

비밀번호에 `!`가 있지만, 일부 환경에서는 인코딩이 필요할 수 있습니다:
- `!` → `%21` (필요한 경우)

**안전한 버전:**
```
postgresql://postgres.hjbmoncohuuwnywrpwpi:Opt2026%21%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

하지만 일반적으로는 인코딩 없이 사용 가능합니다.

---

## 🚀 Railway 환경 변수 설정

### 1. Railway 대시보드 접속
- https://railway.app
- 프로젝트 선택

### 2. Variables 탭
- 프로젝트 대시보드 → **"Variables"** 탭 클릭

### 3. 환경 변수 추가
- **"+ New Variable"** 버튼 클릭
- **Key**: `DATABASE_URL`
- **Value**: 연결 문자열 붙여넣기
  ```
  postgresql://postgres.hjbmoncohuuwnywrpwpi:Opt2026!!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
  ```
- **"Add"** 클릭

### 4. 완료! ✅
- Railway가 자동으로 재배포합니다

---

## 🔧 연결 테스트

Railway 배포 후 연결 확인:

1. **Railway Shell 접속**
2. **다음 명령어로 테스트:**
```bash
cd backend
python -c "from backend.models import engine; from sqlalchemy import text; with engine.connect() as conn: result = conn.execute(text('SELECT 1')); print('✅ 연결 성공!')"
```

---

## 🆘 연결 오류가 발생하면

### 문제 1: 특수문자 인코딩
비밀번호의 `!`를 URL 인코딩:
```
postgresql://postgres.hjbmoncohuuwnywrpwpi:Opt2026%21%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

### 문제 2: 비밀번호 확인
- Supabase Settings → Database에서 비밀번호 확인
- 올바른 비밀번호인지 재확인

### 문제 3: 연결 문자열 형식
- 포트가 `5432`인지 확인 (Session pooler)
- 호스트가 올바른지 확인

---

## ✅ 체크리스트

- [ ] 연결 문자열 형식 확인
- [ ] 비밀번호 확인
- [ ] Railway Variables 탭에서 `DATABASE_URL` 추가
- [ ] 환경 변수 저장 확인
- [ ] Railway 재배포 확인




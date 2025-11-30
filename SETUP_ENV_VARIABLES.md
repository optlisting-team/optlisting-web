# Railway 환경 변수 설정 가이드

## 📋 단계별 가이드

### 1단계: Supabase 연결 문자열 준비

**Supabase 대시보드에서:**

1. https://supabase.com/dashboard 접속
2. `optlisting` 프로젝트 선택
3. 좌측 메뉴 → **Settings** → **Database**
4. **Connection string** 섹션 → **URI** 탭 선택
5. 연결 문자열 복사
   ```
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. **Database password** 섹션에서 비밀번호 확인
7. 연결 문자열에서 `[YOUR-PASSWORD]`를 실제 비밀번호로 교체

---

### 2단계: Railway 환경 변수 추가

**Railway 대시보드에서:**

1. https://railway.app 접속
2. 프로젝트 선택
3. **"Variables"** 탭 클릭
4. **"+ New Variable"** 버튼 클릭
5. 다음 입력:
   - **Key**: `DATABASE_URL`
   - **Value**: 위에서 준비한 연결 문자열 붙여넣기
6. **"Add"** 클릭
7. ✅ 완료!

---

## 🔧 Railway Variables 탭 위치

### 방법 1: 프로젝트 레벨 (모든 서비스 공유)
- Railway 대시보드 → 프로젝트 선택
- 상단 메뉴 → **"Variables"** 탭

### 방법 2: 서비스 레벨 (특정 서비스만)
- 프로젝트 → 서비스(web) 선택
- **"Variables"** 탭

**추천**: 프로젝트 레벨에서 설정 (모든 서비스에서 사용 가능)

---

## ⚠️ 중요: 비밀번호 URL 인코딩

비밀번호에 특수문자가 있으면 URL 인코딩 필요:

| 특수문자 | 인코딩 |
|---------|--------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `/` | `%2F` |
| `:` | `%3A` |
| 공백 | `%20` |

**예시:**
- 원래: `MyP@ss#123`
- 인코딩: `MyP%40ss%23123`

---

## ✅ 확인 방법

1. **Railway Variables 탭에서:**
   - `DATABASE_URL`이 목록에 있는지 확인
   - 값은 보안상 마스킹되어 표시됨

2. **배포 후:**
   - Railway Shell에서: `echo $DATABASE_URL` (값은 표시 안 됨)

---

## 🎯 빠른 체크리스트

- [ ] Supabase 연결 문자열 복사
- [ ] 비밀번호 확인
- [ ] 연결 문자열에 비밀번호 교체
- [ ] Railway Variables 탭 접속
- [ ] `DATABASE_URL` 환경 변수 추가
- [ ] 변수 저장 확인

---

## 📝 예시 연결 문자열

```
postgresql://postgres:YourPassword123@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres
```

**구성 요소:**
- `postgresql://` - 프로토콜
- `postgres` - 사용자명
- `YourPassword123` - 비밀번호 (실제 비밀번호로 교체)
- `db.lmgghdbsxycgddptvwtn.supabase.co` - 호스트
- `5432` - 포트
- `postgres` - 데이터베이스명

---

## 🆘 문제 해결

### 연결 오류?
- 비밀번호가 올바른지 확인
- URL 인코딩 확인 (특수문자)
- 연결 문자열 형식 확인

### 환경 변수가 안 보여요?
- Variables 탭 새로고침
- 프로젝트 레벨 vs 서비스 레벨 확인

### 재배포가 필요해요?
- 환경 변수 추가 후 Railway가 자동 재배포
- 필요시 수동 재배포 가능




# 🚀 Railway 환경 변수 빠른 설정

## ⚡ 5분 안에 설정하기

### 1️⃣ Supabase 연결 문자열 가져오기

1. https://supabase.com/dashboard → `optlisting` 프로젝트
2. Settings → Database → Connection string → **URI** 탭
3. 연결 문자열 복사
4. **비밀번호 확인**: Database password 섹션에서 비밀번호 확인
5. 연결 문자열에서 `[YOUR-PASSWORD]`를 실제 비밀번호로 교체

**예시:**
```
postgresql://postgres:YourPassword123@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres
```

---

### 2️⃣ Railway에 환경 변수 추가

1. **Railway 대시보드 접속**
   - https://railway.app → 프로젝트 선택

2. **Variables 탭 클릭**
   - 프로젝트 대시보드 → **"Variables"** 탭

3. **"+ New Variable" 클릭**
   - **Key**: `DATABASE_URL`
   - **Value**: 위에서 준비한 연결 문자열 붙여넣기
   - **"Add"** 클릭

4. **완료!** ✅
   - Railway가 자동으로 재배포합니다

---

## 🔍 확인 방법

Railway 대시보드 → Variables 탭에서:
- `DATABASE_URL`이 목록에 표시되는지 확인
- 값은 보안상 마스킹되어 표시됨

---

## ⚠️ 비밀번호에 특수문자가 있으면?

URL 인코딩 필요:

| 문자 | 인코딩 |
|------|--------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `/` | `%2F` |
| `:` | `%3A` |
| ` ` (공백) | `%20` |

**예시:**
- 원래 비밀번호: `MyP@ss#123`
- 인코딩 후: `MyP%40ss%23123`

---

## 🆘 문제 해결

### 연결 오류?
1. 비밀번호가 올바른지 확인
2. URL 인코딩 확인 (특수문자)
3. 연결 문자열 형식 확인 (`postgresql://`로 시작)

### 환경 변수가 안 보여요?
1. Variables 탭 새로고침
2. 프로젝트 레벨 vs 서비스 레벨 확인
3. Railway 재배포

---

## ✅ 다음 단계

환경 변수 설정 후:
1. Railway 배포 자동 진행
2. 배포 완료 대기
3. API 테스트: `https://your-app.railway.app/`




# Railway DATABASE_URL 환경 변수 설정

## 🔗 연결 문자열

### 원본 (특수문자 포함):
```
postgresql://postgres.hjbmoncohuuwnywrpwpi:Opt2026!!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

### URL 인코딩 버전 (안전):
```
postgresql://postgres.hjbmoncohuuwnywrpwpi:Opt2026%21%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

**참고:** `!` = `%21`

---

## 📝 Railway 설정 단계

### Step 1: Railway Variables 탭 열기
1. https://railway.app 접속
2. 프로젝트 선택
3. **"Variables"** 탭 클릭

### Step 2: 환경 변수 추가
1. **"+ New Variable"** 클릭
2. 다음 입력:
   - **Key**: `DATABASE_URL`
   - **Value**: 위 연결 문자열 중 하나 (원본 또는 인코딩 버전)
3. **"Add"** 클릭

### Step 3: 확인
- `DATABASE_URL`이 목록에 표시되는지 확인
- 값은 보안상 마스킹되어 표시됨

---

## ⚠️ 특수문자 처리

비밀번호에 `!`가 있는 경우:
- **대부분의 경우**: 원본 그대로 사용 가능
- **문제 발생 시**: URL 인코딩 사용 (`!` → `%21`)

**권장:**
1. 먼저 원본 연결 문자열로 시도
2. 연결 오류 발생 시 인코딩 버전 사용

---

## ✅ 완료 후 확인

### Railway 배포 로그 확인:
1. Railway 대시보드 → 프로젝트
2. "Deployments" 탭
3. 최신 배포 로그 확인
4. 데이터베이스 연결 성공 메시지 확인

### API 테스트:
1. 배포 완료 후 도메인 확인
2. `https://your-app.railway.app/` 접속
3. `{"message": "OptListing API is running"}` 응답 확인

---

## 🔧 문제 해결

### 연결 실패 시:
1. 비밀번호 확인
2. URL 인코딩 시도
3. 연결 문자열 형식 확인
4. Railway 로그 확인




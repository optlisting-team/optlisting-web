# 데이터베이스 비밀번호 찾기 (단계별)

## 현재 화면에서 할 일

### 1️⃣ 비밀번호 확인

**현재 화면 아래쪽을 보세요:**
- "Reset your database password" 섹션
- "Database Settings" 링크 클릭

또는:

1. **현재 화면 닫기** (X 버튼)
2. **Settings → Database** 메뉴로 이동
3. **"Database password"** 섹션 확인

---

## 비밀번호 찾는 3가지 방법

### 방법 1: 프로젝트 생성 시 비밀번호 사용
- 프로젝트 만들 때 입력한 비밀번호가 있습니다
- 그 비밀번호를 사용하세요!

### 방법 2: Settings에서 확인
1. Settings → Database
2. "Database password" 섹션
3. 비밀번호 표시 또는 확인

### 방법 3: 비밀번호 재설정 (가장 확실)
1. Settings → Database
2. "Database password" 섹션
3. **"Reset database password"** 클릭
4. 새 비밀번호 입력 (기억하기 쉬운 것으로!)
5. 저장

---

## 연결 문자열 완성하기

### 현재 연결 문자열:
```
postgresql://postgres.hjbmoncohuuwnywrpwpi:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### 예시 (비밀번호가 "MyPass123"인 경우):
```
postgresql://postgres.hjbmoncohuuwnywrpwpi:MyPass123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

---

## Railway 환경 변수 설정

1. **비밀번호 확인** (위 방법 중 하나)
2. **연결 문자열 복사** (현재 화면에서)
3. **비밀번호 교체**: `[YOUR-PASSWORD]` → 실제 비밀번호
4. **Railway Variables 탭** → "+ New Variable"
5. **Key**: `DATABASE_URL`
6. **Value**: 완성된 연결 문자열 붙여넣기
7. **Add** 클릭

---

## ⚠️ 특수문자가 있으면?

비밀번호에 `@`, `#`, `$` 등이 있으면 URL 인코딩 필요:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`

**온라인 인코더 사용 가능**: https://www.urlencoder.org/




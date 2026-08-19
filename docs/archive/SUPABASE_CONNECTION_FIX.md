# Supabase IPv6 연결 문제 해결 가이드

## 문제
Railway에서 Supabase 연결 시 IPv6 네트워크 에러 발생:
- `2406:da14:271:...` 같은 IPv6 주소로 연결 시도
- Railway/Docker 환경은 IPv4를 선호하여 충돌

## 해결책: Connection Pooler 사용

### 1단계: Supabase 대시보드 접속
1. https://supabase.com/dashboard 접속
2. "optlisting" 프로젝트 선택
3. **Settings** (톱니바퀴 아이콘) > **Database** 메뉴

### 2단계: Connection Pooler 주소 가져오기
1. **Connection string** 섹션 찾기
2. 상단 탭에서 **[ URI ]** 선택
3. **Mode: Transaction** 또는 **Use connection pool** 체크
   - 포트가 **5432** → **6543**으로 변경됨
   - 주소가 `db.xxxx.supabase.co` → `aws-0-xxxx.pooler.supabase.com`로 변경됨

### 3단계: 새 연결 문자열 복사
**포트 6543**이 포함된 주소를 복사하세요:

```
postgresql://postgres.lmgghdbsxycgddptvwtn:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

**중요:** `[YOUR-PASSWORD]`를 실제 Supabase 데이터베이스 비밀번호로 교체하세요!

### 4단계: Railway 환경 변수 수정
1. Railway 대시보드: https://railway.app
2. optlisting 프로젝트 선택
3. **Variables** 탭 클릭
4. 기존 `DATABASE_URL` 찾기
5. **Edit** 버튼 클릭
6. 방금 복사한 **포트 6543** 주소로 교체
7. **Save** 클릭

### 5단계: 재배포
- Railway가 자동으로 재배포를 시작합니다
- 또는 수동으로 **Deploy** 버튼 클릭

## 차이점

### ❌ 기존 (포트 5432 - IPv6 문제)
```
postgresql://postgres:[PASSWORD]@db.lmgghdbsxycgddptvwtn.supabase.co:5432/postgres
```

### ✅ 수정 (포트 6543 - Connection Pooler - IPv4)
```
postgresql://postgres.lmgghdbsxycgddptvwtn:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

## 확인 방법
1. Railway 로그에서 "Database tables created/verified successfully" 메시지 확인
2. `/api/dummy-data` 엔드포인트 테스트
3. Supabase 대시보드에서 연결 확인

## 추가 정보
- Connection Pooler는 IPv4를 지원하여 안정적입니다
- 연결 풀링으로 성능도 향상됩니다
- 포트 6543은 Transaction 모드용입니다




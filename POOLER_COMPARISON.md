# Supabase Connection Pooler 선택 가이드

## 현재 설정
- **Method**: Transaction pooler
- **Type**: URI
- **Source**: Primary Database

---

## 두 가지 Pooler 비교

### 1. Transaction Pooler (현재 선택)
**특징:**
- ✅ 서버리스 환경에 적합
- ✅ 짧은 연결에 최적화
- ✅ 각 요청이 독립적
- ⚠️ PREPARE statements 지원 안 함
- ⚠️ 트랜잭션 제한

**사용 시나리오:**
- Vercel Functions
- AWS Lambda
- 짧은 연결 요청

---

### 2. Session Pooler (추천)
**특징:**
- ✅ 장기 연결에 적합
- ✅ 전체 PostgreSQL 기능 지원
- ✅ PREPARE statements 지원
- ✅ 복잡한 트랜잭션 지원
- ✅ 연결 풀 유지

**사용 시나리오:**
- Railway (장기 실행 서버)
- FastAPI 백엔드
- SQLAlchemy ORM
- 지속적인 데이터베이스 연결

---

## 🎯 Railway + FastAPI에 맞는 선택

### 추천: Session Pooler

**이유:**
1. Railway는 장기 실행 서버
2. FastAPI는 지속적인 연결 유지
3. SQLAlchemy는 연결 풀 사용
4. 전체 PostgreSQL 기능 필요

---

## 설정 변경 방법

### Session Pooler로 변경:

1. **Method 드롭다운 클릭**
2. **"Session pooler" 선택**
3. 연결 문자열이 자동으로 업데이트됨

**변경 후 연결 문자열 형식:**
```
postgresql://postgres.hjbmoncohuuwnywrpwpi:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

**차이점:**
- Transaction pooler: 포트 `6543`
- Session pooler: 포트 `5432`

---

## 현재 설정 (Transaction Pooler)도 작동하나요?

✅ **네, 작동합니다!**

하지만:
- ❌ 일부 PostgreSQL 기능 제한
- ❌ PREPARE statements 사용 불가
- ⚠️ 복잡한 쿼리에서 문제 발생 가능

---

## 권장사항

### ✅ Session Pooler 사용 (추천)

**장점:**
- 모든 PostgreSQL 기능 사용 가능
- SQLAlchemy와 완벽 호환
- 안정적인 연결

**설정:**
1. Method → "Session pooler" 선택
2. 연결 문자열 복사
3. 비밀번호 교체
4. Railway 환경 변수에 설정

---

## 빠른 결정

### Railway + FastAPI = Session Pooler 추천! ✅

**변경 방법:**
- 현재 화면에서 "Method" 드롭다운
- "Session pooler" 선택
- 업데이트된 연결 문자열 사용




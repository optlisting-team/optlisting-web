# Supabase API 키가 필요한 경우

## 🔍 현재 상황 분석

### 현재 백엔드 구조
```
FastAPI (백엔드)
  ↓
SQLAlchemy + psycopg2
  ↓
PostgreSQL (Supabase 데이터베이스)
```

**결론**: API 키 불필요 ✅

---

## ❌ API 키가 필요 없는 이유

1. **직접 PostgreSQL 연결**
   - `DATABASE_URL`을 통해 PostgreSQL에 직접 연결
   - Supabase API를 거치지 않음

2. **SQLAlchemy 사용**
   - ORM으로 직접 데이터베이스 쿼리
   - Supabase 클라이언트 라이브러리 미사용

3. **순수 SQL 작업**
   - CREATE, SELECT, INSERT, UPDATE 등 직접 실행

---

## ✅ API 키가 필요한 경우

### 케이스 1: 프론트엔드에서 Supabase 사용

```javascript
// 프론트엔드에서 Supabase 클라이언트 사용
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xxxxx.supabase.co',  // SUPABASE_URL 필요
  'your-anon-key'              // SUPABASE_ANON_KEY 필요
)
```

**필요한 키:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (Publishable key)

**설정 위치:** Vercel 환경 변수

---

### 케이스 2: 백엔드에서 Supabase 기능 사용

```python
# 백엔드에서 Supabase 클라이언트 사용
from supabase import create_client

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)
```

**필요한 키:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Secret key)

**설정 위치:** Railway 환경 변수

**사용 예시:**
- Auth API 호출
- Storage API 호출
- Realtime 구독
- Edge Functions 호출

---

### 케이스 3: Supabase REST API 직접 호출

```bash
curl 'https://xxxxx.supabase.co/rest/v1/listings' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 🎯 현재 프로젝트

### 백엔드 (Railway)
- ❌ API 키 불필요
- ✅ `DATABASE_URL`만 필요

### 프론트엔드 (Vercel)
- 현재 Supabase 사용 여부 확인 필요
- 사용한다면 API 키 필요

---

## 📝 체크리스트

### 현재 필요한 것:
- [x] `DATABASE_URL` (Railway 환경 변수)
- [ ] API 키 (현재 불필요)

### 향후 필요할 수 있는 것:
- [ ] `SUPABASE_URL` (프론트엔드용)
- [ ] `SUPABASE_ANON_KEY` (프론트엔드용)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (백엔드 기능 확장용)

---

## 💡 권장사항

1. **지금은**: API 키 발급받지 않아도 됨
2. **나중을 위해**: 키는 언제든 발급 가능
3. **프론트엔드 확인**: 프론트엔드 코드에서 Supabase 사용 여부 확인




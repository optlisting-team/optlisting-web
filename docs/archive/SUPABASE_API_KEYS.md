# Supabase API 키 가이드

## 현재 상황

**백엔드는 API 키가 필요 없습니다!** ✅

현재 백엔드는:
- PostgreSQL에 직접 연결 (`DATABASE_URL`만 사용)
- Supabase API를 사용하지 않음
- SQLAlchemy로 직접 데이터베이스 접근

---

## API 키가 필요한 경우

### 1. 프론트엔드에서 Supabase 사용 시

프론트엔드에서 Supabase 클라이언트를 사용한다면:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (또는 `SUPABASE_PUBLIC_KEY`)

### 2. Supabase 기능 사용 시

다음 기능을 사용할 때 API 키 필요:
- **Auth** (인증)
- **Storage** (파일 저장)
- **Realtime** (실시간 업데이트)
- **Edge Functions**

---

## API 키 발급 방법

### 1. Supabase 대시보드 접속

1. https://supabase.com/dashboard 접속
2. `optlisting` 프로젝트 선택
3. Settings → **API Keys** (현재 페이지)

### 2. API 키 확인

**Publishable key (anon key):**
- 브라우저에서 안전하게 사용 가능
- Row Level Security (RLS)가 활성화되어 있어야 안전
- 프론트엔드에서 사용

**Secret key (service_role key):**
- ⚠️ **절대 브라우저에 노출하지 마세요!**
- 서버 사이드에서만 사용
- 모든 RLS 정책을 우회함

### 3. Legacy 키 (필요시)

"Legacy anon, service_role API keys" 탭에서:
- 기존 방식의 API 키 확인 가능

---

## Railway 환경 변수에 추가 (필요한 경우)

### 프론트엔드용 (Vercel 등)

Vercel 환경 변수에 추가:
```
VITE_SUPABASE_URL=https://lmgghdbsxycgddptvwtn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 백엔드용 (Railway) - 현재 불필요

현재 백엔드는 API 키가 필요 없지만, 향후 필요하면:
```
SUPABASE_URL=https://lmgghdbsxycgddptvwtn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

---

## 현재 필요한 것

✅ **DATABASE_URL만 있으면 됩니다!**
- Supabase Settings → Database → Connection string
- PostgreSQL 연결 문자열만 필요

---

## API 키 발급받아 두는 것도 좋은 이유

1. **향후 확장 가능성**
   - 나중에 Supabase 기능을 추가할 때 바로 사용 가능

2. **프론트엔드 연동**
   - 프론트엔드에서 Supabase를 사용할 때 필요

3. **대시보드 접근**
   - Supabase 대시보드에서 프로젝트 정보 확인 시 유용

---

## 요약

### 현재 (백엔드 배포):
- ❌ API 키 불필요
- ✅ `DATABASE_URL`만 필요

### 향후 (프론트엔드 또는 기능 확장):
- ✅ API 키 발급 받아두기 권장
- ✅ 환경 변수에 저장

---

## 다음 단계

1. ✅ **현재**: Railway에 `DATABASE_URL`만 설정
2. ⬜ **선택**: API 키 발급받아서 나중을 위해 저장
3. ⬜ **프론트엔드**: Supabase 사용 시 키 추가




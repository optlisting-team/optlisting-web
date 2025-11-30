# 새 Railway URL 설정 가이드

## 새 Railway URL
```
https://web-production-3dc73.up.railway.app
```

## 필요한 곳

### 1. Vercel Environment Variables (필수) ⭐

**위치**: Vercel 대시보드 → 프로젝트 → Settings → Environment Variables

**설정**:
- **Key**: `VITE_API_URL`
- **Value**: `https://web-production-3dc73.up.railway.app`
- **Environments**: Production, Preview, Development 모두 선택

**용도**: 프론트엔드가 백엔드 API를 호출할 때 사용
- `frontend/src/components/Dashboard.jsx`
- `frontend/src/components/QueueReviewPanel.jsx`
- 기타 API 호출하는 모든 컴포넌트

**코드에서 사용**:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

### 2. Railway Environment Variables (선택사항)

**위치**: Railway 대시보드 → 프로젝트 → Variables

**설정**:
- **Key**: `FRONTEND_URL`
- **Value**: Vercel 프론트엔드 URL (예: `https://optlisting.vercel.app`)

**용도**: CORS 설정용 (백엔드가 프론트엔드 요청을 허용)
- `backend/main.py`의 `allowed_origins`에 자동 추가됨

**참고**: 이미 `backend/main.py`에 Vercel URL이 하드코딩되어 있으면 선택사항

## 설정 단계

### Step 1: Vercel Environment Variables 설정

1. **Vercel 대시보드 접속**
   - https://vercel.com 접속
   - 프로젝트 선택

2. **Settings → Environment Variables**
   - 프로젝트 → Settings 탭
   - "Environment Variables" 섹션

3. **새 환경 변수 추가**
   - "+ Add New" 클릭
   - **Key**: `VITE_API_URL`
   - **Value**: `https://web-production-3dc73.up.railway.app`
   - **Environments**: Production, Preview, Development 모두 체크
   - "Save" 클릭

4. **재배포**
   - 환경 변수 추가 후 자동 재배포 또는 수동 재배포

### Step 2: Railway Environment Variables 설정 (선택사항)

1. **Railway 대시보드 접속**
   - https://railway.app 접속
   - 프로젝트 선택

2. **Variables 탭**
   - "Variables" 탭 클릭

3. **FRONTEND_URL 추가** (선택사항)
   - "+ New Variable" 클릭
   - **Key**: `FRONTEND_URL`
   - **Value**: Vercel 프론트엔드 URL
   - "Add" 클릭

## 확인 방법

### 1. Vercel 배포 후 확인
1. Vercel 대시보드 → Deployments
2. 최신 배포 완료 확인
3. 프론트엔드 접속 후 Network 탭에서 확인:
   - `web-production-3dc73.up.railway.app`로의 요청이 보여야 함

### 2. 브라우저 콘솔 확인
1. 프론트엔드 접속
2. 개발자 도구 → Console
3. `import.meta.env.VITE_API_URL` 확인 (또는 API 호출 로그 확인)

### 3. Network 탭 확인
1. 개발자 도구 → Network
2. API 요청 확인:
   - `https://web-production-3dc73.up.railway.app/api/...` 요청이 보여야 함

## 체크리스트

- [ ] Vercel Environment Variables에 `VITE_API_URL` 추가
- [ ] Value: `https://web-production-3dc73.up.railway.app`
- [ ] 모든 환경(Production, Preview, Development) 선택
- [ ] Vercel 재배포 완료
- [ ] Railway Environment Variables에 `FRONTEND_URL` 추가 (선택사항)
- [ ] 프론트엔드에서 API 호출 테스트
- [ ] Network 탭에서 Railway 요청 확인

## 문제 해결

### API 요청이 localhost로 가는 경우
- Vercel Environment Variables가 제대로 설정되지 않음
- 재배포 필요

### CORS 에러 발생 시
- Railway의 `FRONTEND_URL` 환경 변수 확인
- 또는 `backend/main.py`의 `allowed_origins`에 Vercel URL 추가

### 404 에러 발생 시
- Railway URL이 올바른지 확인
- Railway 배포 상태 확인


# Vercel 배포 가이드

## 프론트엔드를 Vercel에 배포하여 더미 데이터 확인하기

### ✅ 배포 가능 여부

**가능합니다!** 프론트엔드를 Vercel에 배포하고, Railway 백엔드 API를 연결하면 됩니다.

---

## 📋 사전 준비사항

1. **Vercel 계정**: https://vercel.com 에서 가입
2. **GitHub 저장소**: 코드가 GitHub에 푸시되어 있어야 함
3. **Railway 백엔드 URL**: 백엔드가 Railway에 배포되어 있어야 함

---

## 🚀 배포 단계

### 1단계: GitHub에 코드 푸시

```bash
git add .
git commit -m "feat: Prepare for Vercel deployment"
git push origin main
```

### 2단계: Vercel 프로젝트 연결

1. https://vercel.com 접속
2. "Add New Project" 클릭
3. GitHub 저장소 선택
4. 프로젝트 설정:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend` (또는 프로젝트 루트)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`

### 3단계: 환경 변수 설정

Vercel 프로젝트 설정에서 **Environment Variables** 추가:

- **Key**: `VITE_API_URL`
- **Value**: `https://your-railway-backend-url.railway.app` (Railway 백엔드 URL)
- **Environment**: Production, Preview, Development 모두 선택

### 4단계: 배포

"Deploy" 버튼 클릭 → 자동으로 빌드 및 배포 시작

---

## 🔗 Railway 백엔드 연결

### Railway 백엔드 URL 확인

1. Railway 대시보드 접속
2. 백엔드 프로젝트 선택
3. "Settings" → "Domains" 에서 URL 확인
   - 예: `https://optlisting-backend.railway.app`

### CORS 설정 확인

Railway 백엔드의 `backend/main.py`에서 CORS 설정 확인:

```python
cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", ""),  # Vercel URL 추가
]
```

Vercel 배포 URL을 `FRONTEND_URL` 환경 변수로 추가하거나, `cors_origins`에 직접 추가하세요.

---

## ✅ 배포 확인

### 1. Vercel 배포 완료 후

- Vercel 대시보드에서 배포 URL 확인
- 예: `https://optlisting.vercel.app`

### 2. 브라우저에서 확인

- 배포 URL 접속
- 더미 데이터가 표시되는지 확인
- API 연결 상태 확인 (Navbar의 "API Connected" 배지)

### 3. 문제 해결

**데이터가 안 보이면:**
1. 브라우저 개발자 도구 (F12) → Console 탭에서 에러 확인
2. Network 탭에서 API 요청 확인
3. `VITE_API_URL` 환경 변수가 제대로 설정되었는지 확인

**CORS 에러가 나면:**
- Railway 백엔드의 CORS 설정에 Vercel URL 추가
- 백엔드 재배포

---

## 📝 요약

1. ✅ 프론트엔드를 Vercel에 배포 가능
2. ✅ 더미 데이터는 Railway 백엔드 데이터베이스에서 가져옴
3. ✅ `VITE_API_URL` 환경 변수로 백엔드 연결
4. ✅ CORS 설정 필요

---

## 🎯 빠른 배포 명령어

```bash
# 1. GitHub에 푸시
git add .
git commit -m "deploy: Vercel 배포 준비"
git push

# 2. Vercel CLI로 배포 (선택사항)
npm i -g vercel
cd frontend
vercel
```

---

## 💡 추가 팁

- **자동 배포**: GitHub에 푸시하면 자동으로 재배포됨
- **프리뷰 배포**: Pull Request 생성 시 프리뷰 URL 생성됨
- **환경 변수**: 프로덕션/프리뷰/개발 환경별로 다른 값 설정 가능




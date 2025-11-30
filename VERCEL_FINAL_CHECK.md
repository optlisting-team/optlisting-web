# Vercel 배포 최종 확인

## ✅ 현재 설정 확인

### 올바르게 설정됨:
- ✅ Repository: `optlisting-team/optlisting-`
- ✅ Branch: `develop`
- ✅ Directory: `frontend`
- ✅ Root Directory: `frontend`
- ✅ Project Name: `optlisting`

---

## ⚠️ 확인 필요 사항

### 1. Framework Preset
- **현재**: "Other"
- **권장**: "Vite"로 변경

**변경 방법:**
- Framework Preset 드롭다운 클릭
- "Vite" 선택

### 2. Build Settings 확인
- **"Build and Output Settings" 클릭** (확장)

확인할 것:
- **Build Command**: `npm run build` (자동 감지)
- **Output Directory**: `dist` (자동 감지)
- **Install Command**: `npm install` (자동 감지)

### 3. Environment Variables 추가 ⚠️ 중요!

- **"Environment Variables" 섹션 찾기**
- 환경 변수 추가:
  - **Key**: `VITE_API_URL`
  - **Value**: Railway 백엔드 URL
    - 예: `https://your-app.railway.app`
    - Railway 대시보드에서 도메인 확인
  - **Environments**: 
    - ✅ Production
    - ✅ Preview
    - ✅ Development

---

## 🚀 배포 전 체크리스트

### 필수:
- [ ] Framework Preset: "Vite"로 변경 (선택사항)
- [ ] Build Settings 확인: Build Command, Output Directory
- [ ] **Environment Variables 추가**: `VITE_API_URL` (Railway 백엔드 URL)

### 선택사항:
- [ ] Install Command 확인: `npm install`
- [ ] Node Version 확인 (필요시)

---

## 📝 Environment Variables 예시

Railway 백엔드 도메인이 있다면:
```
VITE_API_URL=https://optlisting-production.up.railway.app
```

아직 Railway 도메인을 모르면:
1. 먼저 Deploy 클릭 (배포 진행 가능)
2. 나중에 Environment Variables에서 추가
3. 다시 배포

---

## ✅ 배포 방법

### 방법 1: Environment Variables 추가 후 배포 (권장)
1. Environment Variables 섹션 찾기
2. `VITE_API_URL` 추가
3. "Deploy" 버튼 클릭

### 방법 2: 일단 배포 후 나중에 추가
1. "Deploy" 버튼 클릭
2. 배포 완료 후 Settings → Environment Variables에서 추가
3. 다시 배포

---

## 🎯 지금 할 일

1. **"Build and Output Settings" 확장** → 확인
2. **"Environment Variables" 찾기** → `VITE_API_URL` 추가 (Railway URL)
3. **Framework Preset을 "Vite"로 변경** (선택사항)
4. **"Deploy" 버튼 클릭**

준비되면 "Deploy" 버튼을 클릭하세요!




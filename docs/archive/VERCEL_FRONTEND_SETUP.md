# Vercel 프론트엔드 배포 설정

## 현재 상황

- **Framework Preset**: FastAPI (잘못 감지됨 ❌)
- **실제 프론트엔드**: React + Vite ✅
- **백엔드**: FastAPI (Railway에 배포)

---

## 올바른 설정

### 1. Framework Preset 변경
- **현재**: FastAPI ❌
- **변경**: **Vite** 또는 **Other** 선택

### 2. Root Directory 변경
- **현재**: `./` ❌
- **변경**: `frontend` ✅

### 3. Build Settings 확인
- Build Command: `npm run build`
- Output Directory: `dist`

---

## 단계별 설정

### Step 1: Framework Preset
1. **Framework Preset 드롭다운 클릭**
2. **"Vite"** 선택
   - 또는 "Other" 선택 후 수동 설정

### Step 2: Root Directory
1. **Root Directory 필드 옆 "Edit" 버튼 클릭**
2. **`frontend` 입력**
   - 또는 드롭다운에서 선택

### Step 3: Build Settings (확장)
1. **"Build and Output Settings" 클릭** (확장)
2. 확인:
   - **Build Command**: `npm run build` (또는 자동 감지)
   - **Output Directory**: `dist` (또는 자동 감지)

### Step 4: Environment Variables (확장)
1. **"Environment Variables" 클릭** (확장)
2. 환경 변수 추가:
   - **Key**: `VITE_API_URL`
   - **Value**: Railway 백엔드 URL (예: `https://your-app.railway.app`)
   - **Environments**: Production, Preview, Development 모두 선택

---

## 완성된 설정

```
Vercel Team: optlisting's projects / Hobby
Project Name: optlisting
Framework Preset: Vite ✅
Root Directory: frontend ✅
Build Command: npm run build
Output Directory: dist
Environment Variables:
  - VITE_API_URL: https://your-railway-backend.railway.app
```

---

## Deploy 버튼 클릭 전 체크리스트

- [ ] Framework Preset: Vite로 변경
- [ ] Root Directory: `frontend`로 변경
- [ ] Build Settings 확인 (자동 감지되면 OK)
- [ ] Environment Variables 추가 (`VITE_API_URL`)

---

## 참고

### 왜 FastAPI가 감지되었나요?
- Vercel이 루트 디렉토리의 `requirements.txt`를 보고 FastAPI로 감지
- 프론트엔드는 `frontend` 폴더 안에 있음

### 해결 방법:
- Root Directory를 `frontend`로 변경하면 자동으로 Vite로 감지됨
- 또는 Framework Preset을 직접 Vite로 선택




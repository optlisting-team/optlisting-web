# Vercel Build Settings 수정 가이드

## 현재 설정 확인

### ✅ 올바른 설정:
- Framework Preset: Vite ✅
- Root Directory: `frontend` ✅
- Project Name: `optlisting` ✅

### ⚠️ 수정 필요:

#### 1. Build Command
- **현재**: `cd frontend && npm install && npm run build`
- **문제**: Root Directory가 이미 `frontend`이므로 `cd frontend` 불필요
- **수정**: `npm run build` 또는 `npm install && npm run build`

#### 2. Output Directory
- **현재**: `frontend/dist`
- **문제**: Root Directory가 `frontend`이므로 상대 경로는 `dist`
- **수정**: `dist`

---

## 수정 방법

### Build Command 수정:
1. Build Command 필드 옆 **연필 아이콘(Edit)** 클릭
2. 내용을 다음으로 변경:
   ```
   npm run build
   ```
   또는
   ```
   npm install && npm run build
   ```

### Output Directory 수정:
1. Output Directory 필드 옆 **연필 아이콘(Edit)** 클릭
2. 내용을 다음으로 변경:
   ```
   dist
   ```

---

## 올바른 최종 설정

```
Framework Preset: Vite ✅
Root Directory: frontend ✅
Build Command: npm run build ✅
Output Directory: dist ✅
Install Command: npm install (기본값) ✅
```

---

## Environment Variables 확인

배포 전에 Environment Variables도 확인하세요:
- Key: `VITE_API_URL`
- Value: Railway 백엔드 URL

---

## 수정 후

1. Build Command와 Output Directory 수정
2. Environment Variables 확인/추가
3. "Deploy" 버튼 클릭




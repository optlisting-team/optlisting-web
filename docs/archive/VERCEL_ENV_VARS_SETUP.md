# Vercel Environment Variables 설정

## 현재 상황

- Environment Variables가 비어있음
- 프론트엔드가 `VITE_API_URL`을 사용하므로 추가 필요

---

## Environment Variables 추가 방법

### 방법 1: 배포 전에 추가 (권장)

1. **"Environment Variables" 섹션 찾기**
   - 현재 화면에서 "Environment Variables" 섹션 찾기
   - 또는 "Build and Output Settings" 아래에 있을 수 있음
   - 확장 가능한 섹션이면 클릭해서 펼치기

2. **환경 변수 추가**
   - "+ Add" 또는 "Add Variable" 버튼 클릭
   - 다음 입력:
     - **Key**: `VITE_API_URL`
     - **Value**: Railway 백엔드 URL
       - 예: `https://your-app.railway.app`
       - Railway 대시보드에서 도메인 확인 필요
     - **Environments**: 
       - ✅ Production
       - ✅ Preview  
       - ✅ Development

---

## Railway 백엔드 URL 확인

### Railway 도메인이 있는 경우:
1. Railway 대시보드 접속
2. 프로젝트 선택
3. Settings → Networking
4. 도메인 확인 또는 "Generate Domain" 클릭
5. 복사한 URL을 `VITE_API_URL`에 입력

### Railway 도메인이 아직 없는 경우:
1. **일단 배포 진행** (Environment Variables 없이)
2. Railway에서 도메인 생성
3. Vercel Settings → Environment Variables에서 추가
4. 재배포

---

## 방법 2: 배포 후 추가

1. **일단 "Deploy" 버튼 클릭**
2. 배포 완료 후
3. Vercel 프로젝트 → Settings → Environment Variables
4. `VITE_API_URL` 추가
5. 재배포

---

## Environment Variables 위치 찾기

현재 화면에서:
- "Build and Output Settings" 아래
- 또는 별도 섹션으로 표시
- 확장 가능한 섹션이면 클릭해서 펼치기

---

## 빠른 해결책

### 옵션 1: Railway 도메인 확인 후 추가
1. Railway 대시보드 → Settings → Networking
2. 도메인 확인/생성
3. Vercel Environment Variables에 추가
4. 배포

### 옵션 2: 일단 배포 후 추가
1. "Deploy" 버튼 클릭
2. 배포 완료 후 Settings에서 추가
3. 재배포

---

## Environment Variables 예시

```
Key: VITE_API_URL
Value: https://optlisting-production.up.railway.app
Environments: Production, Preview, Development 모두 선택
```

---

## 현재 화면에서 찾기

Environment Variables 섹션이 보이지 않으면:
1. 페이지를 아래로 스크롤
2. "Environment Variables" 섹션 찾기
3. 확장 가능하면 클릭해서 펼치기
4. "+ Add" 또는 "Add Variable" 버튼 클릭

---

## 추천

**Railway 도메인을 먼저 확인하고 추가하는 것을 권장합니다!**

Railway 대시보드에서 도메인을 확인할 수 있나요?




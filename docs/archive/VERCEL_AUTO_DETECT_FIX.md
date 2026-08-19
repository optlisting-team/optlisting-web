# Vercel 자동 감지 설정 해결 방법

## 현재 상황

- Build Command와 Output Directory가 자동 감지되어 수정 불가
- Root Directory: `frontend`
- Build Command: `cd frontend && npm install && npm run build`
- Output Directory: `frontend/dist`

---

## 해결 방법

### 방법 1: Root Directory를 루트로 변경 (추천)

1. **Root Directory 필드 옆 "Edit" 버튼 클릭**
2. **`./` 또는 `.` 입력** (프로젝트 루트)
3. 그러면 Build Command와 Output Directory가 자동으로 업데이트됨
4. Build Command: `cd frontend && npm install && npm run build` (그대로 유지)
5. Output Directory: `frontend/dist` (그대로 유지)

**장점**: 자동 감지된 설정 그대로 사용 가능

---

### 방법 2: 그대로 배포해보기

현재 설정으로 배포해보고, 문제가 있으면 나중에 수정:

1. **"Deploy" 버튼 클릭**
2. 배포 로그 확인
3. 문제 발생 시 Settings에서 수정

**가능성**: Root Directory가 `frontend`인데 Build Command에 `cd frontend`가 있으면 중복이지만, Vercel이 자동으로 처리할 수도 있음

---

### 방법 3: Settings에서 나중에 수정

1. 일단 배포 진행
2. 배포 완료 후 Settings → General
3. Build & Development Settings에서 수정

---

## 추천 방법

### 방법 1 시도 (Root Directory 변경):

1. **Root Directory "Edit" 클릭**
2. **`.` 또는 `./` 입력** (프로젝트 루트)
3. 그러면 Build Command가 올바르게 설정될 수 있음

또는

### 그대로 배포:

- 현재 설정으로 "Deploy" 클릭
- Vercel이 자동으로 처리할 수 있음
- 문제 발생 시 나중에 수정

---

## 확인 사항

배포 전에:
- [ ] Environment Variables 확인 (`VITE_API_URL` 추가)
- [ ] Root Directory 설정 확인
- [ ] Build Settings 확인

---

## 빠른 결정

**추천**: Root Directory를 `.`로 변경해보거나, 그대로 배포해보세요!

Vercel이 자동으로 처리할 가능성이 높습니다. 🚀




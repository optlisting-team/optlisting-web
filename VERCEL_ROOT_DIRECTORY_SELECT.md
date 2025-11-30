# Vercel Root Directory 선택 가이드

## 현재 모달 화면

보이는 옵션:
- `optlisting-` (현재 선택됨) ← 이것이 프로젝트 루트일 수 있음
- `backend`
- `frontend`

---

## `.` (프로젝트 루트) 찾기

### 방법 1: "optlisting-"이 루트
- **"optlisting-"**이 실제로 프로젝트 루트를 의미할 수 있음
- 이 경우 "optlisting-" 선택 후 "Continue" 클릭
- 그 다음 Build Command에서 `cd frontend` 부분 제거 필요

### 방법 2: 목록 위로 스크롤
- 모달 내부를 **위로 스크롤**
- `.` 또는 `./` 옵션이 맨 위에 있을 수 있음

### 방법 3: 직접 입력
- 일부 Vercel 버전에서는 직접 입력 가능
- 입력 필드가 있으면 `.` 입력 시도

---

## 추천 방법

### 옵션 1: "optlisting-" 선택 (루트로 간주)
1. **"optlisting-" 선택** (이미 선택됨)
2. **"Continue" 클릭**
3. Build Command 수정:
   - `cd frontend && npm install && npm run build` 
   - → `cd frontend && npm install && npm run build` (그대로 유지)
   - 또는 Root Directory를 루트로 설정했다면 Build Command를 `npm run build`로 변경

### 옵션 2: "frontend" 선택
1. **"frontend" 선택**
2. **"Continue" 클릭**
3. Build Command 자동 업데이트 확인:
   - `npm run build`로 변경될 수 있음
   - Output Directory: `dist`로 변경될 수 있음

---

## 현재 상황 분석

**"optlisting-"이 선택된 상태:**
- 이것이 프로젝트 루트라면
- Build Command: `cd frontend && npm install && npm run build` (올바름)
- Output Directory: `frontend/dist` (올바름)

**"frontend"를 선택하면:**
- Root Directory: `frontend`
- Build Command: `npm run build` (자동 변경)
- Output Directory: `dist` (자동 변경)

---

## 빠른 결정

### 추천: "frontend" 선택 ✅

**이유:**
- 프론트엔드만 배포하므로
- Build Command가 자동으로 올바르게 설정됨
- Output Directory도 자동으로 `dist`로 설정됨

**방법:**
1. **"frontend" 라디오 버튼 클릭**
2. **"Continue" 클릭**
3. 설정 자동 업데이트 확인
4. Deploy 버튼 활성화 확인

---

## 또는

**"optlisting-" 유지:**
1. **"Continue" 클릭** (현재 선택 유지)
2. Build Command 확인
3. 필요시 수정

---

## 요약

**질문**: `.` 어디 있냐?

**답변**: 
- "optlisting-"이 프로젝트 루트일 수 있음
- 또는 목록 위로 스크롤해서 찾기
- **추천**: "frontend" 선택 (프론트엔드 배포에 최적)

**지금 할 일**: "frontend" 선택 후 "Continue" 클릭! ✅




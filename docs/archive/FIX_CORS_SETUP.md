# CORS 설정 수정 가이드

## 현재 상황

### 백엔드 CORS 설정:
- 하드코딩된 도메인: `https://optlisting.vercel.app` 등
- 실제 Vercel 도메인과 다를 수 있음
- `FRONTEND_URL` 환경 변수 지원 코드 있음 ✅

---

## 방법 1: Railway 환경 변수 추가 (권장 ✅)

### 장점:
- 코드 수정 불필요
- 환경별로 다른 URL 사용 가능
- 더 유연함

### 설정 방법:

1. **실제 Vercel 도메인 확인**
   - Vercel 대시보드 → 프로젝트
   - 배포된 사이트 URL 확인
   - 예: `https://optlisting-xxxxx.vercel.app` 또는 커스텀 도메인

2. **Railway 환경 변수 추가**
   - Railway 대시보드 → 프로젝트 선택
   - **Variables** 탭
   - **"+ New Variable"** 클릭
   - 입력:
     - **Key**: `FRONTEND_URL`
     - **Value**: 실제 Vercel 도메인
       - 예: `https://optlisting-xxxxx.vercel.app`
     - **"Add"** 클릭

3. **Railway 재배포**
   - 환경 변수 추가 후 자동 재배포
   - 또는 수동 재배포

---

## 방법 2: backend/main.py에 직접 추가

### 장점:
- 빠르고 간단
- 코드에 명시적으로 표시

### 설정 방법:

1. **실제 Vercel 도메인 확인**
   - Vercel 대시보드에서 배포된 URL 확인

2. **backend/main.py 수정**
   - `allowed_origins` 리스트에 실제 도메인 추가

---

## 실제 Vercel 도메인 확인 방법

### Vercel에서:
1. Vercel 대시보드 → 프로젝트 선택
2. **Deployments** 탭
3. 최신 배포의 **"Visit"** 버튼 클릭
4. 또는 프로젝트 Overview에서 도메인 확인
5. URL 복사

**예시 도메인 형식:**
- `https://optlisting-xxxxx.vercel.app`
- `https://optlisting.vercel.app` (커스텀 도메인)

---

## 빠른 해결 (방법 1 권장)

### Step 1: Vercel 도메인 확인
- Vercel 대시보드에서 실제 배포된 URL 확인

### Step 2: Railway 환경 변수 추가
- Key: `FRONTEND_URL`
- Value: 실제 Vercel 도메인

### Step 3: Railway 재배포
- 자동 또는 수동 재배포

---

## 확인 방법

### 재배포 후:
1. 브라우저에서 Vercel 사이트 접속
2. Dashboard 접속 시도
3. Network 탭에서 CORS 오류 확인
4. CORS 오류가 없으면 성공! ✅

---

## 요약

**추천 방법**: Railway 환경 변수에 `FRONTEND_URL` 추가

**절차**:
1. Vercel 도메인 확인
2. Railway Variables에 `FRONTEND_URL` 추가
3. Railway 재배포




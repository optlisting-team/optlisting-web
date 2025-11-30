# CORS 설정 수정 가이드

## 현재 CORS 설정 상태

### ✅ 이미 설정된 것:
- `allow_origin_regex=vercel_regex` → 모든 Vercel 도메인 허용 (`https://.*\.vercel\.app`)
- `FRONTEND_URL` 환경 변수 지원 코드 있음

### ⚠️ 하지만 더 명시적으로 설정하는 것이 좋음

---

## 방법 1: Railway 환경 변수 추가 (권장 ✅)

### 장점:
- 코드 수정 불필요
- 환경별로 다른 URL 사용 가능
- 더 명시적이고 안전

### 설정:

1. **실제 Vercel 도메인 확인**
   - Vercel 대시보드 → 프로젝트
   - 배포된 사이트 URL 확인
   - 예: `https://optlisting-xxxxx.vercel.app`

2. **Railway 환경 변수 추가**
   - Railway → 프로젝트 → Variables 탭
   - "+ New Variable" 클릭
   - 입력:
     - **Key**: `FRONTEND_URL`
     - **Value**: 실제 Vercel 도메인
       - 예: `https://optlisting-xxxxx.vercel.app`
   - "Add" 클릭

3. **Railway 재배포**
   - 자동 또는 수동 재배포

---

## 방법 2: backend/main.py에 직접 추가

### 실제 Vercel 도메인을 allowed_origins에 추가

1. **Vercel 도메인 확인**
2. **backend/main.py 수정**

---

## 실제 Vercel 도메인 확인

### Vercel 대시보드에서:
1. 프로젝트 선택
2. **Deployments** 탭 또는 **Overview**
3. 배포된 URL 확인
4. "Visit" 버튼 클릭하거나 URL 복사

**도메인 형식:**
- `https://optlisting-xxxxx.vercel.app` (자동 생성)
- `https://optlisting.vercel.app` (커스텀)

---

## 빠른 해결 (방법 1 권장)

### Step 1: Vercel 도메인 확인
- Vercel 대시보드에서 실제 URL 확인

### Step 2: Railway 환경 변수 추가
```
Key: FRONTEND_URL
Value: https://your-actual-vercel-domain.vercel.app
```

### Step 3: Railway 재배포
- Variables 저장 후 자동 재배포 또는 수동 재배포

---

## 확인

재배포 후:
1. Vercel 사이트 접속
2. Dashboard 접속
3. Network 탭에서 CORS 오류 확인
4. CORS 오류 없으면 성공! ✅

---

## 참고

현재 코드는 이미 `allow_origin_regex`로 모든 Vercel 도메인을 허용하지만, `FRONTEND_URL` 환경 변수를 추가하면 더 명시적이고 안전합니다.




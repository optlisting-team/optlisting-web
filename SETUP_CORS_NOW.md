# CORS 설정 - 지금 바로 하기

## 현재 상태

### ✅ 이미 설정된 것:
- `allow_origin_regex`로 모든 Vercel 도메인 허용 (`https://.*\.vercel\.app`)
- `FRONTEND_URL` 환경 변수 지원 코드 있음

### 하지만 더 명시적으로 설정하는 것이 좋습니다!

---

## 🚀 빠른 해결 (2단계)

### 1단계: 실제 Vercel 도메인 확인

**Vercel 대시보드에서:**
1. 프로젝트 선택
2. **Deployments** 탭 또는 **Overview**
3. 배포된 URL 확인
   - 예: `https://optlisting-xxxxx.vercel.app`
   - 또는 커스텀 도메인

**또는:**
- 배포 완료 화면에서 "Visit" 버튼 클릭
- 브라우저 주소창에서 URL 확인

---

### 2단계: Railway 환경 변수 추가

**Railway에서:**
1. Railway 대시보드 → 프로젝트 선택
2. **Variables** 탭
3. **"+ New Variable"** 클릭
4. 입력:
   - **Key**: `FRONTEND_URL`
   - **Value**: 실제 Vercel 도메인
     - 예: `https://optlisting-xxxxx.vercel.app`
   - **"Add"** 클릭

5. **Railway 재배포**
   - Variables 저장 후 자동 재배포
   - 또는 수동 재배포

---

## ✅ 확인

재배포 후:
1. Vercel 사이트 접속
2. Dashboard 접속 시도
3. Network 탭에서 CORS 오류 확인
4. CORS 오류 없으면 성공! ✅

---

## 📝 요약

**할 일:**
1. Vercel 도메인 확인
2. Railway Variables에 `FRONTEND_URL` 추가
3. Railway 재배포

**시간:** 2-3분

---

## 💡 참고

현재 코드는 이미 모든 Vercel 도메인을 허용하지만, `FRONTEND_URL`을 추가하면 더 명시적이고 안전합니다!




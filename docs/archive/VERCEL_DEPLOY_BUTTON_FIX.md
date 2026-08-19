# Vercel Deploy 버튼 활성화 문제 해결

## Deploy 버튼이 비활성화되는 이유

### 가능한 원인:
1. **필수 설정 누락**
2. **저장소 연결 문제**
3. **설정 검증 실패**
4. **Environment Variables 필수인 경우**

---

## 해결 방법

### 1. Environment Variables 확인

1. **"Environment Variables" 섹션 클릭** (확장)
2. 환경 변수가 필요한지 확인
3. 필요하면 추가:
   - Key: `VITE_API_URL`
   - Value: `https://web-production-3dc73.up.railway.app`

### 2. Build Settings 확인

현재 설정:
- Build Command: `cd frontend && npm install && npm run build`
- Output Directory: `frontend/dist`

**문제 가능성**: Root Directory가 `frontend`인데 Build Command에 `cd frontend`가 있으면 중복

**해결 시도**:
- Root Directory를 `.` (루트)로 변경해보기
- 또는 Build Command를 `npm run build`로 변경 시도

### 3. 저장소 연결 확인

- GitHub 저장소가 제대로 연결되었는지 확인
- 브랜치(`develop`)가 올바른지 확인

### 4. 필수 필드 확인

- Project Name이 입력되어 있는지 확인 ✅
- Framework Preset이 선택되어 있는지 확인 ✅
- Root Directory가 설정되어 있는지 확인 ✅

---

## 빠른 해결 시도

### 시도 1: Root Directory 변경

1. **Root Directory "Edit" 클릭**
2. **`.` 또는 `./` 입력** (프로젝트 루트)
3. Build Command가 자동으로 업데이트되는지 확인
4. Deploy 버튼 활성화 확인

### 시도 2: Environment Variables 추가

1. **"Environment Variables" 섹션 확장**
2. **환경 변수 추가** (필수일 수 있음)
3. Deploy 버튼 활성화 확인

### 시도 3: 페이지 새로고침

1. **브라우저 새로고침** (F5)
2. 설정 다시 확인
3. Deploy 버튼 활성화 확인

---

## 일반적인 해결책

### 가장 가능성 높은 원인:

**Root Directory와 Build Command 불일치**

**해결:**
1. Root Directory를 `.` (루트)로 변경
2. Build Command는 그대로 유지: `cd frontend && npm install && npm run build`
3. Output Directory는 그대로: `frontend/dist`

또는

1. Root Directory는 `frontend` 유지
2. Build Command를 `npm run build`로 변경 (연필 아이콘 클릭 가능한지 확인)

---

## 체크리스트

- [ ] Root Directory 설정 확인
- [ ] Build Command 확인
- [ ] Output Directory 확인
- [ ] Environment Variables 확인 (필요시)
- [ ] 저장소 연결 확인
- [ ] 페이지 새로고침 시도

---

## 빠른 테스트

1. **Root Directory를 `.`로 변경** 시도
2. Deploy 버튼 활성화 확인
3. 안 되면 **Environment Variables 추가** 시도
4. 그래도 안 되면 **페이지 새로고침**

---

## 요약

**가장 가능성 높은 해결책:**
- Root Directory를 `.` (프로젝트 루트)로 변경
- Build Command는 `cd frontend && npm install && npm run build` 유지

**또는:**
- Environment Variables 섹션 확장
- `VITE_API_URL` 추가

어떤 방법을 시도해볼까요?




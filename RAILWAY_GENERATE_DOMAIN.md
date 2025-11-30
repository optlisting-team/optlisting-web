# Railway 도메인 생성 가이드

## 현재 상황

- Railway 서비스가 배포되었지만 도메인이 없음
- "Unexposed service" 상태
- 도메인을 생성해야 Vercel에서 연결 가능

---

## 도메인 생성 방법

### 방법 1: Settings에서 생성 (추천)

1. **Railway 대시보드 접속**
   - 현재 프로젝트 선택

2. **Settings 탭 클릭**
   - 상단 탭에서 "Settings" 선택

3. **Networking 섹션 찾기**
   - Settings 페이지에서 "Networking" 또는 "Domains" 섹션 찾기

4. **Generate Domain 클릭**
   - "Generate Domain" 버튼 클릭
   - 자동으로 도메인 생성됨
   - 예: `https://optlisting-production.up.railway.app`

5. **도메인 복사**
   - 생성된 도메인 URL 복사

---

### 방법 2: 서비스에서 직접 생성

1. **서비스(web) 선택**
2. **Settings 탭**
3. **Networking 섹션**
4. **"Generate Domain" 클릭**

---

## 도메인 생성 후

### Vercel Environment Variables에 추가:

1. **Vercel로 돌아가기**
2. **Environment Variables 섹션 찾기**
3. **환경 변수 추가:**
   - Key: `VITE_API_URL`
   - Value: 생성된 Railway 도메인
     - 예: `https://optlisting-production.up.railway.app`
   - Environments: Production, Preview, Development 모두 선택

---

## Limited Access 경고

화면에 "Limited Access" 경고가 보이는데:
- 무료 플랜 제한일 수 있음
- 하지만 도메인 생성은 가능할 수 있음
- "Generate Domain" 버튼이 있으면 클릭해보세요

---

## 빠른 단계

1. Railway → Settings → Networking
2. "Generate Domain" 클릭
3. 생성된 도메인 복사
4. Vercel Environment Variables에 추가
5. Vercel 배포

---

## 도메인 생성이 안 될 때

### 확인 사항:
- [ ] 서비스가 배포되었는지 확인
- [ ] 배포가 완료되었는지 확인
- [ ] "Generate Domain" 버튼이 있는지 확인

### 대안:
- 일단 Vercel 배포 진행 (Environment Variables 없이)
- Railway 도메인 생성 후 나중에 추가
- 재배포

---

## 요약

**지금 할 일:**
1. Railway Settings → Networking
2. "Generate Domain" 클릭
3. 도메인 복사
4. Vercel Environment Variables에 추가

**도메인 생성 위치:**
- Railway → 프로젝트 → Settings → Networking
- 또는 서비스(web) → Settings → Networking




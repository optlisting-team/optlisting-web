# Vercel 재배포 필요

## 현재 상황

- ✅ Environment Variables 설정됨: `VITE_API_URL = https://web-production-3dc73.up.railway.app`
- ❌ Network 탭에서 Railway 백엔드 요청이 보이지 않음

### 문제 원인:
**Vite는 빌드 타임에 환경 변수를 번들에 포함시킵니다!**
- Environment Variables를 추가한 후에는 **재배포**가 필요합니다
- 현재 배포는 Environment Variables 추가 전에 빌드되었을 가능성

---

## 해결 방법: 재배포

### 방법 1: Vercel에서 재배포

1. **Vercel 대시보드 → 프로젝트 선택**
2. **Deployments 탭** 클릭
3. **최신 배포 옆 "..." 메뉴** 클릭
4. **"Redeploy"** 선택
5. 또는 **"Redeploy" 버튼** 직접 클릭

### 방법 2: 자동 재배포 확인

- Environment Variables를 저장할 때 자동으로 재배포가 시작될 수 있음
- Deployments 탭에서 진행 중인 배포 확인

---

## 재배포 후 확인

### 1. 배포 완료 대기
- Deployments 탭에서 배포 상태 확인
- "Ready" 상태가 될 때까지 대기

### 2. 브라우저 새로고침
- **강력 새로고침**: Ctrl+F5 (Windows) 또는 Cmd+Shift+R (Mac)
- 또는 브라우저 캐시 삭제 후 새로고침

### 3. Network 탭 확인
- 개발자 도구(F12) → Network 탭
- Railway 백엔드로의 요청 확인:
  - `web-production-3dc73.up.railway.app`로의 요청
  - 예: `/api/listings`, `/api/analyze` 등

---

## 예상되는 정상 동작

### 재배포 후 Network 탭에서:
- ✅ Vercel 요청 (기존)
- ✅ **Railway 백엔드 요청** (`web-production-3dc73.up.railway.app`)
- ✅ API 엔드포인트: `/api/listings`, `/api/analyze` 등

---

## 추가 확인 사항

### Railway 백엔드 상태 확인:
1. Railway 대시보드 접속
2. 프로젝트 선택
3. 서비스(web) 상태 확인
4. 로그 확인 (정상 실행 중인지)

### CORS 확인:
- Railway 백엔드가 Vercel 도메인을 허용하는지 확인
- `backend/main.py`의 CORS 설정 확인

---

## 빠른 체크리스트

- [x] Environment Variables 설정됨 ✅
- [ ] 재배포 실행
- [ ] 배포 완료 대기
- [ ] 브라우저 강력 새로고침
- [ ] Network 탭에서 Railway 요청 확인
- [ ] Railway 백엔드 상태 확인

---

## 요약

**문제**: Environment Variables는 설정되어 있지만 작동 안 함

**원인**: Vite는 빌드 타임에 환경 변수를 포함하므로 재배포 필요

**해결**: Vercel에서 재배포 실행

**다음 단계**: 재배포 → 새로고침 → 테스트




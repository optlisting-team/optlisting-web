# 배포 검증 체크리스트

## ✅ 완료된 작업

1. **데이터베이스 마이그레이션**
   - ✅ `listings` 테이블 TRUNCATE 완료
   - ✅ `ebay_item_id + user_id` UNIQUE 제약 조건 추가 완료
   - ✅ 같은 주인의 같은 상품 중복 저장 방지

2. **코드 변경사항**
   - ✅ Git Push 완료 (커밋: `6fd6189`)
   - ✅ 백엔드 로그 표준화 (`[FETCH]`, `[STORE]`, `[DASHBOARD]`)
   - ✅ 프론트엔드 user_id 단일화 (fallback 제거)
   - ✅ UI 미니멀리즘 (인사말/설명 문구 제거)

## 🔍 배포 상태 확인

### Railway (백엔드)
1. **대시보드 확인**
   - https://railway.app 접속
   - 프로젝트 선택
   - "Deployments" 탭에서 최신 배포 상태 확인

2. **Health Check**
   - Railway 배포 URL: `https://[your-railway-url].up.railway.app/api/health`
   - 또는 API 문서: `https://[your-railway-url].up.railway.app/docs`

3. **배포 로그 확인**
   - Railway 대시보드 → Deployments → 최신 배포 → Logs
   - 에러 메시지 확인

### Vercel (프론트엔드)
1. **대시보드 확인**
   - https://vercel.com 접속
   - 프로젝트 선택
   - "Deployments" 탭에서 최신 배포 상태 확인

2. **사이트 접속 테스트**
   - Vercel 배포 URL로 접속
   - Dashboard 페이지 로드 확인

## ✅ 동작 검증 체크리스트

### 1. Sync 동작 확인

**시나리오**: Dashboard에서 Sync 버튼 클릭 시

**예상 동작**:
1. 프론트엔드에서 `POST /api/ebay/listings/sync?user_id=ee0da9dd...` 호출
2. 백엔드 로그에 다음 3줄만 표시:
   ```
   [FETCH] eBay로부터 92개 수집 완료.
   [STORE] 유저 ee0da9dd...의 상품 92개 DB 저장/업데이트 완료.
   ```
3. Dashboard 로그에 다음 표시:
   ```
   [DASHBOARD] 현재 활성 상품 수: 92개.
   ```
4. 화면에 "92 ACTIVE" 표시

**검증 포인트**:
- [ ] Sync API 호출 시 `user_id=ee0da9dd...` (정확한 ID 전달)
- [ ] 백엔드 로그에 표준화된 3줄 로그만 표시
- [ ] DB에 92개 데이터 저장 (중복 없음)
- [ ] Dashboard에 "92 ACTIVE" 정확히 표시
- [ ] UNIQUE 제약 조건으로 인해 같은 상품이 중복 저장되지 않음

### 2. user_id 검증

**검증 포인트**:
- [ ] 프론트엔드에서 `user?.id`로만 user_id 사용 (fallback 없음)
- [ ] 백엔드에서 `default-user` 차단 로직 작동
- [ ] DB에 저장된 모든 레코드의 `user_id`가 `ee0da9dd...`로 일치

### 3. 중복 방지 검증

**검증 포인트**:
- [ ] `ebay_item_id + user_id` UNIQUE 제약 조건 확인
- [ ] 같은 user_id로 같은 ebay_item_id를 두 번 저장하려고 하면 에러 발생
- [ ] UNIQUE 제약 조건으로 인해 중복 저장 방지

## 🔧 문제 해결

### 백엔드 배포 실패 시
1. Railway 배포 로그 확인
2. 에러 메시지 확인
3. 필요 시 Railway에서 "Redeploy" 클릭

### 프론트엔드 배포 실패 시
1. Vercel 배포 로그 확인
2. 빌드 에러 확인
3. 필요 시 Vercel에서 "Redeploy" 클릭

### Sync 실패 시
1. 브라우저 개발자 도구 → Network 탭 확인
2. API 응답 확인
3. 백엔드 로그 확인 (Railway)
4. user_id가 정확히 전달되는지 확인

## 📊 최종 확인 사항

배포가 완료되면 다음을 확인:

1. **Railway 배포 완료**
   - [ ] 배포 상태: "Success"
   - [ ] Health Check: 200 OK
   - [ ] API 문서 접근 가능

2. **Vercel 배포 완료**
   - [ ] 배포 상태: "Ready"
   - [ ] 사이트 접속 가능
   - [ ] Dashboard 페이지 로드 가능

3. **동작 검증**
   - [ ] Sync 버튼 클릭 시 정상 동작
   - [ ] 로그에 표준화된 3줄만 표시
   - [ ] 화면에 "92 ACTIVE" 정확히 표시
   - [ ] 중복 저장 방지 확인





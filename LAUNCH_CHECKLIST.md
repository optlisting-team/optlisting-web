# 🚀 OptListing 런칭 전 체크리스트

## ✅ 핵심 기능 테스트

### 1. 결제 시스템 (Lemon Squeezy)
- [ ] **Test Mode 테스트**
  - [ ] Test Mode 활성화 확인
  - [ ] 테스트 상품 생성 (크레딧 팩 1개 이상)
  - [ ] `/pricing` 페이지에서 Checkout 링크 생성 확인
  - [ ] 테스트 카드로 결제 완료 (`4242 4242 4242 4242`)
  - [ ] 웹훅 수신 확인 (Railway 로그)
  - [ ] 크레딧 자동 추가 확인 (DB `profiles.purchased_credits`)
  - [ ] 프론트엔드에서 크레딧 표시 확인

- [ ] **Production 준비**
  - [ ] 실제 상품 생성 (크레딧 팩 6개 + 구독 플랜 2개)
  - [ ] Product ID를 `Pricing.jsx`에 반영
  - [ ] Webhook URL 등록 확인
  - [ ] `LS_WEBHOOK_SECRET` 환경 변수 설정
  - [ ] Test Mode 비활성화 준비

### 2. 로그인/인증 (Supabase Auth)
- [ ] **Google OAuth 테스트**
  - [ ] Google 로그인 버튼 클릭
  - [ ] OAuth 플로우 완료
  - [ ] 리다이렉트 후 Dashboard 접근 확인
  - [ ] 세션 유지 확인 (새로고침 후에도 로그인 상태)

- [ ] **이메일 로그인 테스트** (선택사항)
  - [ ] 회원가입
  - [ ] 이메일 인증
  - [ ] 로그인
  - [ ] 비밀번호 재설정

- [ ] **로그아웃 테스트**
  - [ ] 로그아웃 버튼 클릭
  - [ ] 세션 종료 확인
  - [ ] Protected Route 접근 차단 확인

### 3. eBay API 실제 연동 테스트
- [ ] **OAuth 플로우 테스트**
  - [ ] Settings 페이지에서 "Connect eBay" 클릭
  - [ ] eBay OAuth 승인 완료
  - [ ] 토큰 DB 저장 확인 (`profiles` 테이블)
  - [ ] `ebay_access_token`, `ebay_refresh_token`, `ebay_token_expires_at` 확인

- [ ] **리스팅 가져오기 테스트**
  - [ ] `/api/ebay/listings` 엔드포인트 호출
  - [ ] 실제 eBay 리스팅 데이터 수신 확인
  - [ ] DB에 리스팅 저장 확인 (`listings` 테이블)
  - [ ] 프론트엔드에서 리스팅 표시 확인

- [ ] **토큰 자동 갱신 테스트**
  - [ ] eBay Token Worker 실행 확인
  - [ ] 토큰 만료 전 자동 갱신 확인
  - [ ] Railway 로그에서 갱신 로그 확인

- [ ] **Webhook 삭제 로직 테스트**
  - [ ] eBay Developer Console에서 테스트 웹훅 전송
  - [ ] `/api/ebay/deletion` 엔드포인트 수신 확인
  - [ ] Challenge-Response 검증 확인
  - [ ] 삭제 로직 실행 확인 (테스트 데이터)
  - [ ] `deletion_logs` 테이블에 기록 확인

### 4. 공급처 CSV 추출 테스트
- [ ] **모든 공급처 포맷 테스트**
  - [ ] AutoDS (`autods`)
  - [ ] Yaballe (`yaballe`)
  - [ ] eBay (`ebay`)
  - [ ] Wholesale2B (`wholesale2b`)
  - [ ] Shopify Matrixify (`shopify_matrixify`)
  - [ ] Shopify Tagging (`shopify_tagging`)

- [ ] **CSV 생성 테스트**
  - [ ] Queue에 아이템 추가
  - [ ] 각 공급처별 CSV 다운로드
  - [ ] CSV 파일 형식 확인 (헤더, 데이터, 인코딩)
  - [ ] 파일명 확인 (날짜, 공급처명 포함)

- [ ] **Shopify 경유 항목 테스트**
  - [ ] Shopify 경유 항목과 직접 공급처 항목 혼합 테스트
  - [ ] "Download Shopify CSV" 버튼 동작 확인
  - [ ] "Download [Supplier] CSV" 버튼 동작 확인
  - [ ] 각각 올바른 포맷으로 생성되는지 확인

---

## 🔧 프로덕션 준비

### 5. DEMO_MODE 비활성화
- [ ] **프론트엔드**
  - [ ] `frontend/src/components/Dashboard.jsx`에서 `DEMO_MODE = false`로 변경
  - [ ] 더미 데이터 생성 코드 제거 또는 주석 처리
  - [ ] 실제 API 호출로 전환 확인

- [ ] **백엔드**
  - [ ] `backend/main.py`의 `startup_event()`에서 더미 데이터 생성 비활성화
  - [ ] 실제 데이터만 처리하도록 확인

### 6. 환경 변수 최종 확인
- [ ] **Railway 환경 변수**
  - [ ] `DATABASE_URL` (Supabase PostgreSQL)
  - [ ] `EBAY_CLIENT_ID`
  - [ ] `EBAY_CLIENT_SECRET`
  - [ ] `EBAY_ENVIRONMENT` (PRODUCTION)
  - [ ] `EBAY_VERIFICATION_SECRET`
  - [ ] `EBAY_WEBHOOK_ENDPOINT`
  - [ ] `LS_WEBHOOK_SECRET` (Lemon Squeezy)
  - [ ] `FRONTEND_URL` (프로덕션 URL)
  - [ ] `SENTRY_DSN` (선택사항, 에러 모니터링)

- [ ] **Vercel 환경 변수** (프론트엔드)
  - [ ] `VITE_API_URL` (Railway 백엔드 URL)
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_LEMON_SQUEEZY_STORE` (선택사항)

### 7. 데이터베이스 준비
- [ ] **Supabase 테이블 확인**
  - [ ] `listings` 테이블 존재 및 스키마 확인
  - [ ] `profiles` 테이블 존재 및 스키마 확인
  - [ ] `deletion_logs` 테이블 존재 및 스키마 확인
  - [ ] `csv_formats` 테이블 존재 및 데이터 확인

- [ ] **초기 데이터 설정**
  - [ ] CSV 포맷 데이터 초기화 (`/api/dummy-data` 또는 수동)
  - [ ] 더미 데이터 제거 (프로덕션)

---

## 🛡️ 보안 및 안정성

### 8. 보안 검토
- [ ] **API 키 보안**
  - [ ] 환경 변수에만 저장 (코드에 하드코딩 없음)
  - [ ] GitHub에 민감 정보 커밋되지 않음 확인
  - [ ] `.env` 파일 `.gitignore`에 포함 확인

- [ ] **CORS 설정**
  - [ ] 프로덕션 도메인만 허용 확인
  - [ ] `allow_origins`에 실제 도메인만 포함
  - [ ] `allow_credentials` 적절히 설정

- [ ] **인증/인가**
  - [ ] Protected Route 동작 확인
  - [ ] API 엔드포인트 `user_id` 검증 확인
  - [ ] 웹훅 시그니처 검증 확인

### 9. 에러 핸들링
- [ ] **프론트엔드 에러 처리**
  - [ ] API 호출 실패 시 사용자 피드백
  - [ ] 네트워크 에러 처리
  - [ ] 타임아웃 처리 (10초)
  - [ ] 크레딧 부족 시 모달 표시

- [ ] **백엔드 에러 처리**
  - [ ] 전역 예외 핸들러 동작 확인
  - [ ] CORS 에러 헤더 포함 확인
  - [ ] 로깅 설정 확인 (Railway 로그)
  - [ ] Sentry 연동 확인 (선택사항)

### 10. 성능 테스트
- [ ] **대량 리스팅 처리**
  - [ ] 1000개 이상 리스팅 로드 테스트
  - [ ] 필터링 성능 확인
  - [ ] 페이지네이션 동작 확인

- [ ] **API 응답 시간**
  - [ ] `/api/listings` 응답 시간 확인
  - [ ] `/api/analyze` 응답 시간 확인
  - [ ] CSV 생성 시간 확인 (100개 이상)

---

## 📋 추가 확인 사항

### 11. UI/UX 최종 확인
- [ ] **반응형 디자인**
  - [ ] 모바일 화면 확인
  - [ ] 태블릿 화면 확인
  - [ ] 데스크톱 화면 확인

- [ ] **사용자 플로우**
  - [ ] 랜딩 페이지 → 로그인 → Dashboard
  - [ ] 리스팅 분석 → 필터링 → Queue 추가
  - [ ] CSV 다운로드 → 삭제 완료

### 12. 문서화
- [ ] **사용자 가이드** (선택사항)
  - [ ] 첫 사용자 온보딩
  - [ ] 주요 기능 설명

- [ ] **개발자 문서**
  - [ ] API 엔드포인트 문서
  - [ ] 환경 변수 설정 가이드
  - [ ] 배포 가이드

### 13. 모니터링 설정
- [ ] **Railway 모니터링**
  - [ ] 로그 확인 방법
  - [ ] 알림 설정 (선택사항)

- [ ] **Sentry 설정** (선택사항)
  - [ ] 에러 트래킹 활성화
  - [ ] 알림 설정

---

## 🎯 런칭 전 최종 체크

- [ ] 모든 핵심 기능 테스트 완료
- [ ] DEMO_MODE 비활성화
- [ ] 환경 변수 최종 확인
- [ ] 보안 검토 완료
- [ ] 성능 테스트 완료
- [ ] 에러 핸들링 확인
- [ ] 프로덕션 배포 완료
- [ ] 스모크 테스트 (실제 사용자 시나리오)

---

## 📝 체크리스트 요약

**필수 테스트 (런칭 전 반드시):**
1. ✅ 결제 시스템 테스트 (Lemon Squeezy)
2. ✅ 로그인/인증 테스트 (Supabase)
3. ✅ eBay API 실제 연동 테스트
4. ✅ 공급처 CSV 추출 테스트
5. ✅ DEMO_MODE 비활성화
6. ✅ 환경 변수 최종 확인
7. ✅ 보안 검토
8. ✅ 에러 핸들링 확인

**권장 테스트 (가능하면):**
- 성능 테스트
- 대량 데이터 테스트
- 모니터링 설정
- 문서화

---

## 🚨 긴급 수정 사항

런칭 전에 반드시 확인해야 할 사항:
- [ ] Railway 서버 정상 작동 확인
- [ ] Vercel 프론트엔드 배포 확인
- [ ] 데이터베이스 연결 확인
- [ ] CORS 설정 확인
- [ ] 웹훅 엔드포인트 접근 가능 확인


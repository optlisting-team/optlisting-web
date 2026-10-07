# OptListing Web — 라이브 사이트 현황 분석 (2026-10-07)

코드 수정/배포 없음. 조사 전용. 프로덕션 URL: https://www.optlisting.com/

## 1. 응답 상태 / 시간 (2026-10-07 측정, 단일 샘플)
| 대상 | 상태 | 응답 시간 |
|---|---|---|
| `/` (랜딩) | 200 | 0.17s |
| `/pricing` | 200 | 0.40s |
| `/login` | 200 | 0.13s |
| `/privacy` | 200 | 0.07s |
| `/terms` | 200 | 0.15s |
| 백엔드 `https://optlisting-production.up.railway.app/api/health` | 200 | 0.52s |

- 헬스체크: `GET /api/health` (`backend/main.py`). 응답: `status=healthy`, `version=1.3.4`, `api=ok`, `database=ok`, **`ebay_worker="error: signal only works in main thread of the main interpreter"`** (아래 개선 제안 참고).
- 프론트는 SPA라 모든 경로가 `index.html` rewrite로 200을 반환함 (존재하지 않는 경로도 200).
- 참고: 프론트 package.json v1.3.8, 백엔드 보고 버전 1.3.4 — 버전 표기 불일치.

## 2. 페이지 구성 / 문구 / 가격
- 라우트 (`frontend/src/App.jsx`): `/` 랜딩, `/login`, `/signup`, `/pricing`, `/terms`, `/privacy`, `/payment/success`, 보호 라우트 `/dashboard`, `/listings`.
- 핵심 문구: 배지 "eBay Inventory Optimizer", H1 "Find What Doesn't Sell.", 서브 "Analyze. Find. Clean.", "Up to 30,000 listings".
- 랜딩 "5 Steps. Done.": Connect eBay → Auto-Classify Listings → Copy Title in Deleting Box → Paste & Delete at Supplier → Synced Automatically Next Scan.
- 가격: **Pro $49/월, 7일 무료 체험**. 기능: Inventory Dashboard, Performance Analytics, Dead Stock Detection, Cleanup Recommendations, 최대 30,000 리스팅. 30,000+ 는 `support@optlisting.com` 으로 Enterprise 문의.
- 인증: Google OAuth 단일(Supabase). 이메일/비번 로그인 없음.

## 3. 코드 구조 / 배포
- 프론트: `frontend/` (React 18 + Vite + Tailwind, 컴포넌트 `src/components`, 컨텍스트 `src/contexts`). 배포 Vercel — 루트 `vercel.json` (`cd frontend && npm install && npm run build`, 출력 `frontend/dist`, `/api/*` → Railway rewrite, 나머지 SPA fallback), `frontend/vercel.json`, `.vercelignore`.
- 백엔드: `backend/` FastAPI (`main.py`, `services.py`, `subscription_service.py`, `daily_scan_job.py`, `ebay_*.py`, `webhooks.py`, `workers/ebay_token_worker.py`). 배포 Railway — `railway.json` (NIXPACKS, gunicorn+uvicorn), `Procfile` (web + worker). `render.yaml` 은 잔존(미사용 추정). DB: Supabase (`supabase_schema.sql`, `backend/migrations`).
- 결제: Lemon Squeezy. 자동 스캔: 매일 01:30 PT.
- 설정 불일치: `railway.json` startCommand 는 `gunicorn backend.main:app`, `Procfile` 은 `cd backend && gunicorn main:app` — 서로 다른 실행 경로. 어느 쪽이 실제 적용되는지 Railway 대시보드 확인 필요(확인 불가).

## 4. 쇼피파이앱(노드3)과의 차이
- 이 레포에 노드3 코드/문서가 없어 **직접 비교 확인 불가**. 웹 측 특성만 기록: eBay 전용, Google(Supabase) 로그인, Lemon Squeezy $49/월 구독, 외부 공급처(Supplier)에서 삭제하는 복붙 워크플로우(Deleting Box). 노드3 측 기능 목록/가격 확보 후 동기화 비교 필요.

## 5. 가입 → 첫 핵심 기능 (최소 단계)
1. 랜딩 "Start Free Trial" 클릭 → 2. `/signup` Google 로그인 → 3. (체험 시작) Lemon Squeezy 체크아웃(새 탭) 결제수단 입력 → 4. `/payment/success` → 5. 대시보드 "Connect eBay" eBay OAuth 동의 → 6. 리스팅 자동 동기화 대기 → 7. 분류 결과 확인/Deleting Box 사용.
**약 6~7 단계.** 마찰 지점:
- 가입 직후 바로 대시보드가 아니라 결제수단 입력(체험 시작)이 먼저일 가능성 — 구독 없으면 API가 402 반환(`subscription_service.py`). 체험 전 가치 체험 불가.
- 체크아웃이 새 탭(`target=_blank`)으로 열려 흐름이 끊김.
- Google 로그인 단일 — 구글 계정 없는 셀러 이탈.
- eBay OAuth + 최대 3만 건 동기화 대기(초기 빈 화면/로딩).
- 데이터 신뢰 전 결제 요구 — 샘플 미리보기는 랜딩의 정적 ProductPreview뿐.
- 실제 퍼널 이탈률/전환율: 분석 대시보드 접근 권한 없음 → **확인 불가**.

## 6. 확인 불가 항목
- 분석 대시보드(트래픽, 전환), 결제 데이터(MRR, 가입자 수, 체험 전환율), Railway/Vercel 대시보드 설정, 실제 로그인 후 화면(인증 필요).

## 7. 개선 제안 Top 5 (제안만, 미구현)
1. **eBay 토큰 워커 오류 수정**: `/api/health` 의 `ebay_worker` 가 "signal only works in main thread" 오류. 토큰 갱신이 동작하지 않으면 사용자 eBay 연결이 만료되어 일일 스캔 실패 가능 — 라이브 영향 가장 큼.
2. **헬스체크 가시성/모니터링**: ebay_worker 오류가 있어도 `status=healthy` 로 응답. 워커 상태를 반영하고 외부 업타임 모니터(예: UptimeRobot) 연결. 버전(1.3.4 vs 1.3.8) 정렬.
3. **온보딩 마찰 감소**: 결제 전 읽기전용 데모/샘플 데이터 또는 eBay 연결 후 분석 결과 미리보기 제공, 체크아웃 새 탭 → 동일 탭 오버레이, 가입→연결 단계 진행 표시.
4. **로그인 옵션 추가**: 이메일 매직링크 등 Google 외 수단(Supabase 지원).
5. **배포 설정/코드 정리 및 번들 최적화**: `railway.json` vs `Procfile` 불일치 해소, `render.yaml`·`credit_service.py`·루트 잔존 파일(`server_output.txt`, `_commit.bat` 등) 정리, JS 번들 687kB 코드 스플리팅, SPA 404 페이지 및 SEO 메타(title 이 "Optlisting" 뿐, description/OG 없음) 보강.

# OptListing Web (노드4) — STATUS

_Last updated: 2026-10-07 (상태 파악 작업, 코드 수정 없음)_

## 1. 기술 스택 / 폴더 구조
- **Frontend**: React 18 + Vite 5 + Tailwind 3 + Radix/shadcn 스타일 컴포넌트, react-router-dom 7, axios, Supabase JS (auth). v1.3.8. 호스팅: Vercel.
- **Backend**: Python 3.11 FastAPI (`backend/main.py`), gunicorn+uvicorn. 호스팅: Railway (`railway.json`, `Procfile`; `render.yaml`도 존재). DB: Supabase(Postgres).
- **외부 연동**: eBay API/OAuth/webhook, Lemon Squeezy 결제($49/mo Pro), Supabase Auth.
- 폴더:
  - `frontend/src/` — App.jsx, components, contexts, lib, utils
  - `backend/` — main.py(API), models.py, services.py, subscription_service.py, credit_service.py(잔존), daily_scan_job.py(매일 01:30 PT 자동 스캔), ebay_*.py, webhooks.py, workers/ebay_token_worker.py, migrations/*.sql
  - `supabase/`, `supabase_schema.sql` — 스키마
  - `docs/` — STATUS.md(이 문서), `archive/`(과거 보고서/가이드 다수)
  - `scripts/`, 루트의 *.bat/*.ps1 — 로컬 실행 보조
- `vercel.json`: `/api/*`를 Railway로 rewrite.

## 2. Git
- 브랜치: `develop` (main 브랜치 규칙: 병합/배포는 마스터 승인 필요)
- 리모트: `origin` https://github.com/optlisting-team/optlisting-web
- 작업 시작 시 미커밋 변경: 없음 (clean)
- 최근 커밋 10개(작업 시작 시점):
  - e2523fc content: expand landing page flow section to 5 steps
  - 5de5d6d content: replace 'Know What to Cut' + '3 Steps' sections with a single 4-step flow
  - ef61d9b fix: point checkout to live $49/mo Pro product UUID
  - 71610ba fix: remove editable Last N Days input from Deleting Rule filter UI
  - d6211d1 fix: replace vestigial credit system with real $49/mo subscription model
  - 1654f0c fix: CRITICAL — eBay traffic_report listing_ids must be pipe-separated
  - 5f77f20 fix: move daily auto-scan schedule to 01:30 PT
  - 05e5df8 fix: CRITICAL — two bugs found via admin-triggered daily scan test
  - 26a7b5c feat: admin endpoint to manually trigger the daily auto-scan job
  - 1a6ad3f feat: dashboard header redesign v2 — Scan Progress + Store Listings cards

## 3. 빌드 / 타입체크 / 테스트 (2026-10-07 실행)
| 항목 | 명령 | 결과 |
|---|---|---|
| 프론트 설치 | `cd frontend && npm ci` | 성공 |
| 프론트 빌드 | `cd frontend && npm run build` | **성공** (44s). 경고: JS 번들 687kB(>500kB, 코드 스플리팅 권장) |
| 타입체크 | — | 없음 (JS 프로젝트, tsc 미사용) |
| 린트 | — | 스크립트 없음 |
| 테스트 | — | 테스트 스위치/파일 없음 (프론트 `test` 스크립트 없음, 백엔드 test_*.py 없음) |
| 백엔드 문법검사 | `python -m compileall backend` | **실행 불가** — 이 PC에 Python 미설치(Windows Store 별칭만 있음) |
- 로컬 실행: 프론트 `npm run dev`(vite), 백엔드 `pip install -r requirements.txt` 후 `backend/start_server.bat` 등.

## 4. 프로덕션 / 헬스체크 (2026-10-07)
- 프론트: https://optlisting.com → 307 → https://www.optlisting.com/ → **200 OK**
- 백엔드: https://optlisting-production.up.railway.app
  - `/` → 200, `/api/health` → **200** (정의: `backend/main.py` `health_check`), `/health` → 404(해당 경로 없음, 정상)
- Lemon Squeezy 체크아웃: optlisting.lemonsqueezy.com (코드 내 Pro 상품 UUID 사용)

## 5. 쇼피파이앱(노드3)과의 차이
- 이 레포에는 쇼피파이앱 코드/문서가 없어 **직접 비교 불가**(확인 불가). 알려진 웹 측 특성: eBay 전용 연동, 웹 로그인(Supabase), Lemon Squeezy 월 $49 구독 결제. 노드3 쪽 현황 확인 후 보완 필요.

## 6. 알려진 문제 / 주의사항
- **라이브 서비스** (월 $49 구독, 실사용자 있음): 배포/main 병합은 마스터 승인 필수. 작업은 develop 또는 feature/*.
- `credit_service.py`, `docs/archive/CREDIT_*` 등 과거 크레딧 시스템 잔재 존재(최근 구독 모델로 교체됨, 코드 정리 여지).
- 자동 테스트 부재 → 변경 검증은 빌드 + 수동 확인에 의존.
- 프론트 번들 크기 큼(687kB).
- eBay API 주의: traffic_report listing_ids는 파이프(`|`) 구분; 일일 스캔은 eBay 일 경계 +1.5h(01:30 PT).
- 환경: Windows 개발 PC에 Python 없음 → 백엔드 로컬 실행/검증 불가, Node/npm은 사용 가능. `.env`/시크릿은 레포에 없음(Railway/Vercel 환경변수에서 관리).
- 레포 루트에 잡파일 존재(`server_output.txt`, `backend/output.txt`, `_commit.bat`, `notion_check.ps1`) — 정리 후보.
- GitHub 계정은 노드3과 공유 중.

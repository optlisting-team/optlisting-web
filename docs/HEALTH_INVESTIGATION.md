# /api/health — ebay_worker 오류인데 healthy 반환 원인 (2026-10-26)

읽기 전용 조사. 코드 수정·배포 없음. 북극성 연결: 토큰 갱신 장애는 eBay 연결 만료 → 첫 최적화 실패로 이어지므로, 장애를 보이게 만드는 것이 선행 조건.

## 증상 (ANALYSIS_WEB.md, 2026-10-07 측정)
`/api/health` → `status=healthy`, `ebay_worker="error: signal only works in main thread of the main interpreter"`.

## 원인 1: 오류 자체 — import 시점의 signal 등록
- `backend/main.py:574` `health_check()`가 요청마다 `from .workers.ebay_token_worker import get_worker_status`를 지연 import.
- `backend/workers/ebay_token_worker.py:95-96`이 **모듈 최상위**에서 `signal.signal(SIGTERM/SIGINT, ...)`를 호출.
- `health_check`는 `def`(동기)라 FastAPI가 스레드풀에서 실행 → 이 모듈의 첫 import가 비메인 스레드에서 일어나 `ValueError: signal only works in main thread`가 발생.
- 모듈 import가 실패하므로 매 요청 같은 예외가 반복될 가능성이 높음(실패한 import는 캐시되지 않음). 이 예외는 `ImportError`가 아니라 `Exception` 분기(main.py:584)로 들어가 문자열 `"error: ..."`가 됨.
- 이 코드 경로의 로컬 재현은 **확인 불가** (Python 미설치). 위는 코드 읽기에 근거한 추론이며, 프로덕션 응답 문자열이 이와 일치함.

## 원인 2: 오류인데 healthy — 워커 상태가 status에 반영되지 않음
- `status`는 `"healthy"`로 초기화되고 DB 실패 시에만 `"degraded"`로 바뀜(main.py:570).
- 워커 분기(main.py:584-586)는 주석대로 "Worker check failure does not affect overall health" — 의도된 설계로 `status`를 건드리지 않음.

## 원인 3 (더 큰 문제): 이 값은 실제 워커 상태가 아님
- 워커는 `Procfile`의 별도 프로세스(`worker: python -m workers.ebay_token_worker --scheduler`)로 실행.
- `get_worker_status()`는 **호출한 프로세스 내부의** 모듈 전역 `worker_status` dict만 반환. web 프로세스에서 import해도 워커 프로세스의 상태가 아니라 비어 있는 자기 사본(`is_running=False`, `last_run=None`)임.
- 따라서 import 오류가 고쳐져도 health는 항상 `idle`/`last_run: null`로 보일 것이며, 워커가 죽었는지 판별 불가.
- 워커 프로세스 실제 가동 여부(Railway에 worker 서비스가 있는지 포함)는 **확인 불가** (대시보드 접근 없음). `railway.json`은 web 시작 명령만 정의.

## 영향
- ebay_worker 장애/미가동이 모니터링에 안 잡힘 → 토큰 만료로 사용자 eBay 연결·일일 스캔이 조용히 실패할 수 있음. 실제 토큰 갱신 실패 여부는 **확인 불가**.

## 수정안 (제안만, 마스터 확인 후 진행)
1. `signal.signal` 등록을 `if __name__ == "__main__":`/스케줄러 시작 함수 안으로 이동 (또는 `threading.current_thread() is threading.main_thread()` 가드). import 부작용 제거.
2. 워커 상태를 프로세스 간 공유되는 곳(DB 테이블/Supabase 행에 `last_success` heartbeat)에 기록하고, health는 그 heartbeat 나이로 판정(예: 2시간 초과 시 `degraded`).
3. 워커 오류/heartbeat 오래됨이면 `status="degraded"` 반영, 외부 업타임 모니터 연결.
4. 검증은 Python 설치 후 `compileall` + health 스모크 테스트로 (마스터 몫: Python 설치).

## 확인 불가 목록
Python 로컬 재현, Railway worker 서비스 실제 상태/로그, 토큰 갱신 실제 성공률.

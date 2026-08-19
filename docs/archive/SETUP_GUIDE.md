# OptListing 서버 시작 및 더미 데이터 생성 가이드

## 문제: 프론트엔드에 데이터가 표시되지 않음

**원인:** 백엔드 서버가 실행되지 않았습니다.

## 해결 방법

### 1단계: 백엔드 서버 시작

**방법 A: 배치 파일 사용 (가장 쉬움)**
1. 파일 탐색기에서 `backend` 폴더 열기
2. `start_server.bat` 파일을 더블클릭
3. 서버가 시작되면 다음과 같은 메시지가 표시됩니다:
   ```
   INFO:     Uvicorn running on http://0.0.0.0:8000
   ```

**방법 B: PowerShell에서 직접 실행**
1. 새 PowerShell 터미널 열기
2. 다음 명령어 실행:
   ```powershell
   cd C:\Users\icewa\Desktop\optlisting\backend
   python main.py
   ```

### 2단계: 서버 시작 확인

서버가 시작되면 다음 메시지가 보입니다:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### 3단계: 더미 데이터 생성

서버가 실행 중인 상태에서, **새로운 PowerShell 터미널**을 열고 다음 명령어 실행:

```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/dummy-data?count=100" -Method POST
```

성공하면 다음과 같은 응답이 표시됩니다:
```json
{"message": "Generated 100 dummy listings"}
```

### 4단계: 프론트엔드 확인

1. 브라우저에서 http://localhost:5173 접속
2. **F5 키를 눌러 페이지 새로고침**
3. 데이터가 표시되는지 확인

## 빠른 확인 방법

서버가 제대로 실행 중인지 확인:
```powershell
# 브라우저에서 접속
http://localhost:8000/docs

# 또는 PowerShell에서
Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing
```

데이터가 있는지 확인:
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/listings?limit=5" -UseBasicParsing
```

## 문제 해결

### 서버가 시작되지 않는 경우
1. Python이 설치되어 있는지 확인: `python --version`
2. 의존성 설치: `cd backend && pip install -r requirements.txt`
3. 포트 8000이 사용 중인지 확인: `netstat -ano | findstr :8000`

### 더미 데이터 생성이 실패하는 경우
1. 서버가 실행 중인지 확인
2. 서버 로그에서 에러 메시지 확인
3. 데이터베이스 연결 확인 (SQLite 또는 Supabase)

## 중요 사항

- **서버 창은 열어두세요!** 서버를 중지하면 프론트엔드에서 데이터를 가져올 수 없습니다.
- 서버를 중지하려면 서버 창에서 `Ctrl+C`를 누르세요.




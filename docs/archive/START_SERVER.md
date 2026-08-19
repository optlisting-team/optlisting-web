# 백엔드 서버 시작 가이드

## 빠른 시작

### 1. 백엔드 서버 시작

새 터미널 창을 열고 다음 명령어를 실행하세요:

```powershell
cd backend
python main.py
```

또는 uvicorn 사용:

```powershell
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 서버 확인

브라우저에서 다음 주소를 열어 서버가 실행 중인지 확인:

- http://localhost:8000/ (서버 상태)
- http://localhost:8000/docs (API 문서)

### 3. 더미 데이터 생성

서버가 실행되면 다음 중 하나로 더미 데이터를 생성하세요:

#### 방법 1: 브라우저에서
```
http://localhost:8000/api/dummy-data?count=100
```

#### 방법 2: PowerShell에서
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/dummy-data?count=100" -Method POST
```

#### 방법 3: API 문서에서
1. http://localhost:8000/docs 접속
2. `/api/dummy-data` 엔드포인트 찾기
3. "Try it out" 클릭
4. `count` 파라미터에 `100` 입력
5. "Execute" 클릭

### 4. 프론트엔드 확인

더미 데이터 생성 후 프론트엔드에서 확인:

- http://localhost:5173

## 문제 해결

### 서버가 시작되지 않는 경우

1. Python이 설치되어 있는지 확인:
   ```powershell
   python --version
   ```

2. 의존성이 설치되어 있는지 확인:
   ```powershell
   cd backend
   pip install -r requirements.txt
   ```

3. 포트 8000이 사용 중인지 확인:
   ```powershell
   netstat -ano | findstr :8000
   ```

### 데이터가 표시되지 않는 경우

1. 서버가 실행 중인지 확인
2. 더미 데이터가 생성되었는지 확인:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:8000/api/listings" | ConvertFrom-Json | Select-Object -ExpandProperty listings | Measure-Object | Select-Object -ExpandProperty Count
   ```
3. 브라우저 콘솔에서 에러 확인 (F12)


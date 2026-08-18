@echo off
echo ========================================
echo 데이터베이스 마이그레이션 실행
echo ========================================
echo.

cd /d %~dp0

REM Python 경로 확인
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python이 설치되어 있지 않거나 PATH에 없습니다.
    echo.
    echo 해결 방법:
    echo 1. Python 설치: https://www.python.org/downloads/
    echo 2. 또는 Supabase SQL Editor에서 직접 실행:
    echo    - https://supabase.com/dashboard/project/lmgghdbsxycgddptvwtn
    echo    - SQL Editor 열기
    echo    - backend/migrations/clean_slate_reset.sql 파일 내용 복사하여 실행
    pause
    exit /b 1
)

echo [1/3] Python 확인 완료
echo.

REM .env 파일 확인
if not exist .env (
    echo [WARNING] .env 파일이 없습니다.
    echo DATABASE_URL 환경 변수가 설정되어 있어야 합니다.
    echo.
)

echo [2/3] 마이그레이션 스크립트 실행 중...
echo.

python execute_migration.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo [SUCCESS] 마이그레이션 완료!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo [ERROR] 마이그레이션 실패
    echo ========================================
    echo.
    echo 대안: Supabase SQL Editor에서 직접 실행
    echo https://supabase.com/dashboard/project/lmgghdbsxycgddptvwtn
)

pause





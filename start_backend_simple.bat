@echo off
chcp 65001 >nul
echo ========================================
echo OptListing 백엔드 서버 시작
echo ========================================
echo.

cd /d %~dp0

echo 프로젝트 루트: %CD%
echo.

echo 서버 시작 중...
echo API: http://localhost:8000
echo Docs: http://localhost:8000/docs
echo.
echo ⚠️ 이 창을 닫지 마세요!
echo 서버를 중지하려면 Ctrl+C를 누르세요.
echo ========================================
echo.

py -m backend.main

pause


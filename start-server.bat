@echo off
chcp 65001 > nul
title 포탄대결 서버
cd /d "%~dp0server"
where node > nul 2> nul
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 버전^(22 이상^)을 설치한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)
if not exist node_modules (
  echo 처음 실행이라 필요한 파일을 내려받는 중이에요...
  call npm install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    echo 설치에 실패했어요. 인터넷 연결을 확인해 주세요.
    pause
    exit /b 1
  )
)
node --no-warnings=ExperimentalWarning src/index.js
pause

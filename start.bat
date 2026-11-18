@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [약속 장소 판사] 실행 준비 중...

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 이 파일을 다시 실행해 주세요.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo 패키지를 설치합니다. 처음 한 번만 1~2분 걸립니다...
  call npm.cmd install
  if errorlevel 1 (
    echo 패키지 설치에 실패했습니다. 인터넷 연결을 확인해 주세요.
    pause
    exit /b 1
  )
)

if not exist .env (
  copy .env.example .env >nul
  echo .env 파일을 만들었습니다. AI 기능을 쓰려면 .env 의 ANTHROPIC_API_KEY= 뒤에 키를 넣으세요.
  echo 키가 없어도 기본 판결문과 직접 입력으로 모든 흐름을 사용할 수 있습니다.
)

echo 브라우저에서 http://localhost:5173 을 엽니다. 종료하려면 이 창에서 Ctrl+C 를 누르세요.
start "" http://localhost:5173
call npm.cmd run dev
pause

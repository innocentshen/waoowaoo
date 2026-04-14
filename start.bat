@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
title waoowaoo local dev launcher

set "SETUP_ONLY=0"
set "ACCEPT_DATA_LOSS=0"

:parse_args
if "%~1"=="" goto :args_done
if /I "%~1"=="--help" goto :usage
if /I "%~1"=="--setup-only" (
  set "SETUP_ONLY=1"
  shift
  goto :parse_args
)
if /I "%~1"=="--accept-data-loss" (
  set "ACCEPT_DATA_LOSS=1"
  shift
  goto :parse_args
)
echo [ERROR] Unknown option: %~1
goto :usagefail

:args_done

echo ==================================================
echo waoowaoo local dev launcher
echo Root: %CD%
echo ==================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 18.18+ first.
  goto :fail
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Install npm 9+ first.
  goto :fail
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker was not found. Install Docker Desktop first.
  goto :fail
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker Desktop is not running, or its Linux engine failed to start.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\repair-docker-desktop.ps1"
  echo.
  echo [HINT] If the diagnosis reports a stuck Docker Desktop VHDX,
  echo [HINT] open PowerShell as Administrator and run:
  echo [HINT]   powershell -ExecutionPolicy Bypass -File "%~dp0scripts\repair-docker-desktop.ps1" -Repair
  goto :fail
)

echo.
echo [0/6] Checking for conflicting Docker app container ...
call :stop_container_if_running "waoowaoo-app" "Docker app"
if errorlevel 1 goto :fail

echo [1/6] Preparing .env ...
if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo Created .env from .env.example
  ) else (
    echo [ERROR] .env.example was not found.
    goto :fail
  )
) else (
  echo .env already exists
)

echo.
echo [2/6] Installing dependencies ...
set "NEED_NPM_INSTALL=0"
if not exist "node_modules" set "NEED_NPM_INSTALL=1"
if not exist "node_modules\next\package.json" set "NEED_NPM_INSTALL=1"
if not exist "node_modules\prisma\package.json" set "NEED_NPM_INSTALL=1"
if not exist "node_modules\.bin\prisma.cmd" set "NEED_NPM_INSTALL=1"

if "%NEED_NPM_INSTALL%"=="1" (
  if exist "node_modules" (
    echo Existing node_modules is incomplete, running npm install to repair it...
  )
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo Dependencies already installed
)

echo.
echo [3/6] Starting local services with Docker ...
call docker compose up -d mysql redis minio
if errorlevel 1 goto :fail

echo.
echo [4/6] Waiting for Docker services to become healthy ...
call :wait_for_healthy "waoowaoo-mysql" "MySQL"
if errorlevel 1 goto :fail
call :wait_for_healthy "waoowaoo-redis" "Redis"
if errorlevel 1 goto :fail
call :wait_for_healthy "waoowaoo-minio" "MinIO"
if errorlevel 1 goto :fail

echo.
echo [5/6] Initializing database schema ...
if "%ACCEPT_DATA_LOSS%"=="1" (
  call npx prisma db push --accept-data-loss
) else (
  call npx prisma db push
)
if errorlevel 1 (
  if "%ACCEPT_DATA_LOSS%"=="0" (
    echo [HINT] If this is a disposable local dev database and Prisma warns about data loss,
    echo [HINT] rerun with: start.bat --accept-data-loss
  )
  goto :fail
)

echo.
echo [5.1/6] Regenerating Prisma Client ...
call npx prisma generate
if errorlevel 1 goto :fail

if "%SETUP_ONLY%"=="1" (
  echo.
  echo Setup completed. Services are ready.
  goto :success
)

echo.
echo [6/6] Starting app ...
echo App:       http://localhost:3000
echo BullBoard: http://localhost:3010/admin/queues
echo Press Ctrl+C to stop.
echo.
call npm run dev
if errorlevel 1 goto :fail
goto :success

:stop_container_if_running
set "CONTAINER=%~1"
set "LABEL=%~2"
set "CONTAINER_STATE="
for /f "usebackq delims=" %%s in (`docker inspect -f "{{.State.Status}}" %CONTAINER% 2^>nul`) do set "CONTAINER_STATE=%%s"
if /I "%CONTAINER_STATE%"=="running" (
  echo %LABEL% container %CONTAINER% is running and would conflict with local dev. Stopping it...
  docker stop %CONTAINER% >nul
  if errorlevel 1 (
    echo [ERROR] Failed to stop conflicting container %CONTAINER%.
    exit /b 1
  )
  echo %LABEL% container stopped.
) else (
  echo No conflicting %LABEL% container detected.
)
exit /b 0

:wait_for_healthy
set "CONTAINER=%~1"
set "LABEL=%~2"
for /l %%i in (1,1,60) do (
  set "STATUS="
  for /f "delims=" %%s in ('docker inspect -f "{{.State.Health.Status}}" !CONTAINER! 2^>nul') do set "STATUS=%%s"
  if /I "!STATUS!"=="healthy" (
    echo !LABEL! is healthy.
    exit /b 0
  )
  echo Waiting for !LABEL!... (%%i/60)
  timeout /t 2 /nobreak >nul
)
echo [ERROR] !LABEL! did not become healthy in time.
exit /b 1

:usage
echo Usage:
echo   start.bat
echo   start.bat --setup-only
echo   start.bat --accept-data-loss
echo   start.bat --setup-only --accept-data-loss
exit /b 0

:usagefail
echo.
goto :usage

:fail
echo.
echo Startup failed.
echo Check the message above and fix the environment, then run start.bat again.
pause
exit /b 1

:success
echo.
echo Finished.
endlocal
exit /b 0

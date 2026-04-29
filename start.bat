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

echo.
echo [1/4] Preparing .env ...
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
echo [2/4] Installing dependencies ...
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
echo [3/4] Releasing Prisma engine file locks ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prepare-prisma-generate.ps1" -RepoRoot "%CD%"
if errorlevel 1 goto :fail

echo.
echo [3.1/4] Initializing database schema ...
if "%ACCEPT_DATA_LOSS%"=="1" (
  call npx prisma db push --accept-data-loss --skip-generate
) else (
  call npx prisma db push --skip-generate
)
if errorlevel 1 (
  if "%ACCEPT_DATA_LOSS%"=="0" (
    echo [HINT] If this is a disposable local dev database and Prisma warns about data loss,
    echo [HINT] rerun with: start.bat --accept-data-loss
  )
  goto :fail
)

echo.
echo [3.2/4] Regenerating Prisma Client ...
call npx prisma generate
if errorlevel 1 goto :fail

if "%SETUP_ONLY%"=="1" (
  echo.
  echo Setup completed. Services are ready.
  goto :success
)

echo.
echo [4/4] Starting frontend and backend services ...
echo App:       http://localhost:3000
echo BullBoard: http://localhost:3010/admin/queues
echo Press Ctrl+C to stop.
echo.
call npm run dev
if errorlevel 1 goto :fail
goto :success

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

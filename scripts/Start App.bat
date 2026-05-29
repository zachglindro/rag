@echo off
cd /d "%USERPROFILE%\Documents\rag"

echo Checking Docker Desktop status...
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker Desktop does not appear to be running.
    echo Please open Docker Desktop first, then open this script again.
    pause
    exit /b 1
)

echo Checking container status...

:: Check if any containers for this project are currently running
set "RUNNING="
for /f "usebackq tokens=*" %%i in (`docker-compose ps --filter "status=running" -q 2^>nul`) do (
    set "RUNNING=%%i"
)

if defined RUNNING (
    echo Containers are running. Stopping them...
    docker-compose down
) else (
    echo Containers are not running. Starting them...
    docker-compose up
)

pause
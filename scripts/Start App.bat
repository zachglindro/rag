@echo off
cd /d "%USERPROFILE%\Documents\rag"

echo Checking container status...

:: Check if any containers for this project are currently running
set "RUNNING="
for /f "usebackq tokens=*" %%i in (`docker-compose ps --filter "status=running" -q`) do (
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
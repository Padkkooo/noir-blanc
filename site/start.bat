@echo off
cd /d "%~dp0"
title Noir-Blanc server

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo Server is already running. Opening http://localhost:3000 ...
    start "" http://localhost:3000
    ping -n 4 127.0.0.1 >nul
    exit /b
)

if not exist "node_modules" (
    echo node_modules not found. Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo Could not install dependencies. Check that Node.js is installed.
        pause
        exit /b 1
    )
)

echo Starting Noir-Blanc server...
echo Site: http://localhost:3000
echo To stop the server press Ctrl+C or close this window.
echo.

rem Open the browser after 2 seconds, when the server is already up
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"

node server.js
pause

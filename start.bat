@echo off
setlocal
cd /d "%~dp0"

title Acacia College - Start Servers

echo ============================================================
echo    Acacia College - Starting the servers
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found on PATH.
    echo Install it from https://nodejs.org or use start-school.bat instead.
    pause
    exit /b 1
)

start "Acacia - Backend (keep open)" cmd /k "cd /d ""%~dp0backend"" && node --no-warnings server.js"
start "Acacia - Frontend (keep open)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo   Backend  : http://localhost:3001
echo   Frontend : http://localhost:5173
echo.
echo   The servers are starting. Keep the two "Acacia -" windows
echo   open while you use the system.
echo   If the app does not open automatically, visit:
echo       http://localhost:5173
echo.
pause
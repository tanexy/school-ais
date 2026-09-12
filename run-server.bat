@echo off
setlocal enableextensions

rem This file is started automatically by start-school.bat.
rem It runs one half of the system and keeps its window open
rem so any error messages stay visible.

where node >nul 2>nul
if errorlevel 1 goto nonode

cd /d "%~dp0"

if /i "%~1"=="backend" goto backend
if /i "%~1"=="frontend" goto frontend
echo Unknown option "%~1". Start this file from start-school.bat.
pause
exit /b 1

:nonode
echo Node.js was not found.
echo Please run start-school.bat instead of opening this file directly.
pause
exit /b 1

:backend
cd /d "%~dp0backend"
echo ================================================
echo   Acacia College - BACKEND - data and accounts
echo   Keep this window OPEN while you use the system.
echo   If you see red error text below, copy it and
echo   send it to whoever set up the system.
echo ================================================
echo.
node --no-warnings server.js
echo.
if errorlevel 1 echo   The backend exited with an error (code %errorlevel%).
echo   The backend has stopped. You can close this window.
pause
exit /b 0

:frontend
cd /d "%~dp0frontend"
echo ================================================
echo   Acacia College - FRONTEND - web page
echo   Keep this window OPEN while you use the system.
echo ================================================
echo.
npm run dev
echo.
echo   The frontend has stopped. You can close this window.
pause
exit /b 0
@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Acacia College - School Management System
cd /d "%~dp0"

set "PROJECT=%CD%"
set "NODE_VER=24.13.0"
set "NODE_ZIP=%TEMP%\node-v%NODE_VER%-win-x64.zip"
set "NODE_ZIP_DIR=%TEMP%\node-v%NODE_VER%-win-x64-extract"
set "NODE_URL=https://nodejs.org/dist/v%NODE_VER%/node-v%NODE_VER%-win-x64.zip"
set "NODEDIR=%PROJECT%\tools\node"

echo ============================================================
echo    Acacia College - School Management System
echo    This window will do everything for you.
echo ============================================================
echo.

rem -------- 1. Portable Node.js (no admin needed) --------
if exist "%NODEDIR%\node.exe" goto :nodeready
echo [1/5] Downloading Node.js (one time only, about 30 MB)...
if not exist "%NODE_ZIP_DIR%" mkdir "%NODE_ZIP_DIR%"

where curl >nul 2>nul
if %errorlevel%==0 (
  curl -L --fail -o "%NODE_ZIP%" "%NODE_URL%"
) else (
  powershell -NoProfile -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"
)
if not exist "%NODE_ZIP%" (
  goto :failandquit
)

echo [2/5] Extracting Node.js...
powershell -NoProfile -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%NODE_ZIP_DIR%' -Force"
del /q "%NODE_ZIP%" 2>nul
if not exist "%NODE_ZIP_DIR%\node-v%NODE_VER%-win-x64\node.exe" (
  echo        Extract failed. Please delete the "tools" folder and run again.
  goto :failandquit
)
if not exist "%PROJECT%\tools" mkdir "%PROJECT%\tools"
move /y "%NODE_ZIP_DIR%\node-v%NODE_VER%-win-x64" "%NODEDIR%" >nul 2>&1
rmdir /s /q "%NODE_ZIP_DIR%" 2>nul

:nodeready
set "PATH=%NODEDIR%;%PATH%"
node --version >nul 2>nul
if errorlevel 1 (
  echo        Node.js could not be started.
  goto :failandquit
)
for /f "delims=" %%v in ('node --version') do set "NODEV=%%v"
echo Using bundled Node.js   !NODEV!
echo.
echo Writing progress to install.log ...

rem -------- 2. Backend packages --------
if exist "backend\node_modules" (
  echo [3/5] Backend packages already installed - skipping.
) else (
  echo [3/5] Installing backend packages (one time only - please wait)...
  (echo === backend npm install @ !date! !time!) >> "install.log"
  cd backend
  call npm install >> "..\install.log" 2>&1
  set "INSTALL_OK=!errorlevel!"
  cd ..
  if not "!INSTALL_OK!"=="0" (
    echo        Backend install failed. See install.log.
    goto :failandquit
  )
)
echo.

rem -------- 3. Frontend packages --------
if exist "frontend\node_modules" (
  echo [4/5] Frontend packages already installed - skipping.
) else (
  echo [4/5] Installing frontend packages (one time only - please wait)...
  (echo === frontend npm install @ !date! !time!) >> "install.log"
  cd frontend
  call npm install >> "..\install.log" 2>&1
  set "INSTALL_OK=!errorlevel!"
  cd ..
  if not "!INSTALL_OK!"=="0" (
    echo        Frontend install failed. See install.log.
    goto :failandquit
  )
)
echo.

rem -------- 4. Config and demo data --------
if not exist "backend\.env" (
  copy /y "backend\.env.example" "backend\.env" >nul
  echo Config file created (backend\.env).
)
if not exist "backend\school.db" (
  echo [5/5] Creating the database with sample data (one time only)...
  cd backend
  call node migrate.js >> "..\install.log" 2>&1
  call node seed.js >> "..\install.log" 2>&1
  cd ..
) else (
  echo Database already set up - skipping.
)
echo.

echo ============================================================
echo    Starting the system...
echo.
echo    Demo logins:
echo      Administrator:  admin@school.com   /  admin123
echo      Bursar:         bursar@school.com  /  bursar123
echo      Teacher:        teacher@school.com /  teacher123
echo      Headmaster:     headmaster@school.com / headmaster123
echo ============================================================
echo.

rem -------- 5. Launch server windows and open the browser --------
start "Acacia - Backend (keep open)" /min cmd /k "cd /d "%PROJECT%\backend" && node server.js"
start "Acacia - Frontend (keep open)" /min cmd /k "cd /d "%PROJECT%\frontend" && npm run dev"

echo Waiting for the app to start...
timeout /t 6 /nobreak >nul

start "" "http://localhost:5173"

echo.
echo    Done! The app should now be open in your browser.
echo    If the page did not open, just type this in the address bar:
echo        http://localhost:5173
echo.
echo    To STOP the system: close the two console windows
echo    whose titles start with "Acacia -".
echo.
pause
exit /b 0

:failandquit
echo.
echo    Something went wrong. A copy of the error output is in install.log.
echo    Please send install.log to whoever gave you this program.
echo.
pause
exit /b 1
@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Acacia College - School Management System
cd /d "%~dp0"

set "PROJECT=%CD%"
set "NODE_VER=24.13.0"
set "NODE=%PROJECT%\tools\node\node.exe"
set "NODE_ZIP=%TEMP%\node-v%NODE_VER%-win-x64.zip"
set "NODE_ZIP_DIR=%TEMP%\node-v%NODE_VER%-win-x64-extract"
set "NODE_URL=https://nodejs.org/dist/v%NODE_VER%/node-v%NODE_VER%-win-x64.zip"

echo ============================================================
echo    Acacia College - School Management System
echo    This window will do everything for you.
echo ============================================================
echo.

rem ---------- Step 1. Get Node.js ----------
if exist "%NODE%" goto nodeready

echo [1/5] Downloading Node.js - one time only, about 30 MB.
if not exist "%NODE_ZIP_DIR%" mkdir "%NODE_ZIP_DIR%"

where curl >nul 2>nul
if errorlevel 1 goto usedownloadps
curl -L --fail -o "%NODE_ZIP%" "%NODE_URL%"
goto downloaded

:usedownloadps
powershell -NoProfile -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"

:downloaded
if not exist "%NODE_ZIP%" goto nodefail

echo [2/5] Extracting Node.js...
powershell -NoProfile -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%NODE_ZIP_DIR%' -Force"
del /q "%NODE_ZIP%" 2>nul
if not exist "%NODE_ZIP_DIR%\node-v%NODE_VER%-win-x64\node.exe" goto extractfail
if not exist "%PROJECT%\tools" mkdir "%PROJECT%\tools"
move /y "%NODE_ZIP_DIR%\node-v%NODE_VER%-win-x64" "%PROJECT%\tools\node" >nul 2>&1
rmdir /s /q "%NODE_ZIP_DIR%" 2>nul

rem ---------- Step 2. Check Node ----------
:nodeready
if not exist "%NODE%" goto nodefail
"%NODE%" --version >nul 2>nul
if errorlevel 1 goto nodefail
set "PATH=%PROJECT%\tools\node;%PATH%"
echo Using bundled Node.js.
echo Progress is saved to install.log
echo.

rem ---------- Step 3. Backend packages ----------
if not exist "%~dp0backend\node_modules" goto installbackend
echo [3/5] Backend packages already installed - skipping.
"%NODE%" -e "require('node:sqlite')" >nul 2>nul
if errorlevel 1 goto bindfail
goto backenddone

:installbackend
echo [3/5] Installing backend packages - first run only, please wait...
echo === backend npm install @ %DATE% %TIME% >> "%~dp0install.log"
cd /d "%~dp0backend"
call "%PROJECT%\tools\node\npm.cmd" install >> "%~dp0install.log" 2>&1
if errorlevel 1 goto backendfail
"%NODE%" -e "require('node:sqlite')" >> "%~dp0install.log" 2>&1
if errorlevel 1 goto bindfail
cd /d "%~dp0"
echo Backend packages OK.

:backenddone
echo.

rem ---------- Step 4. Frontend packages ----------
if not exist "%~dp0frontend\node_modules" goto installfrontend
echo [4/5] Frontend packages already installed - skipping.
goto frontenddone

:installfrontend
echo [4/5] Installing frontend packages - first run only, please wait...
echo === frontend npm install @ %DATE% %TIME% >> "%~dp0install.log"
cd /d "%~dp0frontend"
call "%PROJECT%\tools\node\npm.cmd" install >> "%~dp0install.log" 2>&1
if errorlevel 1 goto frontendfail
cd /d "%~dp0"
echo Frontend packages OK.

:frontenddone
echo.

rem ---------- Step 5. Config file ----------
if exist "%~dp0backend\.env" goto configdone
copy /y "%~dp0backend\.env.example" "%~dp0backend\.env" >nul
echo Config file created.
:configdone

rem ---------- Step 6. Database and demo data ----------
if exist "%~dp0backend\school.db" goto dbdone
echo [5/5] Creating the database with sample data - first run only...
cd /d "%~dp0backend"
"%NODE%" --no-warnings migrate.js >> "%~dp0install.log" 2>&1
"%NODE%" --no-warnings seed.js >> "%~dp0install.log" 2>&1
cd /d "%~dp0"
if not exist "%~dp0backend\school.db" goto dbfail
echo Database ready.
:dbdone
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
echo    If Windows asks about the firewall, tick Private networks
echo    and press Allow.
echo.

rem ---------- Step 7. Launch the two server windows ----------
start "Acacia - Backend (keep open)" /min cmd /k "%~dp0run-server.bat backend"
start "Acacia - Frontend (keep open)" /min cmd /k "%~dp0run-server.bat frontend"

rem ---------- Step 8. Wait for the servers, then open the browser ----------
echo Checking that the system is ready...

echo Checking the backend...
"%NODE%" "%~dp0healthcheck.js" http://localhost:3001/api/health 40 2 >> "%~dp0install.log" 2>&1
if errorlevel 1 goto backendtimeout
echo Backend is up.

:checkfrontend
echo Checking the frontend page...
"%NODE%" "%~dp0healthcheck.js" http://localhost:5173/ 40 2 >> "%~dp0install.log" 2>&1
if errorlevel 1 goto frontendtimeout

:openbrowser
echo.
echo    Everything is running - opening the app...
start "" "http://localhost:5173"
echo    Done! The app is now open in your browser.
echo.
echo    If the page did not open, type this in the address bar:
echo        http://localhost:5173
echo.
echo    To STOP the system, close the two console windows whose
echo    titles start with Acacia.
echo.
pause
exit /b 0

rem ---------- Timeout messages ----------
:backendtimeout
echo.
echo    The backend did not respond after 40 seconds.
echo    A copy of the system may already be running, or the
echo    backend failed to start.
echo    Open the "Acacia - Backend (keep open)" window.
echo    - If it shows the address http://localhost:3001 with no
echo      errors, the system is fine - open http://localhost:5173
echo      in your browser.
echo    - If it shows an error, screenshot it and send it to
echo      whoever gave you this program.
echo.
echo The last lines of the progress log are:
if exist "%~dp0install.log" powershell -NoProfile -Command "Get-Content -Path '%~dp0install.log' -Tail 6"
echo.
echo Continuing to check the frontend...
goto checkfrontend

:frontendtimeout
echo.
echo    The frontend page did not respond after 40 seconds.
echo    Open the "Acacia - Frontend (keep open)" window and look at
echo    the error text.
echo.
echo    The backend may still be running - try opening
echo    http://localhost:5173 in your browser manually.
echo.
pause
exit /b 0

rem ---------- Error messages ----------
:nodefail
echo.
echo    Node.js could not be downloaded or started.
echo    Check your internet connection, then run this file again.
goto failquit

:extractfail
echo.
echo    The Node.js download could not be unzipped.
echo    Delete the "tools" folder, then run this file again.
goto failquit

:backendfail
echo.
echo    The backend packages could not be installed.
echo    Look at install.log for the reason.
goto failquit

:bindfail
echo.
echo    The built-in database driver could not be loaded.
echo    This needs the bundled Node.js supplied in the tools
echo    folder. Delete the "tools" folder, run this file again,
echo    and wait for it to finish before touching anything.
goto failquit

:frontendfail
echo.
echo    The frontend packages could not be installed.
echo    Look at install.log for the reason.
goto failquit

:dbfail
echo.
echo    The database could not be created.
echo    Look at install.log for the reason.
goto failquit

:failquit
echo.
echo    Something went wrong. Here is the end of the progress log:
echo.
if exist "%~dp0install.log" powershell -NoProfile -Command "Get-Content -Path '%~dp0install.log' -Tail 20"
echo.
echo    Please screenshot this window and send it to whoever
echo    gave you this program.
echo.
pause
exit /b 1
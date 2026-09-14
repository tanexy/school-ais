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

rem ---------- Ensure the database exists ----------
if exist "%~dp0backend\school.db" goto dbcheck

echo    Database not found - creating it with sample data...
goto seeddb

:dbcheck
node -e "const db=require('node:sqlite').DatabaseSync;const d=new db('backend/school.db');const count=d.prepare('SELECT COUNT(*) AS c FROM students').get().c;process.exit(count>0?0:1);"
if errorlevel 1 goto reseed
echo    Database found and has data - keeping it.
goto dbready

:reseed
echo    Database is missing or empty - recreating it with sample data...
del /q "%~dp0backend\school.db" 2>nul

:seeddb
rem Remove stale WAL sidecar files so old data cannot resurrect into the new database.
del /q "%~dp0backend\school.db-wal" 2>nul
del /q "%~dp0backend\school.db-shm" 2>nul
cd /d "%~dp0backend"
node --no-warnings migrate.js
if errorlevel 1 goto dbfail
node --no-warnings seed.js
if errorlevel 1 goto dbfail
cd /d "%~dp0"
echo    Database ready with sample data.

:dbready
echo.

rem ---------- Start the two server windows ----------
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
exit /b 0

:dbfail
echo.
echo    The database could not be created. Something is wrong with
echo    the backend folder - screenshot this window and send it to
echo    whoever gave you this program.
echo.
pause
exit /b 1
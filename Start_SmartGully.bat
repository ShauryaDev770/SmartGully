@echo off
title SmartGully Launcher
echo ============================================================
echo           SMARTGULLY: CIVIC ROAD INTELLIGENCE
echo ============================================================
echo.
echo Starting Backend API, AI Worker, and Frontend...
echo.

cd /d "%~dp0"

:: Check if port 8000 is already in use
netstat -ano | findstr :8000 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [1/3] Launching FastAPI Backend (Port 8000)...
    start /min "SmartGully Backend" cmd /c "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
) else (
    echo [1/3] Backend is already running on port 8000.
)

:: Check if worker.py is already running
tasklist /fi "imagename eq python.exe" /v | findstr /i "worker.py" >nul
if %errorlevel% neq 0 (
    echo [2/3] Launching AI Triage Worker...
    start /min "SmartGully AI Worker" cmd /c "cd /d "%~dp0backend" && .venv\Scripts\python.exe worker.py"
) else (
    echo [2/3] AI Worker is already running.
)

:: Check if port 5173 is already in use
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [3/3] Launching Frontend Server (Port 5173)...
    start /min "SmartGully Frontend" cmd /c "cd /d "%~dp0frontend" && npm.cmd run dev"
) else (
    echo [3/3] Frontend is already running on port 5173.
)

echo.
echo Waiting 3 seconds for services to initialize...
timeout /t 3 /nobreak >nul

echo.
echo Opening SmartGully in your browser...
start http://localhost:5173

echo.
echo ============================================================
echo  SmartGully is running!
echo  - Desktop URL: http://localhost:5173
echo  - API Docs:    http://localhost:8000/docs
echo.
echo  To open on your phone connected to same Wi-Fi:
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| findstr 0.0.0.0 ^| findstr /v "0.0.0.0.*0.0.0.0"') do (
    set LOCAL_IP=%%a
)
echo  - Mobile URL:  http://localhost:5173 (or your local IP:5173)
echo.
echo  To stop all services, run Stop_SmartGully.bat
echo ============================================================
echo.
timeout /t 5
exit

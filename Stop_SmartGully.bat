@echo off
title Stop SmartGully
echo ============================================================
echo           STOPPING SMARTGULLY SERVICES
echo ============================================================
echo.

echo Stopping services on Port 8000 and Port 5173...

:: Find and terminate processes on port 8000 (Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Terminating Backend PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

:: Find and terminate processes on port 5173 (Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Terminating Frontend PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

:: Terminate worker python processes
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" /v ^| findstr /i "worker.py"') do (
    echo Terminating AI Worker PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo All SmartGully background processes have been stopped.
echo ============================================================
timeout /t 3
exit

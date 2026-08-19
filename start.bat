@echo off
REM Double-click launcher for start.ps1 - installs dependencies, starts every
REM service, and opens CyberSim in your browser.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
pause

@echo off
title Pixology Volunteers - Local Server
cd /d "%~dp0"
echo ==========================================
echo Starting Local Server on http://localhost:5500
echo ==========================================
echo.
python -m http.server 5500
pause

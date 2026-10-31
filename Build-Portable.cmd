@echo off
setlocal
cd /d "%~dp0"
title Build Aviation Insight Desktop
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 x64 on this build computer first.
  pause
  exit /b 1
)
node scripts\build-portable.mjs
if errorlevel 1 (
  echo.
  echo Build failed. See the error above.
  pause
  exit /b 1
)
echo.
echo Ready: dist\portable\AviationInsight.exe
pause

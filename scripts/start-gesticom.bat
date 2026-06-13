@echo off
cd /d "%~dp0.."
title GestiCom Pro - Demarrage
echo Demarrage du service GestiCom Pro...
net start GestiComPro 2>nul
if %ERRORLEVEL% NEQ 0 (
  sc start GestiComPro 2>nul
)
if %ERRORLEVEL% EQU 0 (
  echo Service demarre.
  timeout /t 5 /nobreak >nul
  start "" http://localhost:3001
) else (
  echo Le service GestiComPro n'est pas installe.
  echo Lancement direct...
  start "" /B node scripts\standalone-launcher.js
  timeout /t 10 /nobreak >nul
  start "" http://localhost:3001
)
exit /b 0

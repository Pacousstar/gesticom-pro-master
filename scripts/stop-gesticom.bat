@echo off
cd /d "%~dp0.."
title GestiCom Pro - Arret
echo Arret du service GestiCom Pro...
net stop GestiComPro 2>nul
if %ERRORLEVEL% NEQ 0 (
  sc stop GestiComPro 2>nul
)
echo.
echo Si des processus node.exe persistent, tu peux les tuer :
echo   taskkill /f /im node.exe
echo.
pause
exit /b 0

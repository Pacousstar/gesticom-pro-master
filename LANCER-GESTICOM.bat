@echo off
title GestiCom Pro
cd /d "%~dp0"
echo.
echo.  ╔══════════════════════════════════════════╗
echo.  ║       GestiCom Pro - Demarrage...        ║
echo.  ╚══════════════════════════════════════════╝
echo.
echo  Ouverture de l'application en cours...
echo  Si le navigateur ne s'ouvre pas dans 30s,
echo  rendez-vous sur http://localhost:3001
echo.

:: Lancer le serveur silencieusement
start /min wscript.exe "LANCER-SILENCIEUX.vbs"

:: Attendre que le serveur soit pret
set "SERVER_READY="
for /l %%i in (1,1,30) do (
  >nul 2>&1 curl -s http://127.0.0.1:3001/ && set "SERVER_READY=1" && goto :open
  >nul 2>&1 timeout /t 1
)

:open
if defined SERVER_READY (
  start http://localhost:3001
) else (
  echo ATTENTION: Le serveur ne repond pas encore.
  echo Lancez votre navigateur et allez sur http://localhost:3001
)
timeout /t 3 >nul
exit

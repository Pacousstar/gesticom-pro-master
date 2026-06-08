@echo off
:: Redirige silencieusement vers LANCER-SILENCIEUX.vbs
cd /d "%~dp0"
if exist "LANCER-SILENCIEUX.vbs" (
    wscript.exe "LANCER-SILENCIEUX.vbs"
)
exit /b 0

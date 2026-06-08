@echo off
schtasks /create /tn "GestiComPro" /tr "wscript.exe ""C:\GestiComPro\LANCER-SILENCIEUX.vbs""" /sc onlogon /rl highest /f
echo Tache planifiee GestiComPro installee.
pause

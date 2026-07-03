@echo off
chcp 65001 >nul
title Migration GestiCom Pro
cls

echo ============================================
echo   MIGRATION GESTICOM PRO
echo   Copie depuis : %~dp0
echo ============================================
echo.

set "SOURCE=%~dp0"
set /p DEST="Destination du nouveau dossier (ex: C:\GestiCom-Nouveau) : "
if "%DEST%"=="" set "DEST=C:\GestiCom-Nouveau"

echo.
echo [1/7] Clone du depot GitHub...
git clone https://github.com/Pacousstar/gesticom-pro-master.git "%DEST%"
if %errorlevel% neq 0 (
    echo ERREUR : echec du clone. Verifie ta connexion.
    pause
    exit /b 1
)

echo.
echo [2/7] Copie de la base de donnees...
if exist "C:\gesticom\gesticom.db" (
    mkdir "C:\gesticom" 2>nul
    copy /Y "C:\gesticom\gesticom.db" "C:\gesticom\gesticom.db"
    echo OK - base copiee
) else if exist "%SOURCE%prisma\gesticom.db" (
    copy /Y "%SOURCE%prisma\gesticom.db" "%DEST%\prisma\gesticom.db"
    echo OK - base copiee depuis prisma
) else (
    echo ATTENTION : gesticom.db introuvable ! La base sera vide.
    echo Place ton fichier gesticom.db dans %DEST%\prisma\
)

echo.
echo [3/7] Copie de private.pem...
if exist "%SOURCE%private.pem" (
    copy /Y "%SOURCE%private.pem" "%DEST%\private.pem"
    echo OK
) else (
    echo ATTENTION : private.pem introuvable. Les licences ne pourront pas etre generees.
)

echo.
echo [4/7] Copie de .env...
if exist "%SOURCE%.env" (
    copy /Y "%SOURCE%.env" "%DEST%\.env"
    echo OK
) else (
    echo ATTENTION : .env introuvable. Tu devras le creer manuellement.
)

echo.
echo [5/7] Copie des logs (optionnel)...
if exist "%SOURCE%logs" (
    xcopy /E /I /Y "%SOURCE%logs" "%DEST%\logs" >nul
    echo OK
) else (
    echo Ignore (aucun dossier logs)
)

echo.
echo [6/7] Installation des dependances...
cd /d "%DEST%"
call npm install
if %errorlevel% neq 0 (
    echo ERREUR : npm install a echouer
    pause
    exit /b 1
)

echo.
echo [7/7] Mise a jour de la base de donnees...
call npx prisma db push
if %errorlevel% neq 0 (
    echo ERREUR : prisma db push a echouer
    pause
    exit /b 1
)

echo.
echo ============================================
echo   MIGRATION TERMINEE AVEC SUCCES !
echo ============================================
echo.
echo Pour lancer GestiCom Pro :
echo   cd /d "%DEST%"
echo   npm run dev
echo.
echo Acces : http://localhost:3001
echo.

pause

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
echo [1/8] Clone du depot GitHub...
git clone https://github.com/Pacousstar/gesticom-pro-master.git "%DEST%"
if %errorlevel% neq 0 (
    echo ERREUR : echec du clone. Verifie ta connexion.
    pause
    exit /b 1
)

echo.
echo [2/8] Copie de la base de donnees...

REM Chercher la DB a plusieurs endroits possibles
set "DB_FOUND="
if exist "C:\gesticom\gesticom.db" set "DB_SOURCE=C:\gesticom\gesticom.db" & set "DB_FOUND=1"
if exist "%SOURCE%gesticom.db" set "DB_SOURCE=%SOURCE%gesticom.db" & set "DB_FOUND=1"
if exist "%SOURCE%prisma\gesticom.db" set "DB_SOURCE=%SOURCE%prisma\gesticom.db" & set "DB_FOUND=1"

if defined DB_FOUND (
    REM Lire DATABASE_URL depuis .env pour savoir ou copier
    set "DB_DEST=%DEST%\prisma\gesticom.db"
    if exist "%SOURCE%.env" (
        for /f "tokens=2 delims==" %%a in ('type "%SOURCE%.env" ^| find "DATABASE_URL"') do (
            set "URL=%%a"
        )
    )
    copy /Y "%DB_SOURCE%" "%DB_DEST%"
    echo OK - base copiee depuis %DB_SOURCE%
) else (
    echo ATTENTION : gesticom.db introuvable ! Une base vierge sera creee.
    echo Le seed cree automatiquement le compte admin / Admin@123
)

echo.
echo [3/8] Copie de private.pem...
if exist "%SOURCE%private.pem" (
    copy /Y "%SOURCE%private.pem" "%DEST%\private.pem"
    echo OK
) else (
    echo ATTENTION : private.pem introuvable. Les licences ne pourront pas etre generees.
)

echo.
echo [4/8] Copie de .env...
if exist "%SOURCE%.env" (
    copy /Y "%SOURCE%.env" "%DEST%\.env"
    echo OK
) else (
    echo ATTENTION : .env introuvable. Tu devras le creer manuellement.
    echo Voici le contenu minimum a placer dans %DEST%\.env :
    echo DATABASE_URL="file:./prisma/gesticom.db"
    echo SESSION_SECRET="changer_ce_secret"
    echo PORT=3001
)

echo.
echo [5/8] Copie des logs (optionnel)...
if exist "%SOURCE%logs" (
    xcopy /E /I /Y "%SOURCE%logs" "%DEST%\logs" >nul
    echo OK
) else (
    echo Ignore (aucun dossier logs)
)

echo.
echo [6/8] Installation des dependances...
cd /d "%DEST%"
call npm install
if %errorlevel% neq 0 (
    echo ERREUR : npm install a echouer
    pause
    exit /b 1
)

echo.
echo [7/8] Mise a jour de la base de donnees...
call npx prisma db push
if %errorlevel% neq 0 (
    echo ERREUR : prisma db push a echouer
    pause
    exit /b 1
)

echo.
echo [8/8] Creation du compte admin (seed)...
call npm run db:seed
if %errorlevel% neq 0 (
    echo ERREUR : seed a echouer
    pause
    exit /b 1
)

echo.
echo ============================================
echo   MIGRATION TERMINEE AVEC SUCCES !
echo ============================================
echo.
echo Compte admin : admin / Admin@123
echo.
echo Pour lancer GestiCom Pro :
echo   cd /d "%DEST%"
echo   npm run dev
echo.
echo Si le port 3001 est deja utilise, modifie .env :
echo   PORT=3001
echo.
pause

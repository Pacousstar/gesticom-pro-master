@echo off
TITLE GestiCom Pro - Migration Master Engine (API Mode)
color 0B
echo.
echo  ##########################################################
echo  #                                                        #
echo  #         GESTI-COM PRO : MIGRATION MASTER v2.1          #
echo  #             GSN EXPERTISES GROUP - 2026                #
echo  #                                                        #
echo  ##########################################################
echo.
echo [INFO] Verification de la connexion au serveur...
echo.

:: Vérifier si le serveur est lancé (Port 3001 par défaut)
netstat -ano | findstr :3001 > nul
if %errorlevel% neq 0 (
    echo [ERREUR] Le serveur GestiCom n'est pas lance !
    echo Veuillez demarrer GestiCom Pro AVANT de lancer la migration.
    echo.
    pause
    exit /b
)

echo [OK] Serveur detecte. Lancement de la migration interne...
echo.

:: Appel de l'API de migration via CURL (standard sur Windows 10+)
:: On utilise la clé définie dans le .env
curl -X POST -H "x-migration-key: GestiComMaster2026" -H "Content-Type: application/json" http://localhost:3001/api/admin/migration-master

echo.
echo.
echo ----------------------------------------------------------
echo [TERMINE] Si vous voyez {"success":true}, la migration est reussie !
echo Appuyez sur une touche pour fermer cette fenetre.
pause > nul

@echo off
TITLE GestiCom Pro - Reparation des Acces Admin
COLOR 0A
echo -------------------------------------------------------
echo   GESTICOM PRO - OUTIL DE REPARATION DES ACCES
echo -------------------------------------------------------
echo.
echo Ce script va restaurer les menus manquants pour l'utilisateur 'admin'.
echo Veuillez fermer le logiciel avant de continuer.
echo.
pause

echo.
echo [1/2] Verification de l'environnement...
if not exist "node_modules" (
    echo ERREUR : Dossier node_modules introuvable. 
    echo Veuillez lancer ce script depuis le dossier d'installation du logiciel.
    pause
    exit
)

echo [2/2] Execution de la reparation...
npx tsx scripts/fix_admin_permissions.ts admin

echo.
echo -------------------------------------------------------
echo   REPARATION TERMINEE !
echo   Vous pouvez relancer GestiCom Pro.
echo -------------------------------------------------------
echo.
pause

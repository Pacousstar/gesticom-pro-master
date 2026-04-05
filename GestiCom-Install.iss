; Script d'installation GestiCom Pro - GSN EXPERTISES GROUP
#define MyAppName "GestiCom Pro"
#define MyAppVersion "2.1 (Master-Shield)"
#define MyAppPublisher "GSN EXPERTISES GROUP"
#define MyAppURL "https://www.gsnexpertises.com"
#define MyAppExeName "GestiComService.exe"

[Setup]
AppId={{D37E7A1C-8A9E-4C2B-A6D2-B9E08B7A1C2B}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName=C:\GestiComPro
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=.
OutputBaseFilename=GestiCom-Installateur
SetupIconFile=public\gesticom.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Dirs]
Name: "C:\gesticom"; Permissions: everyone-full


[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Serveur Standalone (Ultra-Léger et Rapide à compiler)
Source: ".next\standalone\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Dossiers statiques INDISPENSABLES pour l'affichage (CSS, Images)
Source: ".next\static\*"; DestDir: "{app}\.next\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs
; Recopie de Prisma et de la base de données de départ
Source: "prisma\schema.prisma"; DestDir: "{app}\prisma"; Flags: ignoreversion
; Configuration du Service
Source: "GestiComService.xml"; DestDir: "{app}"; Flags: ignoreversion
; WinSW wrapper renommé
Source: "GestiComService.exe"; DestDir: "{app}"; Flags: ignoreversion
; Node.js embarqué (Zéro prérequis client)
Source: "node.exe"; DestDir: "{app}"; Flags: ignoreversion
; Configuration environnementale
Source: ".env"; DestDir: "{app}"; Flags: ignoreversion
; Base de données initiale (Créer le dossier et poser une base vide SI elle n'existe pas)
Source: "prisma\gesticom.db"; DestDir: "C:\gesticom"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall
; Script de lancement de la migration Master
Source: "LANCER-MIGRATION-MASTER.bat"; DestDir: "{app}"; Flags: ignoreversion
; Dossier scripts indispensable pour la migration
Source: "scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
; Script de lancement silencieux de secours
Source: "LANCER-SILENCIEUX.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "http://127.0.0.1:3001"; IconFilename: "{app}\public\gesticom.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://127.0.0.1:3001"; IconFilename: "{app}\public\gesticom.ico"; Tasks: desktopicon

[Run]
; Enregistrement et démarrage du service
Filename: "{app}\{#MyAppExeName}"; Parameters: "install"; Flags: runhidden
Filename: "{app}\{#MyAppExeName}"; Parameters: "start"; Flags: runhidden

[UninstallRun]
; Arrêt et suppression du service lors de la désinstallation
Filename: "{app}\{#MyAppExeName}"; Parameters: "stop"; Flags: runhidden; RunOnceId: "StopService"
Filename: "{app}\{#MyAppExeName}"; Parameters: "uninstall"; Flags: runhidden; RunOnceId: "UninstallService"

[Code]
// Vérification et arrêt du service existant lors de la MAJ
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  // On tente d'arrêter le service avant de copier les nouveaux fichiers
  // Utilisation de taskkill pour être sûr que le processus node lié au service est bien coupé
  Exec('taskkill', '/F /IM node.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Arrêt et suppression du service via le wrapper WinSW (GestiComService.exe)
  // On ne peut pas facilement appeler GestiComService.exe car il n'est peut-être pas encore là
  // Mais on peut utiliser SC (Service Control) intégré à Windows
  Exec('sc', 'stop GestiComPro', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('sc', 'delete GestiComPro', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Un petit délai pour laisser Windows libérer les verrous
  Sleep(1000);
end;

; Script d'installation GestiCom Pro - GSN EXPERTISES GROUP
#define MyAppName "GestiCom Pro"
#define MyAppVersion "2.0.1"
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
Compression=lzma2/ultra64
SolidCompression=yes
InternalCompressLevel=ultra
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Dirs]
; Création du dossier de données avec accès complet avant l'installation
Name: "C:\gesticom"; Permissions: everyone-full

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; IMPORTANT: Recopie du serveur standalone (optimisé par Next.js)
Source: ".next\standalone\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.ts, *.map, *.bak, *.tmp, node_modules\prisma\build\public, node_modules\prisma\scripts"

; Recopie des fichiers statiques essentiels pour le rendu UI (Poids plume)
Source: ".next\static\*"; DestDir: "{app}\.next\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "screenshots, documentation"

; Prisma : indispensable pour la base de données
Source: "prisma\schema.prisma"; DestDir: "{app}\prisma"; Flags: ignoreversion

; Moteur Node.js et Service Windows (WinSW)
Source: "node.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "GestiComService.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "GestiComService.xml"; DestDir: "{app}"; Flags: ignoreversion

; Moteur de Migration (Prisma CLI) indispensable pour l'auto-update (uniquement le vital)
Source: "node_modules\prisma\build\index.js"; DestDir: "{app}\node_modules\prisma\build"; Flags: ignoreversion
Source: "node_modules\@prisma\engines\query_engine-windows.dll.node"; DestDir: "{app}\node_modules\@prisma\engines"; Flags: ignoreversion
Source: "node_modules\@prisma\engines\schema-engine-windows.exe"; DestDir: "{app}\node_modules\@prisma\engines"; Flags: ignoreversion

; Configuration environnementale (.env déjà validé)
Source: ".env"; DestDir: "{app}"; Flags: ignoreversion

; Base de données initiale : On ne l'écrase JAMAIS si elle existe déjà (uninsneveruninstall)
Source: "prisma\gesticom.db"; DestDir: "C:\gesticom"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall

; Scripts VITAUX uniquement (On ignore les 15 autres scripts de dev)
Source: "scripts\standalone-launcher.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\repair-client-db.ts"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "LANCER-SILENCIEUX.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "http://127.0.0.1:3001"; IconFilename: "{app}\public\gesticom.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://127.0.0.1:3001"; IconFilename: "{app}\public\gesticom.ico"; Tasks: desktopicon

[Run]
; Installation et démarrage du service silencieux en fin d'install
Filename: "{app}\{#MyAppExeName}"; Parameters: "install"; Flags: runhidden
Filename: "{app}\{#MyAppExeName}"; Parameters: "start"; Flags: runhidden
; Lancement automatique du navigateur vers l'application
Filename: "explorer"; Parameters: "http://127.0.0.1:3001"; Flags: postinstall shellexec; Description: "Lancer GestiCom Pro"

[UninstallRun]
; Nettoyage propre lors de la suppression du logiciel
Filename: "{app}\{#MyAppExeName}"; Parameters: "stop"; Flags: runhidden; RunOnceId: "StopService"
Filename: "{app}\{#MyAppExeName}"; Parameters: "uninstall"; Flags: runhidden; RunOnceId: "UninstallService"

[Code]
// Fonction de sécurité pour arrêter toute ancienne instance lors d'une mise à jour
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  // Force l'arrêt de node pour libérer les fichiers
  Exec('taskkill', '/F /IM node.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Supprime proprement l'ancien service s'il existe
  Exec('sc', 'stop GestiComPro', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec('sc', 'delete GestiComPro', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  Sleep(1000); // Laisse le temps au système de souffler
end;

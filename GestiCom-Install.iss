; Script d'installation GestiCom Pro - GSN EXPERTISES GROUP
; Version 3.23.2 - Production Finale
#define MyAppName "GestiCom Pro"
#define MyAppVersion "3.41.15"
#define MyAppPublisher "GSN EXPERTISES GROUP"
#define MyAppURL "https://www.gsnexpertises.com"
#define MyAppExeName "node.exe"

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
OutputBaseFilename=GestiCom-Pro-v{#MyAppVersion}-Setup
SetupIconFile=public\gesticom.ico
; --- VISUELS PREMIUM ORANGE (VALIDÉS) ---
WizardImageFile=public\wizard-side.bmp
WizardSmallImageFile=public\wizard-top.bmp
; --- LICENSE (VALIDÉE) ---
LicenseFile=license.rtf
; ----------------------------------------
Compression=lzma2/ultra64
SolidCompression=yes
InternalCompressLevel=ultra
WizardStyle=modern
PrivilegesRequired=admin
DisableWelcomePage=no
ShowLanguageDialog=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Dirs]
; Création du dossier de données avec accès complet avant l'installation
Name: "C:\gesticom"; Permissions: everyone-full

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; IMPORTANT: Recopie du serveur standalone (optimisé par Next.js)
Source: ".next\standalone\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.d.ts, *.ts, *.map, *.bak, *.tmp, *.exe, GestiCom-Pro-*-Setup.exe"

; Recopie des fichiers statiques essentiels pour le rendu UI (Poids plume)
Source: ".next\static\*"; DestDir: "{app}\.next\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: ".next\static\chunks\*.css"; DestDir: "{app}\.next\static\chunks"; Flags: ignoreversion
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "screenshots, documentation"

; Prisma : schéma + migrations (indispensable pour prisma migrate deploy)
Source: "prisma\schema.prisma"; DestDir: "{app}\prisma"; Flags: ignoreversion
Source: "prisma\migrations\*"; DestDir: "{app}\prisma\migrations"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; Moteur Node.js
Source: "node.exe"; DestDir: "{app}"; Flags: ignoreversion

; IMPORTANT: Tous les packages nécessaires pour la CLI et le seed (migration, seed, debug)
; Ces packages ne sont PAS inclus dans le standalone Next.js, ils sont copiés depuis le projet.
Source: "node_modules\prisma\*"; DestDir: "{app}\node_modules\prisma"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "node_modules\@prisma\*"; DestDir: "{app}\node_modules\@prisma"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "node_modules\bcryptjs\*"; DestDir: "{app}\node_modules\bcryptjs"; Flags: ignoreversion recursesubdirs createallsubdirs

; Configuration environnementale (.env) : ne jamais écraser en MAJ (préserve secrets/config prod)
Source: ".env"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall

; Base de données initiale : On ne l'écrase JAMAIS si elle existe déjà (uninsneveruninstall)
Source: "prisma\gesticom.db"; DestDir: "C:\gesticom"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall skipifsourcedoesntexist

; Service Windows (NSSM)
Source: "nssm.exe"; DestDir: "{app}"; Flags: ignoreversion

; Scripts VITAUX uniquement
Source: "start.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\standalone-launcher.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\install-service.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\maintenance-runner.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\seed.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\sauvegarde-bd.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "LANCER-SILENCIEUX.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\LANCER-SILENCIEUX.vbs"""; IconFilename: "{app}\public\gesticom.ico"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\LANCER-SILENCIEUX.vbs"""; IconFilename: "{app}\public\gesticom.ico"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Supprimer le verrou "rebuild-ecritures" pour relance automatique lors de chaque MAJ
; (évite toute action manuelle côté client)
Filename: "{cmd}"; Parameters: "/C if exist ""C:\gesticom\maintenance\rebuild-ecritures-*.done"" del /Q ""C:\gesticom\maintenance\rebuild-ecritures-*.done"""; Flags: runhidden; StatusMsg: "Préparation de la normalisation comptable..."

; Optimisation et Recalcul automatique de la base de données (MAJ)
Filename: "{app}\node.exe"; Parameters: """{app}\scripts\maintenance-runner.js"""; Flags: runhidden; StatusMsg: "Optimisation des données et calcul des soldes..."

; Installation et démarrage du service Windows GestiCom (invisible)
Filename: "{app}\node.exe"; Parameters: """{app}\scripts\install-service.js"""; Flags: runhidden; StatusMsg: "Installation du service GestiCom Pro..."

; Lancer GestiCom Pro automatiquement à la fin de l'installation/MAJ
Filename: "wscript.exe"; Parameters: """{app}\LANCER-SILENCIEUX.vbs"""; WorkingDir: "{app}"; Flags: postinstall nowait runhidden; StatusMsg: "Lancement de GestiCom Pro..."; Description: "Lancer GestiCom Pro"

[UninstallRun]
; Arrêter et supprimer le service Windows une seule fois à la désinstallation
Filename: "{sys}\sc.exe"; Parameters: "stop GestiComPro"; Flags: runhidden; RunOnceId: "StopGestiComProService"
Filename: "{sys}\sc.exe"; Parameters: "delete GestiComPro"; Flags: runhidden; RunOnceId: "DeleteGestiComProService"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM node.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop GestiComPro', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'), 'delete GestiComPro', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1000);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

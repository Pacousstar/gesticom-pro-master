; Script d'installation GestiCom Pro - GSN EXPERTISES GROUP
; Version 3.41.17 - Multi-postes support
#define MyAppName "GestiCom Pro"
#define MyAppVersion "3.45.4"
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
WizardImageFile=public\wizard-side.png
WizardSmallImageFile=public\wizard-top.png
LicenseFile=license.rtf
Compression=lzma2/ultra64
SolidCompression=yes
InternalCompressLevel=ultra
WizardStyle=modern
PrivilegesRequired=admin
DisableWelcomePage=no
ShowLanguageDialog=no

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Types]
Name: "simple"; Description: "Simple (SQLite, 1 poste)"
Name: "server"; Description: "Serveur (PostgreSQL, multi-postes)"

[Components]
Name: "app"; Description: "Application GestiCom Pro"; Types: simple server; Flags: fixed
Name: "postgres"; Description: "PostgreSQL 16 (Base de donnees multi-postes)"; Types: server

[Dirs]
Name: "C:\gesticom"; Permissions: everyone-full
Name: "{app}\logs"; Permissions: everyone-full

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Application standalone
Source: ".next\standalone\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.d.ts, *.ts, *.map, *.bak, *.tmp, *.exe, GestiCom-Pro-*-Setup.exe"
Source: ".next\static\*"; DestDir: "{app}\.next\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: ".next\static\chunks\*.css"; DestDir: "{app}\.next\static\chunks"; Flags: ignoreversion
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "screenshots, documentation"

; Prisma
Source: "prisma\schema.prisma"; DestDir: "{app}\prisma"; Flags: ignoreversion
Source: "prisma\migrations\*"; DestDir: "{app}\prisma\migrations"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; Node.js
Source: "node.exe"; DestDir: "{app}"; Flags: ignoreversion

; Packages CLI
Source: "node_modules\prisma\*"; DestDir: "{app}\node_modules\prisma"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "node_modules\@prisma\*"; DestDir: "{app}\node_modules\@prisma"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "node_modules\bcryptjs\*"; DestDir: "{app}\node_modules\bcryptjs"; Flags: ignoreversion recursesubdirs createallsubdirs

; PostgreSQL (composant serveur uniquement)
Source: "pgsql\postgresql-16.14-2-windows-x64-binaries.zip"; DestDir: "{app}\pgsql"; Flags: ignoreversion; Components: postgres

; Configuration
Source: ".env"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall
Source: "prisma\gesticom.db"; DestDir: "C:\gesticom"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall skipifsourcedoesntexist

; Service Windows
Source: "nssm.exe"; DestDir: "{app}"; Flags: ignoreversion

; Scripts
Source: "start.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "scripts\standalone-launcher.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\install-service.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\install-postgres.js"; DestDir: "{app}\scripts"; Flags: ignoreversion; Components: postgres
Source: "scripts\maintenance-runner.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\seed.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\sauvegarde-bd.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\scheduled-backup.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\migrate-sqlite-to-postgres.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "LANCER-SILENCIEUX.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\LANCER-SILENCIEUX.vbs"""; IconFilename: "{app}\public\gesticom.ico"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: """{app}\LANCER-SILENCIEUX.vbs"""; IconFilename: "{app}\public\gesticom.ico"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Nettoyage maintenance
Filename: "{cmd}"; Parameters: "/C if exist ""C:\gesticom\maintenance\rebuild-ecritures-*.done"" del /Q ""C:\gesticom\maintenance\rebuild-ecritures-*.done"""; Flags: runhidden; StatusMsg: "Préparation de la normalisation comptable..."

; Installation PostgreSQL (si mode serveur) — mot de passe via {code:GetPgPassword}
Filename: "{app}\node.exe"; Parameters: """{app}\scripts\install-postgres.js"" --password ""{code:GetPgPassword}"""; WorkingDir: "{app}"; Flags: runhidden; StatusMsg: "Installation et configuration de PostgreSQL..."; Components: postgres

; Optimisation et maintenance
Filename: "{app}\node.exe"; Parameters: """{app}\scripts\maintenance-runner.js"""; Flags: runhidden; StatusMsg: "Optimisation des donnees et calcul des soldes..."

; Installation du service GestiCom
Filename: "{app}\node.exe"; Parameters: """{app}\scripts\install-service.js"""; Flags: runhidden; StatusMsg: "Installation du service GestiCom Pro..."

; Lancement de l'application
Filename: "wscript.exe"; Parameters: """{app}\LANCER-SILENCIEUX.vbs"""; WorkingDir: "{app}"; Flags: postinstall nowait runhidden; StatusMsg: "Lancement de GestiCom Pro..."; Description: "Lancer GestiCom Pro"

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop GestiComPro"; Flags: runhidden; RunOnceId: "StopGestiComProService"
Filename: "{sys}\sc.exe"; Parameters: "delete GestiComPro"; Flags: runhidden; RunOnceId: "DeleteGestiComProService"
; Arrêter et supprimer PostgreSQL si installé
Filename: "{sys}\sc.exe"; Parameters: "stop PostgreSQL"; Flags: runhidden; RunOnceId: "StopPostgreSQLService"
Filename: "{sys}\sc.exe"; Parameters: "delete PostgreSQL"; Flags: runhidden; RunOnceId: "DeletePostgreSQLService"

[Code]
var
  PgPasswordPage: TInputQueryWizardPage;
  PgPassword: String;

procedure InitializeWizard;
begin
  PgPasswordPage := CreateInputQueryPage(
    wpSelectComponents,
    'Configuration PostgreSQL',
    'Parametres de la base de donnees',
    'Veuillez choisir un mot de passe pour la base de donnees PostgreSQL.'#13#10
    'Ce mot de passe sera utilise pour la connexion depuis GestiCom Pro.');
  PgPasswordPage.Add('Mot de passe (minimum 8 caracteres):', False);
  PgPasswordPage.Add('Confirmer le mot de passe:', False);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if PageID = PgPasswordPage.ID then
    Result := not WizardIsComponentSelected('postgres');
end;

function NextButtonClick(PageID: Integer): Boolean;
var
  pw1, pw2: String;
begin
  Result := True;
  if PageID = PgPasswordPage.ID then
  begin
    pw1 := PgPasswordPage.Values[0];
    pw2 := PgPasswordPage.Values[1];
    if (pw1 = '') or (Length(pw1) < 8) then
    begin
      MsgBox('Le mot de passe doit faire au moins 8 caracteres.', mbError, MB_OK);
      Result := False;
    end
    else if pw1 <> pw2 then
    begin
      MsgBox('Les mots de passe ne correspondent pas.', mbError, MB_OK);
      Result := False;
    end
    else
      PgPassword := pw1;
  end;
end;

function GetPgPassword(Param: String): String;
begin
  Result := PgPassword;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM node.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop GestiComPro', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'), 'delete GestiComPro', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop PostgreSQL', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1000);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

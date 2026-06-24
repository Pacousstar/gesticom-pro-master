param(
  [string]$BackupDir = "backups",
  [int]$RetentionDays = 30
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$projectRoot = Split-Path -Parent $PSScriptRoot
$backupPath = Join-Path -Path $projectRoot -ChildPath $BackupDir

if (-not (Test-Path $backupPath)) {
  New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
}

$envPath = Join-Path -Path $projectRoot -ChildPath ".env"
if (-not (Test-Path $envPath)) {
  Write-Error "Fichier .env introuvable à $envPath"
  exit 1
}

$dbUrl = Select-String -Path $envPath -Pattern "DATABASE_URL=" | ForEach-Object { $_ -replace '.*DATABASE_URL="?(.*?)"?.*', '$1' }
if (-not $dbUrl) {
  Write-Error "DATABASE_URL non trouvée dans .env"
  exit 1
}

if ($dbUrl -match "file:(.*)") {
  $dbFile = $Matches[1]
  if (-not [System.IO.Path]::IsPathRooted($dbFile)) {
    $dbFile = Join-Path -Path $projectRoot -ChildPath $dbFile
  }
  if (Test-Path $dbFile) {
    $backupFile = Join-Path -Path $backupPath -ChildPath "gesticom-pro-$timestamp.db"
    Copy-Item -Path $dbFile -Destination $backupFile
    Write-Output "Backup SQLite créé : $backupFile"
  } else {
    Write-Error "Fichier DB introuvable : $dbFile"
    exit 1
  }
} elseif ($dbUrl -match "postgresql://(.*?)@(.*?):(\d+)/(.*)") {
  $pgHost = $Matches[2]
  $pgPort = $Matches[3]
  $pgDb = $Matches[4]
  Write-Output "Base PostgreSQL détectée : $pgHost:$pgPort/$pgDb"
  $pgDump = Get-Command "pg_dump" -ErrorAction SilentlyContinue
  if (-not $pgDump) {
    $possiblePaths = @(
      "$env:ProgramFiles\PostgreSQL\*\bin\pg_dump.exe",
      "${env:ProgramFiles(x86)}\PostgreSQL\*\bin\pg_dump.exe",
      "C:\tools\postgresql\*\bin\pg_dump.exe"
    )
    foreach ($pattern in $possiblePaths) {
      $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($found) { $pgDump = $found; break }
    }
  }
  if ($pgDump) {
    $backupFile = Join-Path -Path $backupPath -ChildPath "gesticom-pro-$timestamp.sql"
    $env:PGPASSWORD = $Matches[1] -replace '.*:'
    & $pgDump.Source -h $pgHost -p $pgPort -U ($Matches[1] -replace ':.*') -F c -f $backupFile $pgDb
    if ($LASTEXITCODE -eq 0) {
      Write-Output "Backup PostgreSQL créé : $backupFile"
    } else {
      Write-Error "Échec du backup PostgreSQL. Vérifiez que pg_dump est installé et accessible."
    }
  } else {
    Write-Output "pg_dump introuvable. Backup manuel requis depuis :"
    Write-Output "  $dbUrl"
  }
} elseif ($dbUrl -match "mysql|sqlserver") {
  Write-Output "Backup de base distante non automatisé. Exportez manuellement depuis :"
  Write-Output "  $dbUrl"
} else {
  Write-Error "Type de base non supporté : $dbUrl"
  exit 1
}

# Nettoyage des vieux backups
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $backupPath -Filter "gesticom-pro-*.db" | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
  Remove-Item -Path $_.FullName -Force
  Write-Output "Supprimé (ancien) : $($_.Name)"
}

Write-Output "Backup terminé. Retention : $RetentionDays jours."

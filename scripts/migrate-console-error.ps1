param(
    [int]$Limit = 0
)

$rootDir = "C:\Users\GSN-EXPERTISES\Projets\gesticom-pro-master"
$apiDir = Join-Path -Path $rootDir -ChildPath "app\api"

$files = Get-ChildItem -Path $apiDir -Filter "route.ts" -Recurse | Sort-Object FullName

if ($Limit -gt 0) {
    $files = $files | Select-Object -First $Limit
}

$totalFiles = 0
$totalReplacements = 0

function Get-RoutePath {
    param([string]$FilePath, [string]$ApiDir)
    $relative = $FilePath.Substring($ApiDir.Length + 1)
    $relative = $relative -replace '\\', '/'
    $relative = $relative -replace '/route\.ts$', ''
    return "api/$relative"
}

foreach ($file in $files) {
    $fullPath = $file.FullName
    Write-Host "Checking: $fullPath" -ForegroundColor Gray

    $content = [System.IO.File]::ReadAllText($fullPath)

    if ($content -notmatch 'console\.error\(' -or $content -match 'apiCatch') {
        Write-Host "  Skipped (no console.error or already has apiCatch)" -ForegroundColor DarkGray
        continue
    }

    $routePath = Get-RoutePath $fullPath $apiDir

    $pattern = "console\.error\((['""])((?:(?!\1).)*?)\1,\s*(e|error|err)\)"
    $replacement = "await apiCatch(`$3, '$routePath')"

    $count = [regex]::Matches($content, $pattern).Count
    if ($count -eq 0) {
        Write-Host "  Skipped (no matching console.error pattern)" -ForegroundColor DarkGray
        continue
    }

    $newContent = [regex]::Replace($content, $pattern, $replacement)

    $lines = $newContent -split "`r?`n"
    $lastImport = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^import ') {
            $lastImport = $i
        }
    }

    $result = @()
    for ($i = 0; $i -le $lastImport; $i++) {
        $result += $lines[$i]
    }
    $result += "import { apiCatch } from '@/lib/log-error'"
    for ($i = $lastImport + 1; $i -lt $lines.Count; $i++) {
        $result += $lines[$i]
    }

    $finalContent = $result -join "`r`n"
    [System.IO.File]::WriteAllText($fullPath, $finalContent)

    $totalFiles++
    $totalReplacements += $count
    Write-Host "  Modified: $count replacement(s) using path '$routePath'" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "  Files modified : $totalFiles"
Write-Host "  Replacements   : $totalReplacements"

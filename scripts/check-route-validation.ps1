# Vérifie que toutes les routes POST/PUT/PATCH/DELETE utilisent validateApiRequest
# Usage: powershell scripts/check-route-validation.ps1

$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$apiDir = Join-Path $root "app/api"
$errors = @()
$exempted = @(
    'auth/login/route.ts',       # utilise safeParse direct
    'auth/register/route.ts',    # utilise safeParse direct
    'clients/route.ts',          # utilise safeParse direct
    'fournisseurs/route.ts',     # utilise safeParse direct
    'parametres/route.ts',       # utilise safeParse direct
    'produits/route.ts',         # utilise safeParse direct
    'sauvegarde/restore/route.ts',
    'utilisateurs/[id]/route.ts',
    'achats/import/route.ts',       # FILE_UPLOAD
    'clients/import/route.ts',      # FILE_UPLOAD
    'fournisseurs/import/route.ts', # FILE_UPLOAD
    'import/excel/route.ts',        # FILE_UPLOAD
    'import-export/route.ts',       # FILE_UPLOAD
    'produits/import/route.ts',     # FILE_UPLOAD
    'produits/import-csv/route.ts', # FILE_UPLOAD
    'ventes/import/route.ts',       # FILE_UPLOAD
    'admin/migration-master/route.ts', # MAINTENANCE
    'audit-master/route.ts',           # MAINTENANCE
    'comptabilite/backfill-ecritures/route.ts', # MAINTENANCE
    'comptabilite/init/route.ts',               # MAINTENANCE
    'maintenance/fiabilisation/route.ts',       # MAINTENANCE
    'maintenance/reconcile-accounting/route.ts', # MAINTENANCE
    'maintenance/sync-paiements/route.ts',      # MAINTENANCE
    'ping/route.ts',           # MAINTENANCE
    'sauvegarde/route.ts',     # MAINTENANCE
    'sauvegarde/backup/route.ts',   # MAINTENANCE
    'sauvegarde/manuelle/route.ts', # MAINTENANCE
    'magasins/ajout-defaut/route.ts', # BOOTSTRAP
    'produits/bootstrap/route.ts',     # BOOTSTRAP
    'banques/operations/[id]/route.ts', # SIMPLE_DELETE
    'caisse/[id]/route.ts',             # SIMPLE_DELETE
    'errors/list/route.ts',             # SIMPLE_DELETE
    'mouvements/[id]/route.ts',         # SIMPLE_DELETE
    'retours/[id]/route.ts',            # SIMPLE_DELETE
    'sauvegarde/delete/route.ts',       # SIMPLE_DELETE
    'auth/logout/route.ts',             # AUTH (no body)
    'clients/[id]/relance/route.ts',    # EXEMPT (action trigger)
    'commandes-fournisseurs/[id]/transformer-en-achat/route.ts', # EXEMPT
    'reglements/ventes/[id]/annuler-lettrage/route.ts'           # EXEMPT
)

Get-ChildItem -LiteralPath $apiDir -Recurse -Filter "route.ts" | ForEach-Object {
    $relPath = $_.FullName.Substring($apiDir.Length + 1).Replace('\', '/')
    $methods = @()
    $content = Get-Content -LiteralPath $_.FullName -Raw

    if ($content -match 'export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b') {
        $methods += $matches[1]
    }

    if ($methods.Count -eq 0) { return }

    $isExempted = $false
    foreach ($ex in $exempted) {
        if ($relPath -like "*$ex" -or $relPath -eq $ex) { $isExempted = $true; break }
    }

    if (-not $isExempted -and ($content -notmatch 'validateApiRequest')) {
        $errors += "$relPath ($($methods -join ', '))"
    }
}

if ($errors.Count -gt 0) {
    Write-Host "ERREUR: $($errors.Count) routes sans validateApiRequest :" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    exit 1
} else {
    Write-Host "OK : Toutes les routes POST/PUT/PATCH/DELETE ont validateApiRequest." -ForegroundColor Green
    exit 0
}

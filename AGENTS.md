# AGENTS.md — GestiCom Pro (guide opérationnel)

## Procédure de MAJ en ligne (boucle complète, 3 repos + 1 release)

À exécuter à chaque nouvelle version. Les 3 dépôts sont DISTINCTS — ne pas les confondre.

### Repos
| Rôle | Local | Remote | Branche |
|---|---|---|---|
| Code application | `C:\Users\GSN-EXPERTISES\Projets\gesticom-pro-master` | `origin` = Pacousstar/gesticom-pro-master | `main` |
| Site web (landing + update/) | même clone (remote `gesticom-pro`) | `gesticom-pro` = Pacousstar/GestiCom-Pro | `main` |
| Site formation | `C:\Users\GSN-EXPERTISES\Projets\gesticom-pro-formation` | `origin` = Pacousstar/gesticom-pro-formation | `main` |
| Release exe | — | GitHub Releases tag `production` | — |

### Étape 1 — Build
- `npm run electron:build` (bump-version.js incrémente la version patch+1 automatiquement ; zip postgres déjà dans `pgsql/`).
- Vérifs : `npx eslint` (0), `npx tsc --noEmit` (0), `node --check electron/main.js`, `node --check electron/preload.js`.
- Sortie : `release\GestiCom Pro-v<X>-Setup.exe`. Ne JAMAIS committer `release/`.

### Étape 2 — Publier la release GitHub (Pacousstar/GestiCom-Pro)
- Asset au nom FIXE `GestiCom-Pro-Setup.exe` (pas le nom versionné !) sur la release existante tag `production`.
- Calculer le SHA256 de l'exe : `(Get-FileHash <exe> -Algorithm SHA256).Hash`.

### Étape 3 — Repo code (branche main → origin)
- Mettre à jour `update/version.json` : `version` = <X>, `checksum` = SHA256 ci-dessus, `changelog`, `releaseDate`, `downloadUrl` = `https://github.com/Pacousstar/GestiCom-Pro/releases/download/production/GestiCom-Pro-Setup.exe` (inchangé).
- `version.json` racine (maj `version` + `buildDate`) est mis à jour par le build (bump-version).
- Commit + `git push origin main`.

### Étape 4 — Site GestiCom-Pro (branche main → gesticom-pro)
- Worktree temporaire : `git worktree add -b maj-<X> <TEMP>\opencode\site-<X> gesticom-pro/main`.
- Mettre à jour :
  - `version.json` (version + buildDate) ;
  - `update/version.json` (identique à l'étape 3 — c'est LE fichier lu par les clients) ;
  - `index.html` : remplacer l'ancienne version (ex. `3.51.12` → nouvelle) et la taille `(### Mo)` du bouton Télécharger.
- Commit + `git push gesticom-pro maj-<X>:main` ; nettoyer : `git worktree remove --force` + `git branch -d maj-<X>`.
- ⚠️ GitHub Pages peut ne pas redéployer tout de suite : surveiller `https://api.github.com/repos/Pacousstar/GestiCom-Pro/actions/runs` (dernier run `success`). En cas d'échec/annulation : pousser un micro-commit trigger (commentaire HTML) sur la même branche.

### Étape 5 — Site formation (branche main → origin)
- Remplacer l'ancienne version par <X> dans : `index.html`, `fiche-produit-gesticom-pro.html`, `formation-commerciale-gesticom-pro.html`.
- Commit + `git push origin main`.
- ⚠️ `.nojekyll` DOIT exister à la racine (fichier vide) — sans lui le build Jekyll échoue et Pages ne redéploie pas. Même surveillance des runs qu'à l'étape 4, URL : `https://api.github.com/repos/Pacousstar/gesticom-pro-formation/actions/runs`.

### Étape 6 — Vérifications en ligne (toujours les faire)
- `curl https://pacousstar.github.io/GestiCom-Pro/index.html` → contient `v<X>` et la bonne taille.
- `curl https://pacousstar.github.io/GestiCom-Pro/update/version.json` → `version` = <X>, `checksum` non vide.
- `curl https://pacousstar.github.io/gesticom-pro-formation/index.html` → contient `v<X>`.
- `curl -sIL https://github.com/Pacousstar/GestiCom-Pro/releases/download/production/GestiCom-Pro-Setup.exe` → 200.

## Pièges connus
- Toujours publier la release exe AVANT de pousser `update/version.json` (sinon lien de téléchargement mort).
- Le downloadUrl doit pointer sur l'asset au nom fixe `GestiCom-Pro-Setup.exe`, jamais sur le nom versionné.
- Fichiers avec accents : rester en UTF-8 (ne pas réécrire en cp1252 ; en PowerShell, préférer les outils de lecture/écriture UTF-8).
- Les clients vérifient les MAJ toutes les 6 h (`components/UpdateChecker.tsx`, `CHECK_INTERVAL`).
- `git fetch --all` avant toute action sur les remotes (deux clones du repo GestiCom-Pro existent sur la machine : `gesticom-pro` et `gesticom-pro-master`).
- Le mécanisme d'installation automatique : `electron/main.js` (handler IPC `install-update`, Setup NSIS `/S`, fermeture + relance auto) + `electron/preload.js` (`installUpdate`).

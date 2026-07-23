# Résumé de session — 21/07/2026

## Ce qui a été fait

### Landing page & GitHub Pages
- Modale de pré-inscription, images locales restaurées
- Formulaire contact simplifié (Nom, Email, Sujet, Message)
- Cache-control meta tags
- 3 boutons Télécharger (header, hero, section download) → modale
- Logo header/footer → `logo.png`
- Footer : "Développé avec ❤ par Pacousstar"
- Landing page synchronisée entre `docs/index.html` et repo `GestiCom-Pro`
- Encodage UTF-8 : transformations faites en Node.js (pas PowerShell)

### Fix applicatifs
- **Date comptabilisation** (`reglement/route.ts`) : `date: new Date()` → `reglement.date`
- **Relevé CC** : section print-only avec Total Débit/Crédit/Solde Net
- **Solde** : "la personne" remplacé par `${data.nom}` (ex: "Débiteur (COCO doit au CC)")
- **Détail Factures** : ajout `referenceId` aux transactions API, filtrage pour n'afficher que les ventes/achats réellement dans le CC
- **Filtre date CC client** : `soldeInitial`/`avoirInitial` dataient `new Date().toISOString()` (date du jour) → tri chronologique faussé avec filtre. Corrigé en `new Date(0).toISOString()` (epoch 1970) comme le fournisseur
- **DB vierge** : `prisma/gesticom.db` supprimé du projet (8,7 Mo, vestige). Nouveaux clients : DB créée automatiquement par `prisma db push` + `seed.js` (admin/Admin@123 + MM01 + MAG01). Clients existants : données conservées (flag `onlyifdoesntexist`)

### Licences générées (RSA-256, max 3.47.x)
1. QUINCAILLERIE ETB (expire 2027-05-01)
2. QUINCAILLERIE KARIM OUEDRAOGO (expire 2027-06-01)
3. PIECES AUTO CA++ (expire 2027-04-01)

### Commits
- `0871d2e` — fix date comptabilisation + impression relevé + solde nom + logo/footer
- `45d0dfe` — fix Détail Factures filtré aux seules factures liées au CC
- `fe95c44` — fix soldeInitial/avoirInitial date fixe (epoch) pour filtres CC client

### Session 22/07/2026
- **Landing page** : vidéo retirée de la landing GitHub Pages + revert GH repo
- **Page d'accueil app** : vidéo `gestiCom pro1.mp4` en fond plein écran sur `app/page.tsx`
- **Fix type TS** : `allOperations: any[]` pour accepter `SOLDE_OUVERTURE` dans le CC client
- **Fix Zod v4** : `.partial()` impossible sur schéma avec `.refine()` → extrait `clientSchemaBase` + `clientSchemaPartial` pour le PATCH (`e0f709e`)

## Procédure multi-poste (PostgreSQL)

### Sur le serveur
1. Installer PostgreSQL 16 depuis enterprisedb.com (mot de passe simple, sans `@` ni `:`)
2. `psql -U postgres` → `CREATE DATABASE gesticom;` + `CREATE USER gesticom WITH PASSWORD '...';` + `GRANT ALL PRIVILEGES ON DATABASE gesticom TO gesticom;` + `ALTER DATABASE gesticom OWNER TO gesticom;`
3. Modifier `C:\GestiComPro\.env` : `DATABASE_URL="postgresql://gesticom:MotDePasse@localhost:5432/gesticom"`
4. `node.exe scripts\migrate-sqlite-to-postgres.js "postgresql://gesticom:MotDePasse@localhost:5432/gesticom"`
5. App → Paramètres → Mode d'installation → **Réseau (Serveur interne)** → Enregistrer → Redémarrer

### Sur chaque poste client
- Installer GestiCom en mode Simple (SQLite)
- `.env` : `DATABASE_URL="postgresql://gesticom:MotDePasse@192.168.1.100:5432/gesticom"` (IP du serveur)

### Pourquoi l'installation embarquée a échoué
- L'antivirus bloque `initdb.exe` ou l'extraction du zip PostgreSQL
- Solution : installer PostgreSQL manuellement via l'installateur EDB

### Session 23/07/2026 — Impression GestiCom (toutes les pages dashboard)
- **Clients** : 5 colonnes (N°/CODE, NOM/Tél., Localisation/NCC, TYPE/Plafond, Solde Global). Overlay + `printInNewWindow` avec pagination, `firstPageSize: 8`.
- **Soldes clients** : 4 colonnes (Partenaire/Identifiant, Localisation, Facturation/Règlements, Solde Global Net/État). Compteurs (Total Dû, Total Payé, Solde, Clients). `firstPageSize: 8`.
- **Fournisseurs** : 4 colonnes (N°/Identifiant, Partenaire/Contact, Localisation, Net à Payer).
- **Soldes fournisseurs** : 5 colonnes (N°, Nom du Fournisseur, Dette Totale/Payé, Reste/Variation, Solde Net Global). Compteurs.
- **Caisse** : 4 colonnes (N°/Date, Magasin, Motif/Type, Montant). Compteurs (Entrées, Sorties, Solde, Opérations).
- **Banque** : bouton Imprimer → fetch `/api/banques/flux-digitaux` → affiche Flux Virtuels (Date, Type, Mode, Source, Bénéficiaire, Libellé/Référence, Montant). Compteurs (Entrées, Sorties, Solde, Opérations).
- `ListPrintWrapper` supprimé de toutes les pages. `w.print()` ajouté sur clients et soldes (était manquant). `setIsPrinting(true)` retiré de Banque.

### Session 23/07/2026 (suite) — Fix Bilan + Export
- **Bilan** : restauré à l'original (overlay GestiCom). Ajout boutons **Excel** et **PDF** (téléchargement direct via `fetch`+`blob`, API existantes `export-excel`/`export-pdf`).
- **Fix tsc** : `X` import manquant dans `stock/page.tsx`, `o.magasin` objet non ReactNode dans `caisse/page.tsx` → corrigés.

## Prochaine étape
- Valider avec le client les corrections apportées
- Déploiement nouvelle version sur Google Drive

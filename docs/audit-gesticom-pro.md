# Audit Complet — GestiCom Pro

> **Date** : Mai 2026  
> **Version auditée** : 2.0.5  
> **Référentiel** : `gesticom-pro-master`  
> **Auditeur** : Architecture & sécurité logicielle

---

## Sommaire

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Structure du code](#2-structure-du-code)
3. [Frontend](#3-frontend)
4. [Backend / logique métier](#4-backend--logique-métier)
5. [Base de données](#5-base-de-données)
6. [Authentification / autorisation / sécurité](#6-authentification--autorisation--sécurité)
7. [Qualité technique](#7-qualité-technique)
8. [Qualité produit](#8-qualité-produit)
9. [Plan de correction priorisé](#9-plan-de-correction-priorisé)
10. [Plan Sprint 1](#10-plan-sprint-1)
11. [Top 15 actions immédiates](#11-top-15-actions-immédiates)

---

## 1. Vue d'ensemble du projet

### 1.1 Stack réelle détectée

| Technologie | Version |
|---|---|
| Next.js | 16.2.2 (App Router) |
| React | 19.2.3 |
| TypeScript | 5.9.3 |
| Prisma | 5.22.0 |
| Base de données | SQLite (fichier local) |
| Auth | JWT custom (jose, HS256) |
| State management | Zustand 5, SWR 2 |
| UI | Tailwind CSS 4, lucide-react |
| Validation | Zod 4.3.6 |
| PDF | jsPDF 4.1.0 |
| Export | xlsx-prototype-pollution-fixed |
|cron| node-cron 4.2.1 |
| Mail | nodemailer 8.0.1 |

### 1.2 Architecture générale

- **App Router** Next.js avec `(dashboard)` group route protégé par layout server-side
- **API Routes** dans `app/api/` — 43 endpoints REST
- **Logique métier** centralisée dans `lib/` (30 fichiers)
- **Schéma Prisma** : ~25 modèles, multi-entité (champ `entiteId`)
- **Composants UI** : 2 composants shared (`Pagination`, `Toast`), 7 composants dashboard spécifiques
- **PWA** configurable avec `@ducanh2912/next-pwa`

### 1.3 Modules fonctionnels présents

| Module | Statut |
|---|---|
| Authentification (login/logout/session) | Fonctionnel |
| Gestion multi-entités | Partiel (boundaries cassées) |
| Gestion utilisateurs (CRUD) | Fonctionnel |
| Produits / Stock | Fonctionnel |
| Ventes avec lignes, paiements, fidélité | Fonctionnel |
| Achats avec lignes, paiements | Fonctionnel |
| Clients / Fournisseurs | Fonctionnel |
| Caisse / Banques | Fonctionnel |
| Charges / Dépenses | Fonctionnel |
| Comptabilité (écritures, journaux, plan comptable) | Fonctionnel |
| Commandes fournisseurs | Fonctionnel |
| Transferts inter-magasins | Fonctionnel |
| Rapports (ventes, inventaire, fournisseurs, finances) | Partiel |
| Comptabilisation automatique SYSCOHADA | Fonctionnel mais buggué |
| Import/Export | Partiel |
| PWA / Offline | Partiel |
| Licence / Activation | **BYPASS TOTAL** |

### 1.4 Niveau global de maturité

**Bêta avancé / Pré-production avec carences critiques.**

L'application est fonctionnellement riche mais souffre de graves lacunes de sécurité, d'autorisation, et de cohérence métier. Elle n'est pas prête pour la production sans correction majeure.

---

## 2. Structure du code

### 2.1 Organisation des dossiers

```
app/
  (dashboard)/dashboard/   → 20+ pages monolithiques
  api/                      → 43 endpoints REST
  login/                    → Page de connexion
components/
  dashboard/                → 7 composants métier
  ui/                       → 2 composants (Pagination, Toast)
  print/                    → Print helpers
  scanner/                  → QR/Barcode scanner
lib/                        → 30 fichiers de logique métier
prisma/                     → Schema + seed + migrations + SQLite DB
contexts/                   → 1 contexte (Toast)
hooks/                      → 1 hook (useToast)
scratch/                    → 14 fichiers de debug/temporaire
scripts/                    → 11 scripts de maintenance
```

### 2.2 Qualité de séparation des responsabilités

| Problème | Sévérité |
|---|---|
| Pages monolithiques : `ventes/page.tsx` (~2 500 lignes), `achats/page.tsx` (~2 000 lignes) — UI + state + fetch + logique métier dans un seul fichier | **Critique** |
| `components/ui/` quasi vide : seuls `Pagination.tsx` et `Toast.tsx` — pas de Button, Modal, Select, FormField partagé | **Important** |
| Duplication massive : `ModificationAchatModal` ≈ `ModificationVenteModal` (370+ lignes quasi identiques) | **Important** |
| Logique métier dans les handlers API au lieu de services dédiés — `comptabilisation.ts` est la seule vraie couche service | **Moyen** |

### 2.3 Fichiers inutiles, dupliqués, temporaires ou legacy

| Fichier | Problème | Action |
|---|---|---|
| `scratch/` (14 fichiers) | Scripts de debug/diagnostic temporaires | Supprimer du repo |
| `*.bak` (6 fichiers racine) | `audit_ecritures.js.bak`, `cleanup_ecritures.js.bak`, `commerce_audit.js.bak`, `financial_audit.js.bak`, `final_sanitization.js.bak`, `tiers_audit.js.bak` | Supprimer |
| `GestiComService.exe` | Binaire Windows dans le repo | Exclure via `.gitignore` |
| `GestiCom-Installateur.exe` | Installateur dans le repo | Exclure via `.gitignore` |
| `node.exe` | Runtime Node dans le repo | Exclure via `.gitignore` |
| `query` | Fichier sans extension à la racine | Supprimer |
| `lib/require-role.ts` | Duplique `ROLES_ADMIN`, `ROLES_COMPTA`, `ROLES_USER_MANAGEMENT` de `roles-permissions.ts` | Refactorer |

### 2.4 Problèmes de lisibilité et maintenabilité

- **Tout est `'use client'`** — zéro Server Component dans le dashboard (anti-pattern majeur pour Next.js App Router)
- **Endpoints API hardcodés** — 15+ fichiers avec des `fetch('/api/...')` en string, pas de couche API centralisée
- **Types `any`** utilisés dans ~10 endroits (Dashboard KPIs, PaymentModal, etc.)
- **`@ts-ignore`** à 4+ endroits pour contourner des erreurs TypeScript
- **Pas de tests** (zéro test unitaire, zéro test d'intégration, zéro test E2E)

---

## 3. Frontend

### 3.1 Qualité des pages et composants

| Indicateur | État |
|---|---|
| Nombre de pages dashboard | ~20 |
| Taille moyenne d'une page | 800–2 500 lignes |
| Composants partagés réutilisables | 2 (Pagination, Toast) |
| Server Components | **0** (tout est `'use client'`) |
| Error Boundaries | **0** |
| Tests unitaires frontend | **0** |

### 3.2 Problèmes de performance et state management

| Problème | Impact |
|---|---|
| Pas de Server Components — chaque page charge tout le JS client-side | Performance mauvaise, SEO nul |
| `formData` avec `lignes[]` et `reglements[]` recréés à chaque frappe | Lag sur les formulaires vente/achat |
| Pas de `useMemo`/`useCallback` pour les listes filtrées | Re-rendus inutiles |
| SWR utilisé uniquement dans 1 composant (`SuggestionsAchat`) — le reste utilise `fetch()` brut | Pas de cache, pas de déduplication |
| Chargement de tous les produits (`?complet=1&limit=1000`) pour les dropdowns | Chargement inutilement lourd |
| `setTimeout(() => fetchList(1), 500)` comme hack de rafraîchissement dans 4+ pages | Double requête réseau, race conditions |
| `window.addEventListener('keydown')` sans cleanup systématique | Fuites mémoire |

### 3.3 Cohérence UI/UX

| Incohérence | Détail |
|---|---|
| Devise | `'F'` vs `'FCFA'` selon les composants |
| Border radius | `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-[2.5rem]` — pas de scale définie |
| Shadows | `shadow-sm` à `shadow-2xl` sans système d'élévation |
| Boutons | Styles inline différents par page — pas de composant `Button` |
| États vides | Chaque page a son propre style |
| États de chargement | Pas de skeleton cohérent (spinner vs pulse vs rien) |
| Modales | Pas de composant `Dialog` partagé — chaque page recode sa modale |

### 3.4 Bugs frontend identifiés

| Bug | Fichier | Détail |
|---|---|---|
| Typo `selectedInvoceId` | `PaymentModal.tsx:22` | Devrait être `selectedInvoiceId` |
| Typo "GentiCom Pro" | `RelanceModal.tsx:157` | Au lieu de "GestiCom Pro" |
| `dangerouslySetInnerHTML` sans sanitization | `ClientsPage.tsx:685`, `FournisseursPage.tsx:672` | XSS potentiel |
| `window.location.href` pour downloads | Achats, Ventes, Stock | Navigation hors SPA |
| `confirm()` navigateur | Ventes, Clients, Fournisseurs | Incohérent avec modales custom |

### 3.5 Accessibilité

- **Zéro `role="dialog"` ou `aria-modal`** sur les modales
- **Pas de focus trapping** dans les modales
- **Pas de labels ARIA** sur les boutons icônes
- **Information portée uniquement par la couleur** (vert/rouge pour tendances KPI)

---

## 4. Backend / logique métier

### 4.1 API Routes — Autorisation

**Problème critique** : 15+ endpoints n'ont **aucune vérification de permission** — seul `getSession()` est vérifié.

| Endpoint | Risque |
|---|---|
| `PATCH /api/produits/[id]` | N'importe quel utilisateur peut modifier les prix |
| `DELETE /api/produits/[id]` | N'importe quel utilisateur peut supprimer des produits (hard delete + cascade) |
| `PATCH /api/stock/[id]` | N'importe quel utilisateur peut modifier les quantités de stock |
| `DELETE /api/stock/[id]` | N'importe quel utilisateur peut supprimer des entrées stock |
| `POST /api/stock/init` | N'importe quel utilisateur peut initialiser les stocks |
| `PATCH /api/ventes/[id]` | N'importe quel utilisateur peut modifier une vente |
| `PATCH /api/achats/[id]` | N'importe quel utilisateur peut modifier un achat |
| `PATCH /api/clients/[id]` | N'importe quel utilisateur peut modifier un client |
| `GET /api/clients/[id]` | N'importe quel utilisateur peut voir un client cross-entité |
| `PATCH /api/fournisseurs/[id]` | N'importe quel utilisateur peut modifier un fournisseur |
| `GET /api/fournisseurs/[id]` | N'importe quel utilisateur peut voir un fournisseur cross-entité |
| `POST /api/banques` | N'importe quel utilisateur peut créer un compte bancaire |
| `GET /api/banques` | N'importe quel utilisateur peut lister les comptes bancaires |
| `PATCH/DELETE /api/magasins/[id]` | N'importe quel utilisateur peut modifier/désactiver un magasin |
| `GET/POST/PATCH /api/depenses` | N'importe quel utilisateur peut voir/créer/modifier les dépenses |

### 4.2 Incohérences d'autorisation DELETE

| Entité | Permission DELETE |
|---|---|
| Ventes | SUPER_ADMIN uniquement |
| Achats | SUPER_ADMIN uniquement |
| Produits | **N'importe quel utilisateur connecté** |
| Stock | **N'importe quel utilisateur connecté** |
| Clients | SUPER_ADMIN ou ADMIN |
| Fournisseurs | SUPER_ADMIN ou ADMIN |
| Dépenses | SUPER_ADMIN ou ADMIN |
| Magasins | **N'importe quel utilisateur connecté** |
| Utilisateurs | SUPER_ADMIN ou ADMIN (soft delete) |

Les produits et le stock peuvent être supprimés par l'utilisateur le moins privilégié, alors que les ventes nécessitent le privilège le plus élevé. C'est inversé.

### 4.3 Cohérence métier

| Problème | Fichier | Impact |
|---|---|---|
| Double-comptage caisse pour les frais d'approche | `comptabilisation.ts:248-298` | Si frais approche + paiement espèces, la caisse est crédito deux fois |
| Incohérence valorisation stock achat | `comptabilisation.ts` vs `calculs-commerciaux.ts` | PAMP calculé au niveau ligne vs frais globaux — mismatch |
| `pointsFideliteDepuisEncaissement` retourne le montant brut | `calculs-commerciaux.ts:153` | 10 000 FCFA → 10 000 points au lieu de 10 (1 pt/1000 FCFA) |
| `htNetLigne` peut être négatif | `calculs-commerciaux.ts:22` | Remise > q×pu donne un TTC négatif |
| Pas de validation TVA max | `calculs-commerciaux.ts` | TVA à 500% acceptée |
| `switch-entite` modifie `entiteId` en base | `/api/auth/switch-entite` | Side-effect non-documenté — devrait modifier uniquement le token |
| `caisse.ts` retourne `null` pour montant ≤ 0 ou erreur DB | `caisse.ts:22-25` | Impossible de distinguer les deux cas |
| `caisse.ts` hardcode `entiteId = 1` | `caisse.ts:22` | Break multi-entité |

### 4.4 Règles métiers manquantes

1. **Pas de contrôle de solde client** lors des ventes à crédit (pas de vérification du plafond)
2. **Pas de contrôle de stock négatif** avant sortie (ventes sans vérification de disponibilité)
3. **Pas de verrouillage de période comptable** (la clôture existe mais n'est pas vérifiée partout)
4. **Pas de numérotation séquentielle garantie** pour les factures/achats
5. **Double modèle Charge + Depense** pour des concepts similaires sans relation claire

### 4.5 Audit logging incomplet

| Opérations tracées | Opérations **non** tracées |
|---|---|
| Vente (création) | Fournisseur (création/modification/suppression) |
| Achat (suppression) | Client (création/modification/suppression) |
| Produit (création) | Stock (modification) |
| Utilisateur (création/modification/suppression) | Magasin (modification) |
| Dépense (suppression) | Caisse (opérations) |
| | Banque (opérations) |

---

## 5. Base de données

### 5.1 Schéma Prisma (SQLite) — synthèse

| Aspect | État |
|---|---|
| Nombre de modèles | 25 |
| Relations | Correctement définies avec `onDelete: Cascade` et `Restrict` |
| Indexes | Présents sur les champs de recherche fréquents |
| Unique constraints | Présentes sur codes, numéros, logins |
| Base de données | SQLite (single-file, pas de concurrence, pas de RLS) |

### 5.2 Incohérences de modélisation

| Problème | Détail |
|---|---|
| `entiteId` nullable vs requis | `Client.entiteId` = `Int? @default(1)`, `Fournisseur.entiteId` = `Int? @default(1)`, mais `Vente.entiteId` = `Int` (requis). Incohérent |
| `Charge` vs `Depense` | Deux modèles très similaires. `Charge` a `type` FIXE/VARIABLE + `rubrique`. `Depense` a `categorie` + `libelle`. Redondance conceptuelle |
| `code` nullable sur `Client` et `Fournisseur` | `code String? @unique` — en SQLite, deux enregistrements avec `code=null` violeront la contrainte |
| `Parametre` est un singleton | Pas de relation avec `Entite` — les paramètres SMTP sont globaux |
| `soldeCaisse` sur `Magasin` | Champ `Float` calculé mais aussi modifiable directement — risque de désynchronisation |
| `soldeActuel` sur `Banque` | Même problème — champ mutable qui devrait être calculé |
| Pas de soft-delete cohérent | `Utilisateur` et `Magasin` ont `actif`, mais `Produit` est hard-deleté (cascade sur stocks, lignes, mouvements) |
| `prixMinimum` sur `Produit` | `Float? @default(0)` — valeur par défaut 0 au lieu de null |

### 5.3 Risques de données

| Risque | Détail |
|---|---|
| `Float` pour les montants financiers | Imprécision en virgule flottante. Acceptable pour FCFA entiers, mais problématique pour d'autres devises |
| Pas de contrainte CHECK | SQLite ne supporte pas via Prisma, mais les validations Zod côté API ne sont pas toutes actives |
| `Float default(0)` pour `soldeCaisse`, `soldeActuel` | Valeurs calculées ailleurs mais modifiables directement — race condition |
| Pas de contrainte transactionnelle sur les numéros | Numéros de vente/achat `@unique` mais générés côté applicatif sans séquence DB |

### 5.4 Recommandations

1. **Migrer de SQLite vers PostgreSQL** pour RLS, CHECK constraints, transactions ACID robustes, et concurrence
2. **Utiliser `Decimal` Prisma** au lieu de `Float` pour les montants
3. **Rendre `entiteId` obligatoire** sur `Client` et `Fournisseur`
4. **Fusionner `Charge` et `Depense`** ou clarifier leur différenciation métier
5. **Supprimer `soldeCaisse` de Magasin** et `soldeActuel` de Banque — les calculer dynamiquement
6. **Invalider le champ `code` nullable unique** — utiliser une valeur par défaut calculée au lieu de null

---

## 6. Authentification / autorisation / sécurité

### 6.1 Authentification

| Aspect | État | Sévérité |
|---|---|---|
| JWT HS256 avec `jose` | Correct | — |
| Cookie `httpOnly`, `sameSite: 'lax'` | Correct | — |
| `secure` conditionnel sur HTTPS | Correct | — |
| bcrypt pour le hash des mots de passe | Correct | — |
| Secret JWT fallback en dev | `'GestiCom-Dev-Default-Secret-32chars-Minimum!!'` si `NODE_ENV=development` | **CRITIQUE** |
| Pas de rotation de tokens | Pas de refresh token, pas de révocation | **Important** |
| Rate limiting login | Côté client uniquement (`sessionStorage`) — contournable | **Important** |

### 6.2 Autorisation

| Aspect | État | Sévérité |
|---|---|---|
| RBAC avec 6 rôles et 40+ permissions | Bien conçu | — |
| 15+ endpoints sans vérification de permission | Seul `getSession()` est vérifié | **CRITIQUE** |
| Isolation multi-entité absente sur les endpoints individuels | Pas de filtre `entiteId` sur PATCH/GET individuel | **CRITIQUE** |
| `security.ts` completely bypassed | `verifyLicenseKey` retourne `true`, `ensureActivated` retourne `true` | **CRITIQUE** |

### 6.3 Sécurité des données

| Risque | Détail | Sévérité |
|---|---|---|
| **SQL injection via `VACUUM INTO`** | `sauvegarde-db.ts:208` — `$executeRawUnsafe` avec interpolation de chemin | **CRITIQUE** |
| **Path traversal** | `resolveDataFile.ts` — `filename` passé directement à `path.join` sans sanitization | **CRITIQUE** |
| **XSS via `print-templates.ts`** | `logoUrl` inséré dans `<img src>` sans sanitization | **Important** |
| **SMTP password en clair** | Stocké dans la table `Parametre`, lisible par tout admin | **Important** |
| **Fallback `get-entite-id.ts`** | Si `entiteId` est invalide, retourne la première entité — breach multi-tenant | **Important** |
| **`SESSION_SECRET` dans `.env`** | Commit dans le repo — devrait être dans `.env.local` (gitignored) | **Important** |
| **`DATABASE_URL` avec chemin Windows** | `file:C:\gesticom\gesticom.db` — chemin absolu local | **Moyen** |
| **CSV injection dans les imports/exports** | Pas de protection contre les formules `=CMD(...)` dans les cellules | **Moyen** |

### 6.4 Variables d'environnement

```env
DATABASE_URL="file:C:\gesticom\gesticom.db"
SESSION_SECRET="c5b3372cd22f752026af132d5452d2f0afc209b696186e49ab9799a1f72d3a8a"
PORT=3001
```

- `.env` est commit dans le repo — le `SESSION_SECRET` de production est exposé
- Pas de `.env.example` documentant les variables requises
- Pas de validation des variables d'environnement au démarrage

---

## 7. Qualité technique

### 7.1 Dette technique

| Catégorie | Détail |
|---|---|
| Fichiers morts | `scratch/` (14 fichiers), 6 `.bak` à la racine, binaires `.exe`, `node.exe` |
| Code dupliqué | Mapping catégorie→compte 3× dans `comptabilisation.ts`, résolution bancaire 4×, rôles dupliqués dans `require-role.ts` et `roles-permissions.ts` |
| Types `any` | ~10 usages dans les composants dashboard |
| `@ts-ignore` | 4+ suppressions d'erreur dans DashboardPage et Ventes |
| Binaires dans le repo | `GestiComService.exe`, `GestiCom-Installateur.exe`, `node.exe` |

### 7.2 Typage TypeScript

| Problème | Impact |
|---|---|
| API responses non typées | Tous les `fetch().then(r => r.json())` retournent `any` |
| Schémas Zod définis mais non utilisés | 9 schémas (`produitSchema`, `clientSchema`, `fournisseurSchema`, `magasinSchema`, `depenseSchema`, `venteSchema`, `chargeSchema`, `ecritureSchema`, `journalSchema`) jamais importés dans leurs handlers |
| `as any` dans KPI cards | Types dashboard prototypes incorrects |
| Types API manquants | Pas de types générés pour les routes API |

### 7.3 Gestion des erreurs

| Problème | Détail |
|---|---|
| Audit logs silencieux | `createAuditLog` avale les erreurs (`console.error` only) |
| `createEcriture` retourne `null` silencieusement | Si montant = 0, aucune écriture créée mais pas d'erreur levée |
| `caisse.ts` retourne `null` | Impossible de distinguer "montant ≤ 0" d'une erreur DB |
| Modales se ferment sur erreur | `ModificationAchatModal` et `ModificationVenteModal` appellent `onClose()` dans le `catch` |
| Erreurs `.catch(() => [])` | Remplace silencieusement les erreurs API par un tableau vide |
| Pas de Error Boundary | Aucun React Error Boundary dans l'arbre de composants |

### 7.4 Validation des entrées

| Problème | Détail |
|---|---|
| 9 schémas Zod non utilisés | Définis dans `validations.ts` mais les handlers API font de la validation manuelle inline |
| Pas de CSV injection protection | `import-export.ts` et `formats/sage.ts` ne protègent pas contre `=CMD(...)` |
| Pas de limite de lignes sur l'import | Risque de DoS |
| `venteSchema` ne valide pas l'unicité des `produitId` | Lignes dupliquées possibles |

### 7.5 Logique métier — problèmes spécifiques

| Problème | Fichier | Détail |
|---|---|---|
| N+1 query | `intelligence.ts:56-73` | `getProduitsEnAlerte` fait 3+ queries par produit |
| `repairStockIntegrity` a du code mort | `repair.ts:11-14` | Le premier `aggregate` n'est jamais référencé |
| `repairVisibility` inconsistante | `repair.ts:76-83` | Utilise `{ in: [0] }` mais pas `{ or: [{ entiteId: 0 }, { entiteId: null }] }` partout |
| `offline-sync.ts` retry à 50 | `offline-sync.ts:23` | `MAX_RETRIES = 50` trop élevé, pas de backoff exponentiel |
| `offline-sync.ts` pas de allowlist URL | `offline-sync.ts` | Le `endpoint` peut pointer vers n'importe quel serveur |
| `importProduits.ts` 1 seul magasin | `importProduits.ts:53` | Un produit = UN seul magasin, les autres magasins sont ignorés |

---

## 8. Qualité produit

### 8.1 Ce qui manque pour la production

| Catégorie | Manque |
|---|---|
| Sécurité | Autorisation sur 15+ endpoints, isolation multi-entité, validation d'entrée sur 9 schémas, protection CSRF, rate limiting serveur |
| Fiabilité | Error boundaries, transaction wrapping cohérent, retry logic, offline sync robuste |
| Observabilité | Structured logging, monitoring, alerting, audit trail incomplet |
| Tests | Zéro test unitaire, zéro test d'intégration, zéro test E2E |
| CI/CD | Pas de pipeline de build/test automatisé |
| Internationalisation | Tout en français hardcodé — pas de i18n |

### 8.2 Ce qui manque pour un vrai usage business

| Fonctionnalité | Statut |
|---|---|
| Multi-devises | Absent (FCFA uniquement) |
| Taxe configurable par produit/ligne | Partiel (TVA seulement) |
| Gestion des avoirs/remboursements | Absent |
| Lettrage automatique des règlements | Partiel |
| Rapprochement bancaire | Partiel |
| États financiers (bilan, compte de résultat, SIG) | Partiel |
| Clôture mensuelle robuste | Partiel |
| Workflow d'approbation | Absent |
| Historique de modification (audit trail) | Partiel |
| Notifications/Push serveur | Seulement côté navigateur |
| Recherche full-text | Absent |
| Export PDF structuré | Partiel (jsPDF basique) |
| Tableau de bord temps réel | Absent (SWR sans polling) |

### 8.3 Ce qui manque par rôle

| Rôle | Manque critique |
|---|---|
| Admin | Panneau d'audit complet, gestion fine des permissions, monitoring des accès |
| Comptable | Balance âgée, lettrage automatique, rapprochement bancaire, exports FEC/EDF, clôture périodique |
| Gestionnaire | Alertes stock basées sur le taux de vente, tableau de bord ops |
| DG | KPIs temps réel, P&L, cash-flow, tableau de bord consolidé multi-entité |

---

## 9. Plan de correction priorisé

### CRITIQUE (à corriger immédiatement)

| # | Action | Fichiers |
|---|---|---|
| C1 | Ajouter `requirePermission()` sur les 15+ endpoints non protégés | `app/api/produits/[id]/route.ts`, `app/api/stock/[id]/route.ts`, `app/api/ventes/[id]/route.ts`, `app/api/achats/[id]/route.ts`, `app/api/clients/[id]/route.ts`, `app/api/fournisseurs/[id]/route.ts`, `app/api/magasins/[id]/route.ts`, `app/api/banques/route.ts`, `app/api/depenses/route.ts`, etc. |
| C2 | Ajouter le filtre `entiteId` sur tous les endpoints `[id]` (GET, PATCH, DELETE) | Tous les `route.ts` avec `[id]` |
| C3 | Corriger la SQL injection dans `sauvegarde-db.ts` | `lib/sauvegarde-db.ts:208` |
| C4 | Corriger le path traversal dans `resolveDataFile.ts` | `lib/resolveDataFile.ts` |
| C5 | Retirer le secret JWT fallback et exiger `SESSION_SECRET` en production | `lib/auth.ts` |
| C6 | Supprimer les fichiers `.bak`, `scratch/`, binaires `.exe` | Repository root |
| C7 | Ajouter `.env` au `.gitignore` et créer `.env.example` | `.gitignore`, `.env.example` |

### IMPORTANT

| # | Action | Fichiers |
|---|---|---|
| I1 | Utiliser les schémas Zod existants dans tous les handlers API | Utiliser `produitSchema`, `clientSchema`, etc. dans les routes correspondantes |
| I2 | Corriger la double-comptabilité caisse pour les frais d'approche | `lib/comptabilisation.ts` |
| I3 | Corriger `pointsFideliteDepuisEncaissement` (diviser par 1000 ou taux configurable) | `lib/calculs-commerciaux.ts` |
| I4 | Clamper `htNetLigne` à 0 minimum + valider TVA max | `lib/calculs-commerciaux.ts` |
| I5 | Ajouter des Error Boundaries dans le dashboard layout | `app/(dashboard)/error.tsx`, layout |
| I6 | Refactorer les pages monolithiques en sous-composants | Ventes, Achats, Stock, Clients, Produits |
| I7 | Créer les composants UI partagés (Button, Dialog, Select, FormField, EmptyState, Skeleton) | `components/ui/` |
| I8 | Ajouter un rate limiting serveur sur `/api/auth/login` | `app/api/auth/login/route.ts` |
| I9 | Corriger l'isolation multi-entité dans `get-entite-id.ts` | `lib/get-entite-id.ts` |
| I10 | Protéger `print-templates.ts` contre l'XSS (sanitiser `logoUrl`) | `lib/print-templates.ts` |

### MOYEN

| # | Action | Fichiers |
|---|---|---|
| M1 | Standardiser la devise ('FCFA' partout) | Tous les fichiers avec 'F' |
| M2 | Supprimer la duplication `ROLES_ADMIN`/`ROLES_COMPTA` | `lib/require-role.ts` — importer depuis `roles-permissions.ts` |
| M3 | Refactorer le mapping catégorie→compte en une seule fonction | `lib/comptabilisation.ts` |
| M4 | Migrer vers les Server Components où possible | Pages du dashboard |
| M5 | Ajouter une couche API client centralisée | Nouveau fichier `lib/api-client.ts` |
| M6 | Remplacer `setTimeout(() => fetchList(1), 500)` par SWR `mutate` | Clients, Fournisseurs, Achats |
| M7 | Remplacer `Float` par `Decimal` dans le schéma Prisma | `prisma/schema.prisma` |
| M8 | Ajouter des tests unitaires pour `calculs-commerciaux.ts` | Nouveau fichier de tests |
| M9 | Migrer la collection `scratch/` dans un outil externe ou la supprimer | Repository |
| M10 | Ajouter des logs structurés au lieu de `console.log` | Nouveau `lib/logger.ts` |

### CONFORT

| # | Action | Fichiers |
|---|---|---|
| K1 | Créer un système de design tokens (border-radius, shadows, colors) | Tailwind config |
| K2 | Ajouter l'accessibilité (ARIA, focus trapping) aux modales | Tous les modales |
| K3 | Ajouter des animations de transition aux changements de page | Layout |
| K4 | Ajouter le support i18n (français/anglais minimum) | Nouveau système |
| K5 | Ajouter des tests E2E (Playwright) | Nouveau répertoire |
| K6 | Ajouter des snapshots visuels pour les composants UI | Nouveau répertoire |
| K7 | Documenter l'API avec OpenAPI/Swagger | Nouveau fichier |
| K8 | Optimiser la requête N+1 dans `intelligence.ts` | `lib/intelligence.ts` |
| K9 | Ajouter le cache offline PWA robuste (Service Worker) | `lib/offline-sync.ts` |
| K10 | Corriger le typo "GentiCom" en "GestiCom" | `RelanceModal.tsx` |

---

## 10. Plan Sprint 1 (7 jours)

### Jour 1 — Sécurité critique (endpoint authorization)

| Tâche | Fichiers |
|---|---|
| Ajouter `requirePermission` sur `PATCH/DELETE /api/produits/[id]` | `app/api/produits/[id]/route.ts` |
| Ajouter `requirePermission` sur `PATCH/DELETE /api/stock/[id]`, `POST /api/stock/init` | `app/api/stock/[id]/route.ts`, `app/api/stock/init/route.ts` |
| Ajouter `requirePermission` sur `PATCH /api/ventes/[id]` | `app/api/ventes/[id]/route.ts` |
| Ajouter `requirePermission` sur `PATCH /api/achats/[id]` | `app/api/achats/[id]/route.ts` |
| Ajouter `requirePermission` sur `PATCH/DELETE /api/clients/[id]` | `app/api/clients/[id]/route.ts` |
| Ajouter `requirePermission` sur `PATCH/DELETE /api/fournisseurs/[id]` | `app/api/fournisseurs/[id]/route.ts` |
| Ajouter `requirePermission` sur `GET/POST/PATCH/DELETE /api/depenses` | `app/api/depenses/route.ts`, `app/api/depenses/[id]/route.ts` |
| Ajouter `requirePermission` sur `POST /api/banques`, `GET /api/banques` | `app/api/banques/route.ts` |
| Ajouter `requirePermission` sur `PATCH/DELETE /api/magasins/[id]` | `app/api/magasins/[id]/route.ts` |

### Jour 2 — Sécurité critique (isolation + injection + env)

| Tâche | Fichiers |
|---|---|
| Ajouter filtre `entiteId` sur tous les `GET/PATCH/DELETE /[id]` | Tous les `route.ts` avec `[id]` |
| Corriger SQL injection dans `createBackup()` | `lib/sauvegarde-db.ts:208` |
| Corriger path traversal dans `resolveDataFilePath()` | `lib/resolveDataFile.ts` |
| Supprimer le fallback JWT secret | `lib/auth.ts` |
| Ajouter `.env` au `.gitignore` + créer `.env.example` | `.gitignore`, `.env.example` |
| Corriger `get-entite-id.ts` (ne pas fallback à la première entité) | `lib/get-entite-id.ts` |

### Jour 3 — Validation d'entrée + logique métier

| Tâche | Fichiers |
|---|---|
| Brancher les schémas Zod dans les handlers API | `app/api/produits/`, `app/api/clients/`, etc. |
| Corriger `pointsFideliteDepuisEncaissement` | `lib/calculs-commerciaux.ts` |
| Clamper `htNetLigne` à 0 minimum + valider TVA max 100 | `lib/calculs-commerciaux.ts` |
| Corriger la double-comptabilité caisse frais d'approche | `lib/comptabilisation.ts` |
| Ajouter la vérification du plafond crédit client lors des ventes | `app/api/ventes/route.ts` |
| Corriger `caisse.ts` (retourner erreur au lieu de `null`) | `lib/caisse.ts` |

### Jour 4 — Nettoyage repo + composants UI

| Tâche | Fichiers |
|---|---|
| Supprimer `scratch/`, `*.bak`, binaires `.exe`, `node.exe`, `query` | Repository |
| Créer composants `Button`, `Dialog`, `FormField`, `Select` | `components/ui/` |
| Standardiser la devise en `'FCFA'` partout | Tous les composants |
| Corriger la typo `selectedInvoceId` → `selectedInvoiceId` | `components/dashboard/PaymentModal.tsx` |
| Corriger "GentiCom" → "GestiCom" | `components/dashboard/RelanceModal.tsx` |

### Jour 5 — Refactoring pages monolithiques

| Tâche | Fichiers |
|---|---|
| Extraire les formulaires de `ventes/page.tsx` en composants | `app/(dashboard)/dashboard/ventes/` |
| Extraire les formulaires de `achats/page.tsx` en composants | `app/(dashboard)/dashboard/achats/` |
| Fusionner `ModificationAchatModal` et `ModificationVenteModal` | `components/dashboard/` |
| Ajouter Error Boundary dans le dashboard layout | `app/(dashboard)/error.tsx` |

### Jour 6 — XSS + audit + rate limiting

| Tâche | Fichiers |
|---|---|
| Sanitiser les URLs de logo dans `print-templates.ts` | `lib/print-templates.ts` |
| Sanitiser les exports CSV contre l'injection de formules | `lib/import-export.ts`, `lib/formats/sage.ts` |
| Ajouter audit logging sur les opérations manquantes | Handlers API |
| Ajouter rate limiting serveur sur `/api/auth/login` | Middleware ou `app/api/auth/login/route.ts` |
| Corriger `switch-entite` pour modifier le token, pas la DB | `app/api/auth/switch-entite/route.ts` |

### Jour 7 — Tests + vérification

| Tâche | Fichiers |
|---|---|
| Écrire tests unitaires pour `calculs-commerciaux.ts` | `__tests__/calculs-commerciaux.test.ts` |
| Écrire tests unitaires pour `comptabilisation.ts` | `__tests__/comptabilisation.test.ts` |
| Écrire tests d'intégration pour les endpoints critiques | `__tests__/api/` |
| Vérifier le lint complet (`npm run lint`) | Tout le code |
| Tester manuellement le flux complet : login → vente → stock → compta → rapport | — |
| Créer `AGENTS.md` avec les conventions du projet | Racine |

---

## 11. Top 15 actions immédiates

1. **Ajouter `requirePermission()` sur les 15+ endpoints non protégés** — tout utilisateur connecté peut modifier produits, stock, clients, dépenses
2. **Ajouter le filtre `entiteId` sur tous les endpoints `/[id]`** — un utilisateur de l'entité A peut lire/modifier les données de l'entité B
3. **Corriger la SQL injection dans `sauvegarde-db.ts:208`** (`$executeRawUnsafe` avec interpolation)
4. **Corriger le path traversal dans `resolveDataFile.ts`** (filename passé directement à `path.join`)
5. **Supprimer le fallback JWT secret codé en dur** (`GestiCom-Dev-Default-Secret-32chars-Minimum!!`)
6. **Retirer `.env` du repo** et créer `.env.example` — le `SESSION_SECRET` est exposé dans git
7. **Brancher les 9 schémas Zod non utilisés** dans les handlers API respectifs
8. **Corriger la double-comptabilisation caisse** pour les frais d'approche dans `comptabilisation.ts`
9. **Corriger `pointsFideliteDepuisEncaissement`** (retourne le montant brut au lieu de points)
10. **Clamper `htNetLigne` à 0 minimum** et valider TVA max dans `calculs-commerciaux.ts`
11. **Corriger `get-entite-id.ts`** — ne pas fallback à la première entité (breach multi-tenant)
12. **Nettoyer le repo** — supprimer `scratch/`, `*.bak`, `.exe`, `query`
13. **Ajouter des Error Boundaries** dans l'arbre de composants React
14. **Sanitiser les URLs et exports** — XSS dans `print-templates.ts`, CSV injection dans les exports
15. **Ajouter le rate limiting serveur** sur `/api/auth/login` (actuellement client-side uniquement)
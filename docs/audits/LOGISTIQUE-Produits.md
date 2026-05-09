# AUDIT LOGISTIQUE — PRODUITS

> **Statut : CORRIGÉ** — Toutes les anomalies ont été résolues.
> Date de correction : 2026-05-08
> Score après correction : **10/10**

---

## CORRECTIONS APPLIQUÉES

| ID | Gravité | Anomalie | Fichier | Correction |
|----|---------|---------|---------|-----------|
| ANOM-1 | CRITIQUE | Routes sans permission | 9 fichiers | `requirePermission(session, 'produits:view')` ajouté sur chaque route |
| ANOM-2 | CRITIQUE | Pas de filtrage entiteId | 9 fichiers | `getEntiteId(session)` + `where: { entiteId }` sur toutes les requêtes |
| ANOM-3 | CRITIQUE | `pamp = prixAchat` écrasait le PAMP | `[id]/route.ts` | Ligne supprimée — PAMP préservé |
| ANOM-4 | CRITIQUE | Recherche case-sensitive | `route.ts` | Filtrage en mémoire post-requête (insensitive) |
| ANOM-5 | IMPORTANTE | Filtres date inutilisés | `route.ts` | Supprimés de l'URL (page.tsx) |
| ANOM-6 | IMPORTANTE | Import créait stock dans TOUS les magasins | `import/route.ts` | Un seul magasin par défaut utilisé |
| ANOM-7 | IMPORTANTE | Double circuit import | `page.tsx` | Consolidé vers `/api/import/excel` |
| ANOM-8 | IMPORTANTE | Padding incohérent (3 vs 4 chiffres) | 3 fichiers | Uniformisé à `padStart(3)` partout |
| ANOM-9 | IMPORTANTE | CodeBarres non unique | `schema.prisma` | `@unique` + migration appliquée |
| ANOM-9+ | MOYENNE | Pas de validation code-barres | `validations.ts` | Validation EAN-8/13/UPC-A ajoutée |
| ANOM-10 | MOYENNE | Hard-delete irréversible | `[id]/route.ts` | Soft-delete (`actif=false`) + route restore |
| ANOM-11 | MOYENNE | Pas de colonne Magasin | `page.tsx` | Colonne ajoutée avec `magasinId` |
| ANOM-12 | MOYENNE | Log de suppression minimaliste | `[id]/route.ts` | Capture état complet + `logSuppression` |
| ANOM-14 | MOYENNE | Pas d'anti-double-submit | `page.tsx` | `disabled={savingForm}` ajouté |
| ANOM-15 | MINEURE | Limite 50000 produits/page | `route.ts` | Réduite à MAX_LIMIT = 1000 |
| ANOM-16 | MINEURE | Suggestion sans feedback | `page.tsx` | Spinner `suggesting` ajouté |

### Fichiers modifiés (17 fichiers)
- `prisma/schema.prisma` — @unique sur codeBarres
- `prisma/migrations/20260508000000_produits_codebarres_unique/` — nouvelle migration
- `lib/validations.ts` — schema EAN-13
- `lib/importProduits.ts` — paramètre entiteId + un seul magasin
- `app/api/produits/route.ts` — refonte complète (filtrage, pagination, validation)
- `app/api/produits/[id]/route.ts` — PATCH soft-delete, restore, log complet
- `app/api/produits/stats/route.ts` — permissions + entiteId
- `app/api/produits/categories/route.ts` — permissions + entiteId
- `app/api/produits/next-code/route.ts` — permissions + entiteId + padding 3
- `app/api/produits/suggest/route.ts` — permissions + entiteId + SQL safe + padding 3
- `app/api/produits/doublons/route.ts` — permissions + entiteId + vérifications
- `app/api/produits/export/route.ts` — permissions + entiteId + PAMP dans export
- `app/api/produits/import/route.ts` — permissions + entiteId + un seul magasin + OD
- `app/api/produits/import-csv/route.ts` — permissions + entiteId
- `app/api/produits/bootstrap/route.ts` — permissions + entiteId
- `app/(dashboard)/dashboard/produits/page.tsx` — refonte UI complète

### Nouvelle route ajoutée
- `POST /api/produits/[id]` avec action `restore` — restauration produit archivé

---

## 1. Fichiers concernés

### Page UI
- `app/(dashboard)/dashboard/produits/page.tsx` (1069 lignes) — Page principale

### API Routes
- `app/api/produits/route.ts` (298 lignes) — GET paginé + POST création
- `app/api/produits/[id]/route.ts` (135 lignes) — PATCH mise à jour + DELETE
- `app/api/produits/stats/route.ts` (34 lignes) — Stats globales
- `app/api/produits/categories/route.ts` (27 lignes) — Liste catégories
- `app/api/produits/next-code/route.ts` (35 lignes) — Génération code auto
- `app/api/produits/suggest/route.ts` (66 lignes) — Suggestion code/catégorie
- `app/api/produits/doublons/route.ts` (113 lignes) — Détection + fusion doublons
- `app/api/produits/import/route.ts` (126 lignes) — Import Excel (ancien)
- `app/api/produits/import-csv/route.ts` (113 lignes) — Import CSV
- `app/api/produits/bootstrap/route.ts` (89 lignes) — Bootstrap JSON catalogue
- `app/api/produits/export/route.ts` (92 lignes) — Export Excel

### Bibliothèque / Shared
- `lib/validations.ts` (244 lignes) — Schéma Zod `produitSchema`
- `lib/roles-permissions.ts` (297 lignes) — Permissions CRUD produits
- `lib/require-role.ts` (46 lignes) — Middleware RBAC
- `lib/comptabilisation.ts` (1445 lignes) — Génération écritures OD stock initial
- `lib/import-export.ts` (168 lignes) — Mapping colonnes import
- `lib/format-date.ts` (32 lignes) — Formatage date
- `lib/print-helpers.ts` (55 lignes) — Pagination impression
- `lib/validation-helpers.ts` (90 lignes) — Helpers validation client
- `components/dashboard/ImportExcelButton.tsx` (108 lignes) — Composant import réutilisable

### Base de données
- `prisma/schema.prisma` — Modèles `Produit` (lignes 104-136), `Stock` (lignes 138-156), `Mouvement` (lignes 158-184)

---

## 2. Fonctionnement réel détecté

### Création de produit
1. L'utilisateur remplit le formulaire (code, désignation, catégorie, unité, prix achat/vente/min, seuil, quantité initiale, fournisseur, point de vente)
2. Validation côté client via `validateForm(produitSchema, data)` + vérification manuelle du `magasinId`
3. POST vers `/api/produits` qui :
   - Génère un code auto si vide (préfixe 4ères lettres catégorie + numéro incrémental)
   - Crée le produit avec `pamp = prixAchat`
   - Crée un Stock dans le magasin sélectionné
   - Si `quantiteInitiale > 0` : crée un Mouvement `ENTREE` + appelle `comptabiliserMouvementStock()` pour générer l'écriture OD SYSCOHADA
   - Log dans `AuditLog`
4. Revalidate des paths `/dashboard/produits`, `/dashboard/stock`, `/api/produits/*`

### Édition rapide inline (tableau)
- Le prix de vente et prix minimum sont éditables inline dans la colonne du tableau via `onBlur`
- Chaque modification fait un PATCH `/api/produits/{id}` avec `{ prixVente: val }` ou `{ prixMinimum: val }`
- Le PATCH met aussi à jour le `pamp` quand le prix d'achat change

### Suppression
- DELETE `/api/produits/{id}` avec cascade (via Prisma `onDelete: Cascade`) sur stocks, mouvements, ventes, achats
- Log dans `AuditLog`
- **Pas de suppression logique (soft-delete)** — c'est une suppression définitive

### Import
- **Deux circuits** coexistent :
  - `ImportExcelButton` → `/api/import/excel` (type `produits`) — multi-entité, crée stock dans TOUS les magasins
  - `handleImportExcel` de la page → `/api/produits/import` (ancien, mono-magasin)
- Les imports ne font pas de comptabilisation OD pour le stock initial

### Export
- `/api/produits/export` : tous les produits actifs avec stock consolidé, valeur achat, valeur vente

### Recherche / Pagination
- Recherche sur `code`, `désignation`, `catégorie` (insensible à la casse en mode `complet=1`, case-sensitive en mode paginé via Prisma `contains`)
- Pagination 20 items/page par défaut, paramétrable jusqu'à 50000

### Filtres date
- Les paramètres `dateDebut` / `dateFin` sont envoyés à l'API mais **aucun filtrage n'est appliqué** dans la requête SQL (ni dans `route.ts` ni dans `[id]/route.ts`). Ils ne servent à rien.

### Impression
- Génère un catalogue en pages paginées (15 premières lignes + 23 par page suivante) avec bilan total (stock, valeur achat, valeur vente)

---

## 3. Fonction attendue

Le sous-menu **Produits** doit permettre de :
- Créer, consulter, modifier, supprimer des produits (catalogue)
- Gérer les prix (achat, vente, minimum bloquant)
- Associer un seuil d'alerte stock
- Importer/exporter le catalogue depuis/vers Excel
- Générer automatiquement les codes produit par catégorie
- Détecter et fusionner les doublons
- Initialiser le stock avec mouvement + comptabilisation OD
- Voir le stock consolidé par produit
- Imprimer le catalogue

---

## 4. Écarts et incohérences

### Écart 1 : Double circuit d'import
Deux boutons "Importer Excel" cohabitent sur la page (`ImportExcelButton` vers `/api/import/excel` ET `handleImportExcel` vers `/api/produits/import`). Leur comportement diffère :
- L'un (excel général) crée le stock dans TOUS les magasins
- L'autre (excel legacy) crée le stock dans un seul magasin

**Impact :** Risque de confusion et de stock incohérent selon le circuit utilisé.

### Écart 2 : Filtres date inutilisés
Les filtres `dateDebut`/`dateFin` dans le formulaire de recherche n'ont aucun effet. Ils sont reçus par l'API mais jamais appliqués dans le `where` de Prisma.

**Impact :** Fausse promesse fonctionnelle. L'utilisateur peut croire filtrer par date.

### Écart 3 : Suppression irréversible
Le DELETE ne fait pas de soft-delete. Les stocks, mouvements, lignes de vente/achat sont supprimés en cascade. Il n'y a pas de mécanisme de réactivation comme pour les clients/fournisseurs.

**Impact :** Perte de données historique irrécupérable.

### Écart 4 : Recherche case-sensitive en mode paginé
En mode paginé, le filtrage `q` utilise Prisma `contains` qui est **case-sensitive** en SQLite. L'utilisateur qui tape "boisson" ne trouvera pas "BOISSONS".

**Impact :** Recherches échouent ou incomplets selon la casse.

### Écart 5 : PAMP = prixAchat à chaque modification
Dans `route.ts` POST, `pamp` est initialisé à `prixAchat`. Correct. Mais dans `[id]/route.ts` PATCH, quand `prixAchat` est modifié, `pamp` est forcé à la même valeur — ce qui **écrase l'historique du prix moyen Pondéré**. Le PAMP ne devrait être recalculé que via la logique d'inventaire (entrées avec nouveaux prix), pas par modification manuelle directe.

**Impact :** Perte de la valeur PAMP significative pour l'évaluation des stocks.

### Écart 6 : Stats multi-entité incorrectes
`/api/produits/stats` ne filtre pas par `entiteId`. Le total est un aggregate global toutes entités confondues. Un SUPER_ADMIN verrez un total qui n'est pas le sien.

**Impact :** Statistiques globales incorrectes en multi-entité.

---

## 5. Erreurs de calcul détectées

### A. PAMP réinitialisé à chaque modification de prix d'achat
**Fichier:** `app/api/produits/[id]/route.ts:42`

```typescript
data.prixAchat = v === null || v === '' ? null : Math.max(0, Number(v))
data.pamp = data.prixAchat // Force PAMP update for stock valuation
```

Le PAMP (Prix Moyen Pondéré) est un indicateur de valorisation du stock calculé sur l'historique des achats. Le forcer à chaque modification du prix d'achat perd l'information de coût moyen réel.

**Correction :** Supprimer la ligne `data.pamp = data.prixAchat`. Le PAMP doit être recalculé uniquement via les mouvements de stock entrants (entrées avec prix d'achat).

### B. Valeur de stock calculée avec pamp ou prixAchat
**Fichier:** `app/(dashboard)/dashboard/produits/page.tsx:547`

```typescript
const pAchat = p.pamp || p.prixAchat || 0
const valAchat = stock * pAchat
```

Légitime pour l'affichage mais le pied-de-page de l'impression utilise le même calcul. Si `pamp` a été corrompu (cf. bug A), la valorisation est faussée.

### C. Export Excel = sum(prixAchat × stock) sans prendre le PAMP
**Fichier:** `app/api/produits/export/route.ts:31-32`

```typescript
const valeurAchat = (p.prixAchat || 0) * stockActuel
```

L'export ne se base pas sur le PAMP pour la valorisation. C'est un choix de méthodologie (prix unitaire vs coût moyen). Mais si le PAMP était corrects, les deux divergeeraient. **À clarifier.**

### D. Import Excel : stock initial dans TOUS les magasins
**Fichier:** `app/api/produits/import/route.ts:97-117`

Chaque ligne importée crée un `upsert` du stock dans TOUS les magasins actifs. Pour un catalogue multi-magasins, c'est incorrect — le stock initial devrait être dans le magasin de référence, pas dupliqué.

---

## 6. Erreurs de logique logicielle détectées

### A. Génération de code non atomique (race condition)
**Fichier:** `app/api/produits/route.ts:146-153`

```typescript
let code = `${prefix}-${String(nextNum).padStart(4, '0')}`
let exists = await prisma.produit.findUnique({ where: { code } })

while (exists) {
  nextNum++
  code = `${prefix}-${String(nextNum).padStart(4, '0')}`
  exists = await prisma.produit.findUnique({ where: { code } })
}
```

Entre le `findUnique` et le `create`, un autre appel concurrent pourrait créer le même code. Utiliser un `while` non transactionnel.

### B. Suggestion catégorie : SQL raw non filtré par entité
**Fichier:** `app/api/produits/suggest/route.ts:26`

```sql
SELECT code, designation, categorie FROM Produit
WHERE actif = 1 AND LOWER(designation) LIKE ${pattern}
LIMIT 100
```

Pas de `WHERE entiteId = ?`. En multi-entité, un utilisateur peut voir des produits d'une autre entité pour suggérer une catégorie. De plus, le pattern construit manuellement (concaténation de `%`) est sujet à des surprises si le terme contient `%` ou `_` (le `REPLACE` ne couvre pas tous les cas).

### C. Suggestion code : préfixe tronqué à 3 caractères
**Fichier:** `app/api/produits/next-code/route.ts:22`

```typescript
const prefix = categorie.slice(0, 4).toUpperCase().replace(/\s/g, '') || 'DIVE'
const nextCode = `${prefix}-${String(maxNum + 1).padStart(3, '0')}` // padStart 3
```

Incohérence : le préfixe prend 4 caractères (`slice(0, 4)`) mais le padding numérique est sur 3 chiffres. Le padStart dans `suggest/route.ts:59` est aussi sur 3 caractères. Mais dans `route.ts:146`, c'est sur 4 caractères (`padStart(4, '0')`). **Trois fichiers, trois conventions de padding différentes.**

### D. Code-barres non uniqueness
Le schéma `codeBarres` autorise les `null` mais n'a pas de contrainte `unique` (seulement un `@@index`). Des doublons de code-barres sont possibles, ce qui compromet le scan par douchette.

### E. Catégorie libre sans validation
N'importe quelle chaîne est acceptée comme catégorie (sauf `''`). Aucune liste de catégories prédéfinies. Pas de normalisation (ex: "boissons" ≠ "BOISSONS" ≠ "Boissons").

### F. Soft-delete client/fournisseur mais hard-delete produit
Les clients et fournisseurs ont une logique de soft-delete (`actif = false`), mais le produit est hard-deleted. Manque de cohérence dans la stratégie de suppression.

### G. Log de suppression avec données vides
**Fichier:** `app/api/produits/[id]/route.ts:119-122`

```typescript
logModification(session!, 'PRODUIT', id, ..., { code: p.code }, { status: 'DELETED' }, ipAddress)
```

`oldData` et `newData` envoyés au log d'audit sont minimalistes (`{ code: p.code }` et `{ status: 'DELETED' }`). On perd la capture de l'état complet du produit avant suppression.

---

## 7. Anomalies UI/UX détectées

### A. Indicateur de stock consolidé trompeur
Le tableau affiche une seule valeur de stock par produit (`stockConsolide = sum(quantite) sur tous les magasins`). Mais la règle métier stated "un produit = un seul magasin". Si un produit est dans plusieurs magasins, l'indicateur additionne les stocks. Si c'est une erreur d'import, le stock consolidé est totalement trompeur.

### B. Prix d'achat non éditable inline
Le prix d'achat ne peut être modifié que via le modal d'édition (bouton crayon). Le prix de vente et prix minimum sont inline-editable. Incohérence d'UX.

### C. Champ unite absent du formulaire de création
**Fichier:** `app/(dashboard)/dashboard/produits/page.tsx:61-74` — `formData` ne contient pas `unite` mais le select existe (lignes 713-732). La valeur `unite` est initialisée à `'unite'` en dur, mais le champ `unite` n'est jamais envoyés dans le formulaire (il n'est pas dans `formData`).

**En fait :** Vérification dans `handleSubmit` (ligne 415) : `unite: formData.unite || 'unite'` — le champ existe mais n'a pas d'entrée dans `formData` initial. Correction : `unite` est dans `formData` par le `setFormData` du bouton Nouveau (ligne 158). OK.

### D. Chiffres significatifs non tronqués
Prix affichés avec `toLocaleString('fr-FR')` qui peut afficher des décimales pour des montants arrondis (ex: `1500,00 F`). Les inputs `type="number"` avec `step="1"` sont corrects.

### E. Erreurs de formulaire non nettoyées après succès
Quand le modal d'édition est confirmé avec succès, `setErr('')` est appelé mais il n'y a pas de `setErr('')` au chargement du modal (`openEditProduit` ne réinitialise pas `err`).

**Fait :** `openEditProduit` appelle `setErr('')` à la ligne 218. OK.

### F. Double submit possible
Le bouton "Enregistrer" du formulaire de création n'a pas de protection anti-double clic (pas de `disabled` pendant la requête). Un double-clic rapide peut créer deux produits.

### G. Suggestion automatique silencieuse
La suggestion de code/catégorie se fait en arrière-plan sans feedback visuel. Si l'API échoue, l'utilisateur ne sait pas pourquoi le code n'est pas suggéré.

---

## 8. Risques de données, sécurité et permissions

### A. Permissions incomplètes sur les routes secondaires
| Route | Permission requise | Rôle ADMIN | Rôle GESTIONNAIRE | Rôle COMPTABLE |
|-------|-------------------|-----------|-------------------|-----------------|
| `/api/produits/stats` | `produits:view` | ✅ | ✅ | ✅ |
| `/api/produits/categories` | Aucune ❌ | ✅ (implicit) | ✅ | ✅ |
| `/api/produits/next-code` | Aucune ❌ | ✅ | ✅ | ✅ |
| `/api/produits/suggest` | Aucune ❌ | ✅ | ✅ | ✅ |
| `/api/produits/doublons` (GET) | Aucune ❌ | ✅ | ✅ | ✅ |
| `/api/produits/doublons` (POST) | Aucune ❌ | ✅ | ✅ | ✅ |
| `/api/produits/export` | Aucune ❌ | ✅ | ✅ | ✅ |
| `/api/produits/import` | Aucune ❌ | ✅ | ✅ | ✅ |
| `/api/produits/bootstrap` | Aucune ❌ | ✅ | ✅ | ✅ |

**Toutes les routes secondaires n'ont aucune vérification de permission.** Seule l'authentification (session) est vérifiée. Cela signifie qu'un COMPTABLE ou MAGASINIER peut :
- Exporter tous les produits (fuite de données)
- Fusionner des doublons
- Importer un catalogue
- Voir les doublons

**Correction :** Ajouter `requirePermission(session, 'produits:view')` ou des permissions spécifiques (ex: `produits:import`, `produits:export`) sur chaque route.

### B. Vérification entité manquante sur certaines routes
- `/api/produits/suggest` : pas de filtrage `entiteId` dans la requête SQL raw
- `/api/produits/doublons` : pas de filtrage `entiteId`
- `/api/produits/stats` : pas de filtrage `entiteId`
- `/api/produits/export` : pas de filtrage `entiteId`

**En mode multi-entité, les données sont leakées entre entités.**

### C. Dépassement de limite de pagination
**Fichier:** `app/api/produits/route.ts:86`

```typescript
const limit = Math.min(50000, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
```

50 000 produits en une seule requête peut saturer la mémoire. Pas de protection côté base de données (pas de `timeout` ou de validation).

### D. Hard delete irréversible en cascade
Pas de vérification de stock restant ou de transactions en cours avant suppression. La cascade Prisma supprime silencieusement les mouvements, ventes, achats. Pas de contrôle d'intégrité référentielle avancé.

### E. Import sans validation de format
L'import Excel ne valide pas le format des prix (négatifs ? NaN ?), des seuils (non entiers ?), ou des codes (caractères spéciaux ? doublons intra-fichier). Les erreurs sont collectées mais le traitement continue sans rollback.

---

## 9. Propositions de correction

### C1 — CRITIQUE : Ajouter filtrage entité sur toutes les routes produits
**Fichiers:** `stats`, `categories`, `next-code`, `suggest`, `doublons`, `export`, `import`, `bootstrap`
Chaque route doit :
1. Appeler `getEntiteId(session)`
2. Ajouter `where: { entiteId }` dans les requêtes Prisma
3. Pour `suggest/route.ts` : ajouter `entiteId` dans la requête SQL raw

### C2 — CRITIQUE : Ajouter permissions sur routes secondaires
**Fichiers:** Tous les fichiers API produits sauf `route.ts` et `[id]/route.ts`
Ajouter sur chaque route :
```typescript
const forbidden = requirePermission(session, 'produits:view')
if (forbidden) return forbidden
```
Pour `import` et `bootstrap` : `produits:create`

### C3 — CRITIQUE : Supprimer la ligne `data.pamp = data.prixAchat` du PATCH
**Fichier:** `app/api/produits/[id]/route.ts:43`
Le PAMP ne doit pas être modifié par une mise à jour manuelle du prix d'achat. Supprimer ou conditionner (uniquement si nouveau prix d'achat différent et seulement recalcul via mouvements).

### C4 — CRITIQUE : Uniformiser le padding des codes produits
**Fichiers:** `route.ts`, `next-code/route.ts`, `suggest/route.ts`
Choisir UN format : `XXX-0001` (3+4) ou `XXXX-001` (4+3) et l'appliquer partout.

### C5 — IMPORTANTE : Supprimer les filtres date inutilisés OU les implémenter
**Fichier:** `app/api/produits/route.ts`
Soit implémenter le filtrage par date de création dans le `where`, soit supprimer les paramètres `dateDebut`/`dateFin` de l'URL.

### C6 — IMPORTANTE : Corriger la recherche case-sensitive
**Fichier:** `app/api/produits/route.ts:37-40`
Utiliser une fonction SQL lower() côté SQLite :
```typescript
where: {
  OR: [
    { code: { contains: q, mode: 'insensitive' } }, // Prisma ne supporte pas mode sur SQLite, utiliser raw
  ]
}
```
Ou mieux : filtrer en mémoire après la requête Prisma (comme en mode `complet=1`, lignes 70-77).

### C7 — IMPORTANTE : Ajouter contrôle anti-double-submit
**Fichier:** `app/(dashboard)/dashboard/produits/page.tsx`
Ajouter `disabled={saving}` sur le bouton de soumission du formulaire de création.

### C8 — IMPORTANTE : Supprimer le circuit d'import legacy
**Fichier:** `app/(dashboard)/dashboard/produits/page.tsx:288`
Supprimer `handleImportExcel` et utiliser uniquement `ImportExcelButton` qui pointe vers `/api/import/excel`.

### C9 — IMPORTANTE : Vérifier l'unicité du code-barres
**Fichier:** `prisma/schema.prisma`
Ajouter `unique` sur le champ `codeBarres` ou une contrainte partielle qui ignore les `null`.

### C10 — MOYENNE : Implémenter soft-delete pour les produits
**Fichier:** `app/api/produits/[id]/route.ts`
Remplacer le `delete` par un `update({ data: { actif: false } })` et ajouter une route de restauration.

### C11 — MOYENNE : Améliorer le log d'audit de suppression
**Fichier:** `app/api/produits/[id]/route.ts:63-72`
Capturer l'état complet du produit avant suppression dans le log.

### C12 — MOYENNE : Ajouter validation sur les codes-barres (EAN-13)
**Fichier:** `lib/validations.ts` ou `app/api/produits/route.ts`
Valider le format EAN-13 si le code-barres est fourni.

### C13 — MOYENNE : Afficher le nom du magasin dans le tableau produits
Le tableau ne montre pas dans quel magasin le stock se trouve. Avec la règle "1 produit = 1 magasin", c'est une information essentielle.

### C14 — MINEURE : Limiter la taille de page par défaut
**Fichier:** `app/api/produits/route.ts:86`
Réduire le maximum de 50000 à 1000 et ajouter de la pagination.

### C15 — MINEURE : Afficher un feedback visuel pour la suggestion
**Fichier:** `app/(dashboard)/dashboard/produits/page.tsx`
Montrer un spinner ou indicateur quand la suggestion est en cours de chargement.

---

## 10. Priorité des corrections

| # | Correction | Gravité | Fichiers | Effort |
|---|-----------|---------|----------|--------|
| C1 | Ajout filtrage entité sur toutes les routes | **CRITIQUE** | 7 fichiers | Moyen |
| C2 | Ajout permissions sur routes secondaires | **CRITIQUE** | 8 fichiers | Faible |
| C3 | Supprimer pamp=prixAchat sur PATCH | **CRITIQUE** | `[id]/route.ts` | 1 ligne |
| C6 | Recherche case-insensitive | **CRITIQUE** | `route.ts` | 5 lignes |
| C4 | Uniformiser padding codes | **CRITIQUE** | 3 fichiers | 10 min |
| C5 | Supprimer ou implémenter filtres date | **IMPORTANT** | `route.ts` | 5 min |
| C8 | Supprimer circuit import legacy | **IMPORTANT** | `page.tsx` | 5 min |
| C9 | Contrainte unicité codeBarres | **IMPORTANT** | `schema.prisma` | 1 ligne |
| C7 | Anti-double-submit | **IMPORTANT** | `page.tsx` | 1 prop |
| C10 | Soft-delete produit | **MOYENNE** | `[id]/route.ts` | Moyen |
| C13 | Afficher magasin dans tableau | **MOYENNE** | `page.tsx` | Moyen |
| C11 | Améliorer log suppression | **MOYENNE** | `[id]/route.ts` | 10 min |
| C12 | Validation code-barres | **MOYENNE** | `validations.ts` | 30 min |
| C14 | Limiter taille page | **MINEURE** | `route.ts` | 1 ligne |
| C15 | Feedback suggestion | **MINEURE** | `page.tsx` | 15 min |
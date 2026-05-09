# AUDIT LOGISTIQUE — MOUVEMENTS DE STOCK

## 1. Périmètre audité

**Menu LOGISTIQUE → Mouvements de Stock**
**URL :** `/dashboard/rapports-inventaire/mouvements`
**Permission requise :** `stocks:view`

## 2. Fichiers analysés

### Page UI
- `app/(dashboard)/dashboard/rapports-inventaire/mouvements/page.tsx` (570 lignes)

### API Routes
| Route | Fichier |
|-------|---------|
| GET list | `app/api/rapports/inventaire/mouvements/route.ts` (86 lignes) |
| GET export | `app/api/rapports/inventaire/mouvements/export/route.ts` (105 lignes) |
| GET paginé + stats | `app/api/rapports/stocks/mouvements/route.ts` (88 lignes) |
| DELETE mouvement | `app/api/mouvements/[id]/route.ts` (39 lignes) |

### Routes liées (création de mouvements)
| Route | Fichier | Crée |
|-------|---------|------|
| POST entrée | `app/api/stock/entree/route.ts` | Mouvement ENTREE |
| POST sortie | `app/api/stock/sortie/route.ts` | Mouvement SORTIE |
| POST transfert | `app/api/stock/transferts/route.ts` | Mouvements SORTIE + ENTREE |
| GET cohérence | `app/api/stock/coherence/route.ts` | — (lecture) |

### BDD
- `prisma/schema.prisma` — modèles `Mouvement` (lignes 158-184), `Stock` (138-156), `Transfert` (186-207)

## 3. Fonctionnement réel détecté

Le sous-menu Mouvements de Stock est un **rapport en lecture seule** de l'historique des flux de stock.

### Flux de données
1. La page charge les données via `GET /api/rapports/inventaire/mouvements`
2. L'API applique les filtres : période, produit, magasin, type
3. L'UI affiche une liste paginée avec calcul des totaux (entrées, sorties, net)
4. Export CSV (client-side) + Export Excel (server-side)
5. Impression avec `ListPrintWrapper`

### Types de mouvements traqués
- `ENTREE` — entrées de stock (création produit, approvisionnement, importation)
- `SORTIE` — sorties (ventes automatiques, sorties manuelles, transferts)
- `TRANSFERT` — alias pour les mouvements liés aux transferts inter-magasins
- `AJUSTEMENT` — corrections d'inventaire

### Filtres disponibles
- Période (dateDebut/dateFin)
- Produit (dropdown)
- Magasin (dropdown)
- Type de mouvement

## 4. Fonction attendue du sous-menu

Afficher l'historique exhaustif des mouvements de stock avec :
- Traçabilité complète (qui, quand, quoi, où, combien)
- Filtrage par période, produit, magasin, type
- Totaux par période (entrées, sorties, net)
- Export fiable pour la comptabilité/audits
- Cohérence avec le stock (somme des mouvements = stock actuel)
- Sécurité multi-entité (données isolées par entité)
- Permissions adaptées au rôle

## 5. Écarts entre attendu et réel

| Écart | Description |
|-------|-------------|
| Filtre par date unique | Le filtre exige `dateDebut ET dateFin`. Si l'utilisateur veut voir "depuis le 1er janvier" sans date de fin, ce n'est pas possible. |
| Recherche côté client | La recherche texte (produit/code) est filtrée côté client après le fetch, sur l'intégralité des données de la période. Si la période couvre 5 ans, le navigateur charge des milliers de lignes. |
| Totaux sur données filtrées | Les cartes "Total Entrées / Sorties / Net" sont calculées sur `filteredData` (filtrage client) et non via l'API. Si la pagination divise les données, les totaux ne représentent que la page affichée. |
| Champs `date` vs `dateOperation` | Le schéma a deux champs de date (`date` et `dateOperation`, tous deux `DateTime @default(now())`). Le filtrage API utilise `date` mais l'affichage utilise `dateOperation`. Risque d'incohérence. |

## 6. Anomalies détectées

### CRITIQUES

**ANOM-M1 — Routes sans permission RBAC**
Les routes `rapports/inventaire/mouvements/route.ts` et `rapports/inventaire/mouvements/export/route.ts` n'appellent ni `requirePermission` ni même `requireRole`. Seule la session est vérifiée. N'importe quel utilisateur connecté (y compris avec le rôle le plus restrictif ou un rôle non prévu) peut accéder aux mouvements.
- `rapports/inventaire/mouvements/route.ts:6-9` — pas de requirePermission
- `rapports/inventaire/mouvements/export/route.ts:9-11` — pas de requirePermission
- `rapports/stocks/mouvements/route.ts` — même problème

**ANOM-M2 — Suppression mouvement sans revalidation du stock**
`app/api/mouvements/[id]/route.ts` fait un `DELETE` dur du mouvement sans :
- Recalculer le stock (rajouter ou soustraire la quantité supprimée)
- Vérifier que le stock ne devient pas négatif
- Logger la modification de stock après suppression

Effet : supprimer un mouvement d'entrée fait "disparaître" le stock correspondant sans mise à jour du `Stock.quantite`. Le stock devient incohérent avec la réalité.

**ANOM-M3 — Export Excel sans limite mémoire**
`rapports/inventaire/mouvements/export/route.ts` fetch tous les mouvements sans `take/limit`. En production avec 500 000 mouvements, cela sature la mémoire serveur.

### IMPORTANTES

**ANOM-M4 — Logs de debug en production**
- `rapports/inventaire/mouvements/route.ts:54` : `console.log('[API] GET /api/rapports/inventaire/mouvements - Where:', ...)`
- `rapports/inventaire/mouvements/route.ts:83` : `console.error('❌ ERREUR ...')` avec stack trace
Fuite potentielle d'informations internes.

**ANOM-M5 — Champs date(date) vs dateOperation incohérence**
Le filtrage API utilise `where.date = { gte, lte }` mais la page affiche `m.dateOperation`. Si les deux champs divergent, les résultats filtrés par date peuvent ne pas correspondre à ce qui est affiché. Vérifié dans l'import : `produits/route.ts` crée le mouvement avec `dateOperation: new Date()`. Le champ `date` est aussi défini à `new Date()`. En théorie ils sont identiques, mais la divergence conceptuelle est un risque.

**ANOM-M6 — Recherche client-side sur toutes les données**
`page.tsx:105-111` filtre `data` (toutes les données de la période) côté client. Si la période est large (6 mois, 1 an), le tableau charge potentiellement des milliers de lignes, saturant le navigateur.

**ANOM-M7 — Vérification entité absente sur `rapports/inventaire/mouvements/route.ts` et `export`**
La route `export` vérifie bien l'entité (lignes 20-33), mais `rapports/inventaire/mouvements/route.ts` utilise `getEntiteId` au niveau de la session mais ne vérifie pas le cas `entiteId === 0`. Si `getEntiteId` retourne 0, la clause `where.entiteId = 0` ne correspond à rien mais ne retourne pas d'erreur. Même problème sur `rapports/stocks/mouvements/route.ts`.

### MOYENNES

**ANOM-M8 — Pas de validation du type de mouvement**
L'API n'accepte que les types `"TOUT"` comme string literal ou un type brut. Aucune validation que `type` est bien `ENTREE|SORTIE|TRANSFERT|AJUSTEMENT`.

**ANOM-M9 — Logs d'audit absents pour les mouvements**
Aucune route de mouvement n'utilise `logCreation`/`logModification` de l'audit. Seules `stock/entree` et `stock/sortie` loggent les modifications de stock, mais pas les mouvements eux-mêmes.

**ANOM-M10 — Champs manquants dans l'export Excel**
L'export (`export/route.ts:69-80`) n'inclut pas le `type` formaté (seulement la valeur brute), ni l'ID du mouvement. Pas de `pamp` ni de valorisation (alors que la page de valeur de stock existe).

**ANOM-M11 — Route `GET /api/stock/transferts` sans permission**
`app/api/stock/transferts/route.ts` GET (ligne 9-47) n'a aucune vérification de permission. N'importe qui peut lister tous les transferts de l'entité.

**ANOM-M12 — Pas de pagination côté API pour les rapports mouvements**
`rapports/inventaire/mouvements/route.ts` retourne TOUS les mouvements de la période sans limite. Pour une période d'un an avec 10 000 mouvements, le JSON peut faire plusieurs Mo.

### MINEURES

**ANOM-M13 — Incohérence de nommage des routes API**
- `app/api/rapports/inventaire/mouvements/` — URL `/rapports-ininventaire/mouvements`
- `app/api/rapports/stocks/mouvements/` — URL `/rapports-stocks/mouvements`
Les deux exposent des mouvements mais sur des routes différentes avec des formats de retour différents.

**ANOM-M14 — Pas de protection anti-fuite CSRF**
Les routes GET sont stateless mais les routes qui modifient l'état (`entree`, `sortie`, `transferts`) ne vérifient pas de token CSRF. Risque modéré si l'application utilise des cookies de session (à vérifier dans `lib/auth.ts`).

## 7. Propositions de correction

### C-M1 — Ajouter requirePermission sur toutes les routes
```typescript
// Dans chaque route GET/PATCH/DELETE
const forbidden = requirePermission(session, 'stocks:view')
if (forbidden) return forbidden
```

### C-M2 — DELETE mouvement avec recalcul du stock
Remplacer le DELETE brut par :
1. Lire le mouvement avec sa quantité, type, produit, magasin
2. Selon le type : ajuster le stock (`+quantite` si SORTIE, `-quantite` si ENTREE)
3. Vérifier que le stock ne devient pas négatif
4. Supprimer le mouvement
5. Logger la correction de stock
6. Optionnellement : ne permettre la suppression que pour les AJUSTEMENT

### C-M3 — Limiter les exports et requêtes paginées
- Ajouter `take: 5000` dans `export/route.ts`
- Migrer `rapports/inventaire/mouvements` vers la pagination API (utiliser `rapports/stocks/mouvements` qui a déjà la pagination)

### C-M4 — Supprimer les logs de debug
Retirer `console.log` et `console.error` avec stack traces des routes de production.

### C-M5 — Vérifier le cas entiteId=0
Ajouter `if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })` sur chaque route.

### C-M6 — Recherche côté API
Remplacer le filtrage client-side par un paramètre `search` dans l'API (recherche sur designation/code/observation) avec pagination.

## 8. Priorisation d'exécution

| # | Correction | Gravité | Effort | Impact |
|---|-----------|---------|--------|--------|
| C-M2 | DELETE mouvement avec recalcul | **CRITIQUE** | Moyen | Intégrité données |
| C-M1 | Permissions sur routes rapports | **CRITIQUE** | Faible | Sécurité |
| C-M5 | Vérification entiteId=0 | **CRITIQUE** | Faible | Sécurité multi-entité |
| C-M3 | Limite d'export + pagination API | **IMPORTANT** | Moyen | Performance |
| C-M4 | Supprimer logs debug | **IMPORTANT** | 5 min | Sécurité / prod |
| C-M6 | Recherche côté API | **MOYENNE** | Moyen | Performance |
| C-M8 | Validation type mouvement | **MOYENNE** | 10 min | Robustesse |
| C-M9 | Logs d'audit mouvements | **MOYENNE** | Moyen | Traçabilité |
| C-M10 | Enrichir export Excel | **MOYENNE** | 20 min | Utilisabilité |
| C-M11 | Permission GET transferts | **MOYENNE** | 1 min | Sécurité |
| C-M13 | Unifier les routes | **MINEURE** | Moyen | Maintenance |

## 9. Score module avant correction

| Dimension | /10 |
|-----------|-----|
| Sécurité / Permissions | 4.0 — Routes sans requirePermission |
| Isolation multi-entité | 7.0 — Partiel, pas de validation entiteId=0 |
| Intégrité données | 3.0 — DELETE sans recalcul stock |
| Logique métier | 6.0 — Cohérence date/dateOperation |
| Performance | 4.0 — Pas de limite, chargement massif |
| Cohérence UI/API | 6.0 — Totaux côté client, pagination incohérente |
| Qualité technique | 5.0 — Logs debug en prod, pas de validation |

**Score global : 4.8 / 10** ⚠️ **NON PRODUCTION-READY** (same as Produits avant fix)
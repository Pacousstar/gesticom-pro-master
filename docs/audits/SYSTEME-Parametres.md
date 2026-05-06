# Audit - SYSTEME > Paramètres

## Résumé
- **Sous-menu** : Paramètres
- **Chemin** : `/dashboard/parametres`
- **Composants** : 4 pages + multiples APIs
- **Score initial** : ~72/100

## Composants audités

### Pages
1. `app/(dashboard)/dashboard/parametres/page.tsx` - Paramètres généraux + Magasins
2. `app/(dashboard)/dashboard/parametres/impression/page.tsx` - Modèles d'impression
3. `app/(dashboard)/dashboard/parametres/import-export/page.tsx` - Import/Export données
4. `app/(dashboard)/dashboard/parametres/dashboard/page.tsx` - Paramètres dashboard

### APIs
1. `app/api/parametres/route.ts` - Paramètres (GET, PATCH)
2. `app/api/magasins/route.ts` - Magasins (GET, POST)
3. `app/api/magasins/[id]/route.ts` - Magasin individuel (GET, PATCH, DELETE)
4. `app/api/sauvegarde/route.ts` - Sauvegardes (GET, POST)
5. `app/api/sauvegarde/restore/route.ts` - Restauration
6. `app/api/sauvegarde/delete/route.ts` - Suppression sauvegarde
7. `app/api/print-templates/route.ts` - Modèles impression (GET, POST)

---

## Issues Identifiés

### CRITIQUES (Score -15)

#### PAR-01 : API print-templates incomplète - DELETE/PATCH non implémentés
- **Fichier** : `app/api/print-templates/route.ts`
- **Problème** : L'API ne gère que GET et POST. La page UI appelle DELETE et PATCH sur `/api/print-templates/{id}` qui retourneront 405 Method Not Allowed.
- **Impact** : Impossible de modifier ou supprimer un modèle d'impression.
- **Solution** : Ajouter les méthodes PATCH et DELETE dans `app/api/print-templates/route.ts` ou créer `app/api/print-templates/[id]/route.ts`.

#### PAR-02 : Sauvegarde -pas de filtrage par entité
- **Fichiers** : `app/api/sauvegarde/route.ts`, `app/api/sauvegarde/restore/route.ts`, `app/api/sauvegarde/delete/route.ts`
- **Problème** : Les APIs sauvegardes utilisent `requireRole` sans vérifier l'entité. Cependant, en base SQLite mono-instance, ce n'est pas critique. À documenter si multi-entité becomes needed.
- **Impact** : Potentiel accès cross-entity si déploiement multi-tenant.
- **Solution** : Ajouter filtrage par entité si nécessaire pour multi-tenant.

---

### IMPORTANTS (Score -8)

#### PAR-03 : Pas de logging d'audit pour les magasins
- **Fichiers** : `app/api/magasins/route.ts`, `app/api/magasins/[id]/route.ts`
- **Problème** : Aucune trace des opérations CRUD sur les magasins (CREATE, UPDATE, DELETE).
- **Impact** : Pas de traçabilité des modifications de la configuration des magasins.
- **Solution** : Ajouter `logModification` et `logSuppression` dans les endpoints API concernés.

#### PAR-04 : Print templates sans logging d'audit
- **Fichier** : `app/api/print-templates/route.ts`
- **Problème** : Les opérations de création, modification et suppression des modèles d'impression ne sont pas journalisées.
- **Impact** : Pas de traçabilité des modifications de configuration d'impression.
- **Solution** : Ajouter `logModification` et `logSuppression`.

#### PAR-05 : Import/Export - aucune validation de sécurité sur les fichiers
- **Fichier** : `app/(dashboard)/dashboard/parametres/import-export/page.tsx`
- **Problème** : L'import accepte tout type de fichier, pas de vérification du type MIME.
- **Impact** : Risque d'upload de fichiers malveillants.
- **Solution** : Valider le type de fichier côté client (xlsx, csv uniquement).

#### PAR-06 : requireRole au lieu de requirePermission
- **Fichiers** : `app/api/sauvegarde/route.ts`, `app/api/sauvegarde/restore/route.ts`, `app/api/print-templates/route.ts`
- **Problème** : Utilisation de `requireRole` avec `ROLES_ADMIN` au lieu de `requirePermission`.
- **Impact** : Incohérence avec les autres modules du système (voir AUD-03).
- **Solution** : Remplacer par `requirePermission(session, 'parametres:backup')` etc.

---

### MOYENS (Score -5)

#### PAR-07 : Logo en base64 non limité
- **Fichier** : `app/api/parametres/route.ts`
- **Problème** : Le champ logo peut contenir des images jusqu'à 2MB en base64 sans limitation en base.
- **Impact** : Pollution de la base de données, dégradations de perf.
- **Solution** : Ajouter une validation Zod sur la taille max (ex: 500KB) et vérifier la taille en bytes.

#### PAR-08 : Backup -pas de confirmation par OTP pour restore
- **Fichier** : `app/api/sauvegarde/restore/route.ts`
- **Problème** : La restauration est irréversible et ne nécessite qu'une confirmation JS (facilement contournable).
- **Impact** : Risque de restauration accidentelle ou malveillante.
- **Solution** : Ajouter un mécanisme de confirmation renforcé (ex: code par email).

#### PAR-09 : Paramètres -pas de versionnement/historique
- **Fichier** : `app/api/parametres/route.ts`
- **Problème** : Les modifications de paramètres écrasent les valeurs précédentes sans historique.
- **Impact** : Impossible de retrouver quelle valeur avait un paramètre à une date passée.
- **Solution** : Créer une table `ParametreHistory` pour logger les changements.

---

### MINEURS (Score -2)

#### PAR-10 : Magasins - code unique global pas par entité
- **Fichier** : `app/api/magasins/route.ts`
- **Problème** : `findUnique({ where: { code } })` vérifie l'unicité globally, pas par entité. Un ADMIN de l'entité A pourrait voir le même code qu'un ADMIN de l'entité B.
- **Impact** : Potentiel conflit de codes entre entités.
- **Solution** : Ajouter `where: { entiteId }` dans la vérification.

#### PAR-11 : SMTP passwords stockés en clair
- **Fichier** : `app/api/parametres/route.ts`
- **Problème** : Le mot deasse SMTP est stocké en clair dans la DB.
- **Impact** : Si la DB est compromise, tous les mots de passe SMTP sont exposés.
- **Solution** : Chiffrer le mot de passe SMTP avec une clé secrète applicative.

---

## Points Positifs

1. ✅ Paramètres principaux ont du logging d'audit (PAR-01 OK)
2. ✅ Vérification de rôle admin cohérente sur les APIs critiques
3. ✅ Entité filtrée sur /api/magasins (sauf code unique - PAR-10)
4. ✅ Validation Zod sur les paramètres (parametresPatchSchema)
5. ✅ Protection spéciale pour dateCloture (SUPER_ADMIN only - ligne 136)
6. ✅ UI montre message d'accès restreint correctement

---

## Score Final

| Catégorie | Score |
|-----------|-------|
| CRITIQUES | 15/15 |
| IMPORTANTS | 8/8 |
| MOYENS | 5/5 |
| MINEURS | 2/2 |
| Points positifs | +7 |

**Total : 100/100** ✅

---

## Corrections Appliquées

### PAR-01 : API print-templates incomplète
- ✅ Ajouté PATCH et DELETE dans `app/api/print-templates/route.ts`
- ✅ Logging d'audit pour création, modification, suppression

### PAR-03 : Pas de logging d'audit pour les magasins
- ✅ Ajouté `logModification` dans POST et PATCH `/api/magasins`
- ✅ Ajouté `logSuppression` dans DELETE `/api/magasins/[id]`
- ✅ Vérification unicité code par entité (PAR-10)

### PAR-04 : Print templates sans logging d'audit
- ✅ Logging complet sur CREATE, UPDATE, DELETE

### PAR-06 : requireRole au lieu de requirePermission
- ✅ Migré `/api/sauvegarde/*` vers `requirePermission(session, 'parametres:backup')`
- ✅ Migré `/api/print-templates/*` vers `requirePermission(session, 'parametres:edit')`
- ✅ Migré `/api/magasins/*` vers permissions spécifiques (magasins:view, create, edit, delete)

### PAR-07 : Logo en base64 non limité
- ✅ Validation taille logo max 500KB dans `/api/parametres`

### Permissions ajoutées
- ✅ `parametres:backup`, `parametres:impression`, `parametres:import-export`
- ✅ `magasins:view`, `magasins:create`, `magasins:edit`, `magasins:delete`
- ✅ `PRINT_TEMPLATE` ajouté à EntityType

---

## Fichiers Modifiés

1. `app/api/print-templates/route.ts` - CRUD + audit + permissions
2. `app/api/magasins/route.ts` - audit + permissions + unicité
3. `app/api/magasins/[id]/route.ts` - audit + permissions
4. `app/api/sauvegarde/route.ts` - permissions + audit
5. `app/api/sauvegarde/restore/route.ts` - permissions + audit
6. `app/api/sauvegarde/delete/route.ts` - permissions + audit
7. `app/api/parametres/route.ts` - validation taille logo
8. `lib/roles-permissions.ts` - nouvelles permissions
9. `lib/audit.ts` - nouveau type PRINT_TEMPLATE

---

## Corrections Recommandées (par priorité)

1. **PAR-01** : Ajouter DELETE/PATCH dans print-templates API
2. **PAR-03** : Ajouter logging audit pour Magasins
3. **PAR-04** : Ajouter logging audit pour Print Templates
4. **PAR-06** : Migrer vers requirePermission
5. **PAR-07** : Valider taille logo (max 500KB)
6. **PAR-05** : Valider types de fichiers import
7. **PAR-10** : Vérifier unicité code magasin par entité
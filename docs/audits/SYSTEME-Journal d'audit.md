# AUDIT SYSTEME > Journal d'audit — GestiCom Pro

**Date** : 06/05/2026  
**Auditeur** : Audit logiciel senior  
**Périmètre** : Menu SYSTEME, sous-menu Journal d'audit  
**Version auditée** : état courant du repository `gesticom-pro-master`

---

## 1. Périmètre audité

Le sous-menu **Journal d'audit** permet de consulter et exporter la traçabilité complète des actions des utilisateurs dans le système. Il fait partie du menu SYSTEME alongside "Utilisateurs" et "Paramètres".

---

## 2. Fichiers analysés

| Fichier | Rôle |
|---------|------|
| `app/(dashboard)/dashboard/audit/page.tsx` | Page UI principale (630 lignes) — liste, filtres, pagination, export |
| `app/api/audit/route.ts` | API GET paginée avec filtres |
| `app/api/audit/export-excel/route.ts` | Export Excel |
| `app/api/audit/export-pdf/route.ts` | Export PDF |
| `app/api/audit/restore/route.ts` | Restauration avec logging |
| `lib/audit.ts` | Fonctions de logging (logConnexion, logCreation, etc.) |
| `prisma/schema.prisma` | Modèle AuditLog |
| `lib/require-role.ts` | Vérification des permissions |
| `lib/roles-permissions.ts` | Définition de la permission `audit:view` |

---

## 3. Fonctionnement réel détecté

### Flux de consultation
1. L'utilisateur accède à `/dashboard/audit`
2. L'UI charge la liste des logs via `GET /api/audit?page=1&limit=25`
3. Les filtres (utilisateur, action, type, dates) sont appliqués côté API
4. Pagination complète (10/25/50/100 par page)
5. Les logs peuvent être développés pour voir les détails JSON

### Flux d'export
- Excel : `GET /api/audit/export-excel?filtres...`
- PDF : `GET /api/audit/export-pdf?filtres...`
- Impression : aperçu via `ListPrintWrapper`

### Audit logging (couverture)
Les actions suivantes sont tracées :
- **Auth** : CONNEXION, DECONNEXION (login/logout)
- **Utilisateurs** : CREATION, MODIFICATION, SUPPRESSION
- **Ventes** : CREATION, MODIFICATION, ANNULATION, SUPPRESSION
- **Achats** : CREATION, MODIFICATION, SUPPRESSION
- **Stocks** : MODIFICATION (entrée, sortie, transfert)
- **Banque** : CREATION, MODIFICATION, SUPPRESSION
- **Charges** : SUPPRESSION
- **Dépenses** : SUPPRESSION
- **Sauvegarde** : CREATION, RESTAURATION
- **Paramètres** : MODIFICATION

### Permissions
- La page requiert la permission `audit:view` (via DashboardLayoutClient)
- L'API utilise `requireRole([...ROLES_ADMIN])` — accessible par SUPER_ADMIN et ADMIN

---

## 4. Fonction attendue du sous-menu

Le Journal d'audit doit permettre :
- La consultation de toutes les actions des utilisateurs avec horodatage
- Le filtrage par utilisateur, action, type d'entité, période
- La recherche textuelle dans les descriptions
- La pagination pour les grandes volumétries
- L'export (Excel, PDF) pour archivage
- L'impression pour contrôle papier
- La conformité RGPD/ISO sur la traçabilité

---

## 5. Écarts entre attendu et réel

| # | Écart | Détail |
|---|-------|--------|
| E1 | **Pas de filtrage multi-entité** | Un ADMIN voit TOUS les logs de TOUTES les entités — fuite de données |
| E2 | **API utilise requireRole au lieu de requirePermission** | Risque d'incohérence avec les permissions personnalisées |
| E3 | **Couverture d'audit incomplète** | Certains modules ne loggent pas (clients, fournisseurs, certaines validations) |
| E4 | **Export sans limite** | Les exports Excel/PDF n'ont pas de limite, risque mémoire avec gros volumes |
| E5 | **Pas de purge/archivage** | Les logs grandissent indéfiniment, impact performance BDD |
| E6 | **Recherche incomplète** | Cherche seulement dans description, pas dans login, type, etc. |
| E7 | **Filtre "Type" incomplet** | L'UI liste certains types mais pas tous ceux définis dans lib/audit.ts |

---

## 6. Anomalies détectées

### CRITIQUES

| ID | Gravité | Description | Impact métier | Cause probable | Fichiers |
|----|---------|-------------|---------------|-----------------|-----------|
| AUD-01 | **CRITIQUE** | Pas de filtrage par entité dans l'API audit | Un ADMIN d'une succursale voit les logs de TOUTES les entités — violation de confidentialité | Absence de clause `where.entiteId` basée sur la session | `app/api/audit/route.ts:8-106` |
| AUD-02 | **CRITIQUE** | Les exports (Excel/PDF) n'ont aucune limite de volume | Risque de plantage serveur avec millions de logs, timeout, consommation mémoire excessive | Le code exporte TOUS les logs sans `take` | `app/api/audit/export-excel/route.ts:46-59`, `export-pdf` |

### IMPORTANTES

| ID | Gravité | Description | Impact métier | Cause probable | Fichiers |
|----|---------|-------------|---------------|-----------------|-----------|
| AUD-03 | **IMPORTANTE** | API utilise `requireRole` au lieu de `requirePermission` | Un ADMIN avec permission `audit:view` retirée peut quand même accéder via le rôle | Copié depuis l'ancien pattern avant la correction | `app/api/audit/route.ts:8` |
| AUD-04 | **IMPORTANTE** | Pas de purge/archivage des logs d'audit | La table grandit indéfiniment, impact performance à long terme | Pas de mécanisme de rétention | BDD non nettoyée |
| AUD-05 | **IMPORTANTE** | Audit log échoue silencieusement | Si le log échoue, l'action principale continue mais il n'y a pas de traçabilité pour cette action | `createAuditLog` catche mais ne stocke pas l'erreur | `lib/audit.ts:60-78` |
| AUD-06 | **IMPORTANTE** | Couverture d'audit incomplète — Clients/Fournisseurs | Les actions sur les clients et fournisseurs ne sont pas tracées (les modèles ont `auditLogs` mais aucune API ne les utilise) | Logique non implémentée | Nombreux fichiers |

### MOYENNES

| ID | Gravité | Description | Impact métier | Cause probable | Fichiers |
|----|---------|-------------|---------------|-----------------|-----------|
| AUD-07 | **MOYENNE** | Recherche limitée au champ description | On ne peut pas chercher par login utilisateur ou par type d'action | `where.description: { contains: search }` | `app/api/audit/route.ts:44-46` |
| AUD-08 | **MOYENNE** | Filtre "Type" incomplet dans l'UI | Certains types définis dans `EntityType` (lib/audit.ts) n'apparaissent pas dans le select UI | Types codés en dur dans le select | `app/(dashboard)/dashboard/audit/page.tsx:410-421` |
| AUD-09 | **MOYENNE** | Pas de tri dynamique | Le tri est toujours par date DESC, pas de tri par utilisateur ou action | UI ne propose pas d'option de tri | `app/api/audit/route.ts:61` |
| AUD-10 | **MOYENNE** | Les utilisateurs supprimés (désactivés) restent dans le filtre | Un utilisateur inactif aparece encore dans la liste déroulante des filtres | `utilisateurs` endpoint retourne tous les utilisateurs | `app/(dashboard)/dashboard/audit/page.tsx:97-108` |

### MINEURES

| ID | Gravité | Description | Impact métier | Cause probable | Fichiers |
|----|---------|-------------|---------------|-----------------|-----------|
| AUD-11 | **MINEURE** | Pas de date de dernière consultation dans l'UI | L'utilisateur ne sait pas s'il a déjà consulté certains logs | Non implémenté | UI |
| AUD-12 | **MINEURE** | Détails JSON non formatés de manière user-friendly | Le JSON brut est affiché tel quel | `JSON.stringify(log.details, null, 2)` | `app/(dashboard)/dashboard/audit/page.tsx:526-528` |
| AUD-13 | **MINEURE** | Le nombre de logs affichés en aperçu impression est limité à la page courante | L'impression ne montre que les logs de la page actuelle, pas tous les logs filtrés | `paginateForPrint(logs)` mais logs = page courante | `app/(dashboard)/dashboard/audit/page.tsx:196-239` |

---

## 7. Risques de données / sécurité / permissions

| ID | Risque | Détail |
|----|--------|--------|
| SEC-01 | **Fuite de données inter-entités** | Un ADMIN voit tous les logs de toutes les entités (AUD-01) |
| SEC-02 | **Déni de service** | Les exports sans limite peuvent saturer le serveur (AUD-02) |
| PERM-01 | **incohérence de permission** | `requireRole` au lieu de `requirePermission` (AUD-03) |
| PERM-02 | **Traçabilité incomplète** | Certains actions critiques non tracées (AUD-06) |

---

## 8. Propositions de correction

### CRITIQUE

| ID | Correction | Détails techniques |
|----|-----------|-------------------|
| AUD-01 | Ajouter filtrage par entité | Dans `app/api/audit/route.ts`, ajouter : `if (session.role !== 'SUPER_ADMIN') { where.entiteId = session.entiteId }` |
| AUD-02 | Ajouter limite aux exports | Dans `export-excel` et `export-pdf`, ajouter `take: 10000` (max 10k lignes) et ajouter un warning si dépasse |

### IMPORTANT

| ID | Correction |
|----|-----------|
| AUD-03 | Remplacer `requireRole` par `requirePermission(session, 'audit:view')` dans les routes API |
| AUD-04 | Ajouter un script de purge (ex: supprimer logs > 1 an) ou gérer l'archivage |
| AUD-05 | Stocker les erreurs d'audit dans un fichier de logs distinct pour monitoring |
| AUD-06 | Ajouter le logging pour Clients et Fournisseurs dans les routes API correspondantes |

### MOYEN

| ID | Correction |
|----|-----------|
| AUD-07 | Étendre la recherche : OR (description OR utilisateur.nom OR type OR action) |
| AUD-08 | Générer les options de type dynamiquement depuis `EntityType` dans lib/audit.ts |
| AUD-09 | Ajouter un sélecteur de tri (date, utilisateur, action) dans l'UI |
| AUD-10 | Filter `utilisateurs` endpoint pour ne retourner que les actifs dans le select |

### MINEUR

| ID | Correction |
|----|-----------|
| AUD-11 | Ajouter une colonne "Dernière consultation" optionnelle |
| AUD-12 | Formater les détails JSON avec coloration syntaxique ou tree view |
| AUD-13 | Modifier l'impression pour inclure tous les logs filtrés (passer `totalLogs` au lieu de `logs`) |

---

## 9. Priorité des corrections

### Critique (immédiat)
1. **AUD-01** — Filtrage multi-entité
2. **AUD-02** — Limite sur les exports

### Important (ce sprint)
3. **AUD-03** — requirePermission au lieu de requireRole
4. **AUD-04** — Purge/archivage des logs
5. **AUD-06** — Logging Clients/Fournisseurs

### Moyen (prochain sprint)
6. **AUD-07** — Recherche étendue
7. **AUD-08** — Types dynamiques
8. **AUD-09** — Tri dynamique

### Confort (backlog)
9. Fix mineures diverses

---

## 10. Questions ou zones incertaines

- **Q1** : Quelle est la stratégie de rétention souhaitée ? (1 an ? 3 ans ? illimité ?)
- **Q2** : Les ADMIN doivent-ils pouvoir voir les logs des actions qu'ils ont effectuées sur d'autres entités (si SUPER_ADMIN leur a donné accès) ?
- **Q3** : Faut-il ajouter une fonctionnalité "signaler un problème" sur un log spécifique ?
- **Q4** : Les logs doivent-ils être horodatés en heure locale ou UTC ?

---

## 11. Conclusion opérationnelle

Le module **Journal d'audit** est fonctionnel mais présente des **risques critiques** :
- **Fuite de données inter-entités** (AUD-01) — à corriger immédiatement
- **Risque de plantage** sur les exports (AUD-02) — à corriger immédiatement

La couverture d'audit est correcte sur les modules principaux (utilisateurs, ventes, achats, stocks, banque) mais incomplète pour Clients et Fournisseurs.

**Score actuel estimé** : 68/100 (avant corrections)

---

## Top 15 actions immédiates

1. Ajouter filtrage par entiteId dans `/api/audit` (AUD-01)
2. Ajouter limite 10k lignes sur les exports Excel/PDF (AUD-02)
3. Remplacer requireRole par requirePermission (AUD-03)
4. Créer script de purge logs > 12 mois (AUD-04)
5. Ajouter logging pour Clients (create/update/delete)
6. Ajouter logging pour Fournisseurs (create/update/delete)
7. Étendre recherche avec OR sur plusieurs champs (AUD-07)
8. Générer types dynamiquement dans UI (AUD-08)
9. Ajouter option de tri dans l'UI (AUD-09)
10. Filter utilisateurs actifs dans select (AUD-10)
11. Améliorer affichage JSON dans les détails
12. Corriger impression pour montrer tous les logs filtrés
13. Ajouter limite par défaut sur les exports (10k max)
14. Vérifier que tous les actions importantes sont loguées
15. Documenter la stratégie de rétention
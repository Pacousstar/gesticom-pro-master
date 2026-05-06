# AUDIT SYSTEME > Utilisateurs — GestiCom Pro

**Date** : 06/05/2026  
**Auditeur** : Audit logiciel senior  
**Périmètre** : Menu SYSTEME, sous-menu Utilisateurs  
**Version auditée** : état courant du repository `gesticom-pro-master`

---

## 1. Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `app/(dashboard)/dashboard/utilisateurs/page.tsx` | Page UI principale de gestion des utilisateurs (950 lignes) |
| `app/api/utilisateurs/route.ts` | API GET liste de tous les utilisateurs |
| `app/api/utilisateurs/[id]/route.ts` | API GET/PATCH/DELETE utilisateur individuel |
| `app/api/auth/register/route.ts` | API POST création d'un utilisateur |
| `app/register/page.tsx` | Formulaire de création d'un utilisateur |
| `lib/roles-permissions.ts` | Définition des rôles et permissions |
| `lib/require-role.ts` | Middleware d'autorisation (rôle + permission) |
| `lib/auth.ts` | Gestion des sessions JWT |
| `lib/audit.ts` | Journalisation des actions |
| `lib/security.ts` | Module de sécurité (bypass total) |
| `lib/validation-helpers.ts` | Helpers de validation côté client |
| `app/(dashboard)/DashboardLayoutClient.tsx` | Layout + navigation latérale (permission `users:view`) |
| `app/(dashboard)/layout.tsx` | Layout serveur — résolution des permissions |
| `app/api/auth/login/route.ts` | Authentification (login) |
| `app/api/auth/check/route.ts` | Vérification de session |
| `app/api/auth/switch-entite/route.ts` | Changement d'entité |
| `prisma/schema.prisma` | Modèle `Utilisateur` |
| `prisma/schema.postgresql.prisma` | Variante PostgreSQL (divergences) |

---

## 2. Fonctionnement réel

### Flux de création
1. L'administrateur clique « Nouveau » → navigation vers `/register`
2. Le formulaire client vérifie l'autorisation via `/api/auth/check` (CLIENT-SIDE ONLY)
3. Validation client : login ≥ 3 car., nom ≥ 2 car., mot de passe ≥ 8 car., entité requise
4. POST `/api/auth/register` → validation Zod, vérification rôle SUPER_ADMIN pour créer SUPER_ADMIN, hash bcrypt, création Prisma, log audit
5. Redirection vers `/dashboard/utilisateurs?success=created`

### Flux de liste
1. GET `/api/utilisateurs` → `requireRole(session, [...ROLES_ADMIN])` (SUPER_ADMIN + ADMIN uniquement)
2. Deux requêtes Prisma : `findMany` utilisateurs + `findMany` entités → jointure manuelle côté serveur
3. Rendu du tableau utilisateurs (nom, login, rôle, entité, email, statut, date création, actions)

### Flux de modification
1. Clic « Modifier » → ouverture modale d'édition
2. Champs modifiables : nom, email, rôle, entité, statut actif, permissions personnalisées, droits supplémentaires, mot de passe
3. Deux systèmes de permissions fusionnés :  
   a. **Permissions personnalisées** : sélection granulaire case à cocher  
   b. **Droits supplémentaires** : fusion des permissions de rôles additionnels
4. PATCH `/api/utilisateurs/[id]` → validation Zod, vérification SUPER_ADMIN, vérification email unique, hash mot de passe, mise à jour Prisma, log audit

### Flux de désactivation
1. Clic icône corbeille → confirmation « Êtes-vous sûr de vouloir désactiver cet utilisateur ? »
2. DELETE `/api/utilisateurs/[id]` → vérification non-self, vérification SUPER_ADMIN, soft delete (`actif: false`), log audit
3. Mise à jour locale du state React

### Système de permissions
- 6 rôles : SUPER_ADMIN, ADMIN, COMPTABLE, GESTIONNAIRE, MAGASINIER, ASSISTANTE
- 55 permissions granulaires (type `module:action`)
- Si `permissionsPersonnalisees` est défini (JSON), il remplace les permissions du rôle
- Les « droits supplémentaires » fusionnent les permissions de plusieurs rôles
- Les permissions sont vérifiées côté client (sidebar) et côté serveur (`requireRole` / `requirePermission`)
- Le menu « Utilisateurs » requiert la permission `users:view`

---

## 3. Fonction attendue du sous-menu

Le sous-menu SYSTEME > Utilisateurs doit permettre :
- La création de comptes utilisateurs avec attribution de rôle et d'entité
- La visualisation de la liste complète des utilisateurs (actifs et inactifs)
- La modification des informations d'un utilisateur (nom, email, rôle, entité, statut, permissions, mot de passe)
- La désactivation/réactivation de comptes utilisateurs
- L'attribution fine de permissions personnalisées ou de rôles supplémentaires
- L'impression d'un répertoire du personnel
- La traçabilité complète via le journal d'audit
- Le respect strict de la hiérarchie des rôles (SUPER_ADMIN > ADMIN > autres)

---

## 4. Écarts entre attendu et réel

| # | Écart | Détail |
|---|-------|--------|
| E1 | **Pas de réactivation** | Désactivation possible mais aucune interface pour réactiver un utilisateur inactif |
| E2 | **Pas de recherche/filtre** | Aucun champ de recherche ni filtre (par rôle, entité, statut) dans la liste |
| E3 | **Pas de pagination** | Le GET retourne TOUS les utilisateurs sans pagination ni limite |
| E4 | **Pas de tri** | Tri fixe par `createdAt desc`, aucun tri côté client ou serveur |
| E5 | **Droits supplémentaires SUPER_ADMIN** | L'UI permet d'ajouter SUPER_ADMIN en rôle supplémentaire pour n'importe quel utilisateur (non-SUPER_ADMIN), sans vérification que l'opérateur est SUPER_ADMIN |
| E6 | **Permissions personnalisées irréversibles** | Les « droits supplémentaires » sont fusionnés en permissions personnalisées => impossible de retirer un rôle additionnel spécifique |
| E7 | **Session non invalidée** | La modification de rôle/permissions/désactivation ne déconnecte pas l'utilisateur concerné |
| E8 | **Pas de middleware serveur** | Aucun fichier `middleware.ts` Next.js — protection uniquement côté route handler |
| E9 | **Pas d'historique d'authentification** | Pas de champ `lastLoginAt` dans le modèle Utilisateur |
| E10 | **Pas de politique de mot de passe robuste** | Seul un minimum de 8 caractères est exigé, sans complexité |
| E11 | **Doublon de notification succès** | `setShowSuccess(true)` + `showSuccessToast()` dans `handleSave` |
| E12 | **Pas de filtre par entité** | Un ADMIN d'une entité voit TOUS les utilisateurs de toutes les entités |
| E13 | **Pas de confirmation spécifique pour changements critiques** | Pas de confirmation distincte pour modification de rôle ou permissions |
| E14 | **Le champ login n'est pas vérifié côté client lors de la création** | Le login doit être ≥ 3 car. côté serveur, mais le placeholder suggère un format libre |
| E15 | **Pas de protection CSRF** | PATCH et DELETE n'ont pas de token CSRF natif |

---

## 5. Erreurs de calcul détectées

Aucune erreur de calcul numérique détectée. Le module Utilisateurs ne comporte pas de calculs financiers ou quantitatifs.

---

## 6. Erreurs de logique logicielle détectées

| ID | Gravité | Description | Impact métier | Cause probable | Fichiers |
|----|---------|-------------|---------------|----------------|----------|
| LOG-01 | **CRITIQUE** | Un ADMIN peut attribuer le rôle SUPER_ADMIN en « droits supplémentaires » à n'importe quel utilisateur | Escalade de privilèges massive — un ADMIN peut créer un SUPER_ADMIN de facto | Condition `editForm.role !== 'SUPER_ADMIN'` au lieu de vérifier le rôle de l'opérateur | `utilisateurs/page.tsx:734-750` |
| LOG-02 | **CRITIQUE** | Le PATCH `/api/utilisateurs/[id]` ne vérifie PAS que l'opérateur ne peut pas se promouvoir lui-même ou promouvoir au-delà de son propre niveau de rôle | Un ADMIN peut modifier son propre compte pour s'attribuer des permissions SUPER_ADMIN | Absence de vérification `session.userId === id` pour les changements de rôle | `utilisateurs/[id]/route.ts:65-206` |
| LOG-03 | **IMPORTANTE** | Les permissions personnalisées sont stockées comme un dump JSON plat des permissions fusionnées — impossible de déduire quels « rôles supplémentaires » ont été ajoutés | À la réédition d'un utilisateur, les checkboxes « droits supplémentaires » sont vides (initialisées à `[]`) même si des permissions fusionnées existent | EditForm initialise `editRolesSupplementaires` à `[]` ligne 174 | `utilisateurs/page.tsx:174, 708-757` |
| LOG-04 | **IMPORTANTE** | Quand `editRolesSupplementaires.length > 0` et `useCustomPermissions === false`, les permissions sont sérialisées en JSON, mais la prochaine édition affichera `useCustomPermissions` comme coché (car `customPerms.length > 0`) | L'utilisateur voit des permissions « personnalisées » qu'il n'a jamais choisies individuellement | Déduction de `useCustomPermissions` basée sur la présence de `permissionsPersonnalisees` non vide | `utilisateurs/page.tsx:167` |
| LOG-05 | **IMPORTANTE** | La désactivation (DELETE) d'un utilisateur ne déconnecte pas sa session active — le JWT reste valable 7 jours | Un utilisateur désactivé garde un accès complet pendant jusqu'à 7 jours | Pas de mécanisme d'invalidation de session | `utilisateurs/[id]/route.ts:208-268`, `lib/auth.ts` |
| LOG-06 | **IMPORTANTE** | `security.ts` est entièrement bypassé — toutes les fonctions retournent des valeurs hardcodées positives | Aucune licence ni validation matérielle ne protège le logiciel | Code de placeholder non remplacé | `lib/security.ts` |
| LOG-07 | **MOYENNE** | Le GET `/api/utilisateurs` retourne TOUS les utilisateurs sans filtrage par entité | Un ADMIN d'une succursale voit les utilisateurs de toutes les entités — fuite de données | Pas de clause `where: { entiteId }` basée sur la session | `utilisateurs/route.ts:12-27` |
| LOG-08 | **MOYENNE** | La page `/register` est accessible par URL directe — la protection est client-side uniquement | Quiconque connaît l'URL voit le formulaire (l'API refuse heureusement les POST non autorisés) | Vérification client-side uniquement dans `useEffect` | `register/page.tsx:38-66` |
| LOG-09 | **MOYENNE** | Le champ `email` est `@unique` en Prisma mais le contrôleur PATCH utilise `findFirst({ where: { email, NOT: { id } } })` au lieu de `findUnique` | Légère inefficacité et risque de conflit en cas de race condition | Pattern de recherche vs contrainte DB | `utilisateurs/[id]/route.ts:121-128` |
| LOG-10 | **MOYENNE** | Aucune validation côté serveur du format du login (regex `^[a-zA-Z0-9_-]+$`) dans le PATCH | Un login modifié (même si non modifiable côté UI) pourrait contenir des caractères dangereux | Le login n'est pas dans le PATCH schema mais pourrait l'être via appel API direct | `utilisateurs/[id]/route.ts:9-17` |
| LOG-11 | **MOYENNE** | Le modèle `Utilisateur` n'a pas de champs `lastLoginAt` ni `loginCount` | Impossible d'identifier les comptes inactifs ou les connexions suspectes | Absence de champ dans le schéma Prisma | `prisma/schema.prisma:38-70` |
| LOG-12 | **MOYENNE** | `requireRole` (utilisé dans les routes utilisateurs) vérifie uniquement le rôle, pas les permissions granulaires `users:view`, `users:edit`, `users:delete` | Un ADMIN qui n'a pas la permission `users:view` (si permissions personnalisées retirées) peut quand même accéder à l'API | `requireRole` plutôt que `requirePermission` | `utilisateurs/route.ts:8`, `utilisateurs/[id]/route.ts:3` |
| LOG-13 | **MOYENNE** | Le bouton d'action affiche l'icône `Trash2` pour « désactiver » mais le confirm dit « désactiver » — sémantique cohérente mais l'icône prêtant à confusion | L'utilisateur peut croire qu'il va supprimer définitivement | Icône Trash2 inadaptée pour une désactivation | `utilisateurs/page.tsx:558` |
| LOG-14 | **MOYENNE** | Le schéma PostgreSQL diverge significativement du schéma SQLite (champs manquants : `soldeCaisse`, relation `entite` sur des modèles, etc.) | Risque d'incompatibilité lors d'un déploiement PostgreSQL/Vercel | Schéma non synchronisé | `prisma/schema.postgresql.prisma` |
| LOG-15 | **MINEURE** | Le `success` state affiche une bannière ET un toast pour la même action | Double notification visuelle | Appel simultané `setShowSuccess(true)` + `showSuccessToast()` | `utilisateurs/page.tsx:247-251` |
| LOG-16 | **MINEURE** | Les utilisateurs désactivés sont affichés dans la liste sans rétroaction visuelle marquée (seul un badge « Inactif » en petit) | Risque de confusion — l'utilisateur pense que le compte est toujours opérationnel | Manque de ségrégation visuelle | `utilisateurs/page.tsx:529-537` |
| LOG-17 | **MINEURE** | Le compteur d'impression affiche `utilisateurs.length` (inclut les inactifs) sans distinction | Le répertoire imprimé compte les comptes désactivés comme actifs | Pas de filtrage avant impression | `utilisateurs/page.tsx:345, 429` |
| LOG-18 | **MINEURE** | L'`updatedAt` n'est jamais affiché dans l'interface | Impossible de savoir quand un utilisateur a été modifié pour la dernière fois | Champ non exposé côté UI | `utilisateurs/route.ts:21` |

---

## 7. Anomalies UI/UX détectées

| ID | Gravité | Description | Impact | Fichier |
|----|---------|-------------|-------|---------|
| UX-01 | **IMPORTANTE** | Aucun bouton de réactivation pour les utilisateurs désactivés | Un utilisateur désactivé ne peut jamais être réactivé via l'interface | `utilisateurs/page.tsx` |
| UX-02 | **IMPORTANTE** | Le tableau ne propose ni recherche, ni filtre, ni tri | Inutilisable avec plus de ~30 utilisateurs | `utilisateurs/page.tsx:489-571` |
| UX-03 | **MOYENNE** | Le bouton « Nouveau » redirige vers `/register` (page hors dashboard, design différent) | Rupture d'expérience utilisateur, pas de modal intégrée | `utilisateurs/page.tsx:448-454` |
| UX-04 | **MOYENNE** | Le formulaire d'édition est une modale qui mélange 3 sections différentes (infos de base, droits supplémentaires, permissions personnalisées) sans onglets | Surcharge cognitive, confusion entre « droits supplémentaires » et « permissions personnalisées » | `utilisateurs/page.tsx:600-913` |
| UX-05 | **MOYENNE** | Aucune indication visuelle que les modifications de rôle/permissions n'affectent pas la session en cours de l'utilisateur cible | L'admin croit que les changements sont immédiats | `utilisateurs/page.tsx` |
| UX-06 | **MOYENNE** | Les utilisateurs désactivés sont en liste avec les actifs, sans distinction de fond ou d'opacité | Difficulté à distinguer visuellement | `utilisateurs/page.tsx:529-537` |
| UX-07 | **MOYENNE** | La section « Droits supplémentaires » apparaît même pour SUPER_ADMIN — mais ne propose SUPER_ADMIN que si `editForm.role !== 'SUPER_ADMIN'` | Affichage incohérent : SUPER_ADMIN n'a pas besoin de droits supplémentaires | `utilisateurs/page.tsx:708-757` |
| UX-08 | **MINEURE** | Le login est affiché en petit sous le nom, sans le copier facilement | UX limitée pour l'identification | `utilisateurs/page.tsx:513` |
| UX-09 | **MINEURE** | Pas d'avatar par défaut différencié | Tous les avatars affichent la première lettre du nom sans distinction visuelle | `utilisateurs/page.tsx:508-510` |
| UX-10 | **MINEURE** | Le header affiche « Créer et gérer les utilisateurs du système » mais la page gère aussi la désactivation | Le wording ne couvre pas toutes les actions | `utilisateurs/page.tsx:301-302` |
| UX-11 | **MINEURE** | L'aperçu impression montre les utilisateurs inactifs avec le statut « SUSPENDU » ou « INACTIF » | Terminologie inconsistante (SUSPENDU vs INACTIF selon le contexte) | `utilisateurs/page.tsx:334, 420` |

---

## 8. Risques de données / sécurité / permissions

| ID | Gravité | Risque | Détail |
|----|---------|-------|--------|
| SEC-01 | **CRITIQUE** | Escalade de privilèges via droits supplémentaires | Un ADMIN peut attribuer les permissions SUPER_ADMIN via la checkbox « Droits supplémentaires → Super Administrateur ». Le PATCH API ne vérifie pas les permissions résultantes. |
| SEC-02 | **CRITIQUE** | Pas d'invalidation de session sur désactivation/réduction de rôle | Un utilisateur désactivé ou rétrogradé conserve sa session JWT (7 jours). Aucun mécanisme de révocation. |
| SEC-03 | **IMPORTANTE** | Pas de protection CSRF sur PATCH/DELETE | Les routes API n'ont pas de protection CSRF native. Next.js cookies httpOnly + sameSite=lax offrent une protection partielle. |
| SEC-04 | **IMPORTANTE** | Absence de vérification de permission granulaire côté API | Les routes `/api/utilisateurs` utilisent `requireRole(ROLES_ADMIN)` au lieu de `requirePermission('users:view')` / `requirePermission('users:edit')`. Un ADMIN avec permissions personnalisées retirant `users:view` pourrait quand même accéder à l'API. |
| SEC-05 | **IMPORTANTE** | `security.ts` totalement bypassé | Aucune vérification de licence ou d'activation matérielle — le logiciel est utilisable sans restriction. |
| SEC-06 | **IMPORTANTE** | Pas de validation du format login côté PATCH | Le schéma Zod du PATCH n'inclut pas le champ `login`, mais si quelqu'un l'ajoute dans le body, Prisma pourrait l'accepter via `updateData` (non, car `parsed.data` ne contient que les champs du schema). Ce risque est mineur en pratique. |
| SEC-07 | **MOYENNE** | Rate limiting uniquement côté login | Pas de rate limiting sur les routes utilisateurs (PATCH, DELETE, register), permettant du brute-force sur la création ou modification. |
| SEC-08 | **MOYENNE** | Fuite d'information multi-entité | L'API GET retourne tous les utilisateurs sans filtrage par entité — un ADMIN d'une succursale voit les utilisateurs de la maison mère et des autres succursales. |
| SEC-09 | **MOYENNE** | Mot de passe transmis en clair vers le serveur | Le formulaire envoie le mot de passe en clair (HTTPS requis en production). Pas de hash côté client. |
| SEC-10 | **MINEURE** | Pas d'historique des changements de mot de passe | Le log d'audit note `motDePasseModifie: true` mais n'enregistre pas l'ancien hash (ce qui est correct), ni la date de dernier changement dans le modèle. |
| SEC-11 | **MINEURE** | L'audit log des modifications ne conserve que `nom` et `role` dans `anciennesValeurs` | Les changements d'email, d'entité, d'état actif/inactif ou de permissions ne sont pas tracés dans les anciennes valeurs | `utilisateurs/[id]/route.ts:151-154` |

---

## 9. Propositions de correction

### CRITIQUE

| ID | Correction | Détails techniques |
|----|-----------|-------------------|
| SEC-01 + LOG-01 | Interdire l'attribution de SUPER_ADMIN en droits supplémentaires | Côté UI : n'afficher la checkbox SUPER_ADMIN que si `session.role === 'SUPER_ADMIN'`. Côté API : Ajouter une vérification dans le PATCH que si les permissions résultantes contiennent des permissions SUPER_ADMIN exclusives et que l'opérateur n'est pas SUPER_ADMIN, refuser. |
| SEC-02 | Implémenter l'invalidation de session | Option A : Ajouter un champ `tokenVersion` dans Utilisateur, l'incrémenter sur désactivation/changement de rôle, et le vérifier dans `verifyToken`. Option B : Maintenir une liste noire de tokens en DB/Redis. |
| LOG-02 | Ajouter une vérification : un ADMIN ne peut pas modifier son propre rôle au-dessus de son niveau | Dans le PATCH, vérifier `session.userId === id` et, si le rôle est modifié en SUPER_ADMIN, exiger `session.role === 'SUPER_ADMIN'`. Ajouter une vérification que les permissions résultantes ne dépassent pas celles de l'opérateur. |

### IMPORTANTE

| ID | Correction |
|----|-----------|
| LOG-03 + LOG-04 | Stocker les « rôles supplémentaires » dans un champ séparé `rolesSupplementaires` (JSON) plutôt que de les fusionner dans `permissionsPersonnalisees`. Lors de l'édition, lors du calcul des permissions effectives, fusionner rôle principal + rôles supplémentaires. Cela permet de préserver l'intention et de modifier les rôles supplémentaires ultérieurement. |
| LOG-05 | Cf. SEC-02 — invalidation de session |
| LOG-06 | Implémenter de vraies vérifications de licence et d'activation matérielle dans `security.ts` |
| LOG-07 | Ajouter un filtrage par `entiteId` basé sur la session de l'opérateur (sauf SUPER_ADMIN qui voit tout) |
| LOG-12 | Remplacer `requireRole(session, [...ROLES_ADMIN])` par `requirePermission(session, 'users:view')` pour GET, `requirePermission(session, 'users:edit')` pour PATCH, `requirePermission(session, 'users:delete')` pour DELETE |
| UX-01 | Ajouter un bouton « Réactiver » pour les utilisateurs inactifs (PATCH avec `actif: true`) |
| UX-02 | Ajouter recherche, filtres (rôle, entité, statut) et tri au tableau |
| UX-03 | Créer une modale de création intégrée ou adapter la page register en modale dans le dashboard |

### MOYENNE

| ID | Correction |
|----|-----------|
| LOG-08 | Ajouter une vérification serveur dans la page `/register` (via Next.js middleware ou layout serveur) |
| LOG-09 | Utiliser `findUnique` pour la vérification d'email au lieu de `findFirst` |
| LOG-10 | Ajouter la validation regex du login dans le PATCH schema |
| LOG-11 | Ajouter les champs `lastLoginAt` et `loginCount` au modèle Utilisateur |
| LOG-13 | Remplacer l'icône `Trash2` par une icône `UserX` ou `Ban` pour la désactivation |
| LOG-14 | Synchroniser le schéma PostgreSQL avec le schéma SQLite |
| UX-04 | Séparer le formulaire d'édition en onglets : « Infos générales », « Rôles & Permissions », « Sécurité » |
| UX-05 | Afficher un avertissement : « Les changements prendront effet à la prochaine connexion de l'utilisateur » |
| UX-06 | Griser/l'opacité réduite pour les lignes d'utilisateurs inactifs |
| SEC-04 | Cf. LOG-12 |
| SEC-07 | Ajouter un rate limiting sur les routes sensibles (création, modification) |

### MINEURE

| ID | Correction |
|----|-----------|
| LOG-15 | Supprimer l'un des deux mécanismes de notification succès (bannière OU toast, pas les deux) |
| LOG-16 | Appliquer une classe `opacity-50` ou `line-through` sur les lignes inactives |
| LOG-17 | Ajouter un filtre actif/inactif avant impression |
| LOG-18 | Afficher la date de dernière modification (`updatedAt`) dans le tableau |
| UX-08 | Ajouter un bouton copier à côté du login |
| UX-09 | Générer un avatar avec couleur basée sur le rôle |
| UX-10 | Mettre à jour le wording : « Créer, gérer et administrer les utilisateurs du système » |
| UX-11 | Harmoniser la terminologie (INACTIF partout) |
| SEC-11 | Étendre `anciennesValeurs` pour inclure email, entiteId, actif, permissions |

---

## 10. Priorité des corrections

### Critique (bloquant ou risque sécurité majeur)

1. **SEC-01 + LOG-01** — Blocage de l'escalade SUPER_ADMIN via droits supplémentaires
2. **SEC-02 + LOG-05** — Invalidation de session sur désactivation/changement de rôle
3. **LOG-02** — Empêcher un ADMIN de s'auto-promouvoir au-delà de son niveau

### Important (dysfonctionnement ou risque significatif)

4. **LOG-03 + LOG-04** — Refonte du stockage des rôles supplémentaires
5. **LOG-07** — Filtrage des utilisateurs par entité
6. **LOG-12 + SEC-04** — Utiliser `requirePermission` au lieu de `requireRole`
7. **UX-01** — Ajouter la réactivation d'utilisateurs
8. **UX-02** — Ajouter recherche, filtres, tri
9. **LOG-06** — Implémenter `security.ts` correctement

### Moyen (amélioration qualité)

10. **LOG-08** — Protection serveur de la page register
11. **LOG-09** — Utiliser `findUnique` pour email
12. **LOG-13** — Changer l'icône de désactivation
13. **UX-03** — Intégrer la création dans le dashboard
14. **UX-04** — Onglets dans le formulaire d'édition
15. **SEC-07** — Rate limiting sur les routes utilisateurs
16. **LOG-11** — Ajouter `lastLoginAt` au modèle

### Confort (polish UX)

17. **LOG-15** — Supprimer le doublon de notification
18. **LOG-16** — Style des lignes inactives
19. **LOG-17** — Filtre actif/inactif pour l'impression
20. **LOG-18** — Afficher `updatedAt`
21. **UX-08** — Bouton copier le login
22. **UX-09** — Avatars différenciés
23. **UX-11** — Harmonisation terminologie
24. **SEC-11** — Audit log enrichi

---

## 11. Qualité technique — Dette technique

| Aspect | Évaluation |
|--------|-----------|
| Typage TypeScript | **Moyen** — Le type `Utilisateur` côté client ne correspond pas au modèle Prisma (champs manquants, types non synchronisés). L'usage de `as any` dans le PATCH (`updateData: any`) est un anti-pattern. |
| Gestion des erreurs | **Correct** — Les erreurs API sont capturées et affichées. Le formatApiError est utilisé. Cependant, les erreurs réseau côté client sont journalisées en console mais pas systématiquement communiquées. |
| Validation des entrées | **Insuffisant côté PATCH** — Le schéma Zod est `.partial()`, ce qui permet des champs vides. Le regex de login n'est pas validé dans le PATCH. |
| Logs | **Partiel** — Seul `console.error` est utilisé côté serveur. Pas de logging structuré. L'audit log est bon mais ne capture pas toutes les anciennes valeurs. |
| Robustesse | **Fragile** — Pas de transaction Prisma dans le PATCH (risque de mise à jour partielle). Pas de gestion d'erreur spécifique pour les violations de contrainte unique autre que login/email. |
| Sécurité | **Insuffisant** — Escalade de privilèges possible, pas d'invalidation de session, bypass de sécurité total dans security.ts. |

## 12. Qualité produit — Ce qui manque pour la production

| Pour quel rôle | Ce qui manque |
|----------------|-------------|
| **Admin** | Réactivation des comptes, filtres/recherche, tri, historique des modifications, vue des permissions effectives |
| **Comptable** | Pas concerné (accès refusé par rôle ADMIN uniquement) |
| **DG** | Tableau de bord des utilisateurs (nombre actifs/inactifs, répartition par rôle, derniers logins) |
| **Production** | Invalidations de session, protection CSRF, rate limiting sur toutes les routes sensibles, politique de mots de passe, middleware de protection |
| **Business** | Traçabilité complète des changements de rôle/permissions, alertes sur escalade de privilèges |

---

## 13. Plan Sprint 1 (7 jours)

### Jour 1 — Sécurité critique

- [objectif] Corriger SEC-01/LOG-01 : Bloquer l'attribution de SUPER_ADMIN en droits supplémentaires
  - Fichier : `utilisateurs/page.tsx` (conditionner la checkbox SUPER_ADMIN au rôle de la session)
  - Fichier : `utilisateurs/[id]/route.ts` (validation côté serveur des permissions résultantes)
- [objectif] Corriger LOG-02 : Vérification anti-auto-promotion
  - Fichier : `utilisateurs/[id]/route.ts`

### Jour 2 — Invalidation de session

- [objectif] Implémenter SEC-02/LOG-05 : Invalidation de session
  - Fichier : `prisma/schema.prisma` (ajouter `tokenVersion Int @default(0)`)
  - Fichier : `lib/auth.ts` (vérifier tokenVersion dans verifyToken)
  - Fichier : `utilisateurs/[id]/route.ts` (incrémenter tokenVersion sur désactivation/changement de rôle)
  - Fichier : `app/api/auth/login/route.ts` (inclure tokenVersion dans le JWT)

### Jour 3 — Permissions granulaires + réactivation

- [objectif] Corriger LOG-12/SEC-04 : Remplacer `requireRole` par `requirePermission` dans les routes utilisateurs
  - Fichiers : `utilisateurs/route.ts`, `utilisateurs/[id]/route.ts`
- [objectif] Ajouter la réactivation d'utilisateurs (UX-01)
  - Fichier : `utilisateurs/page.tsx` (bouton Activer)
  - Fichier : `utilisateurs/[id]/route.ts` (PATCH pour réactivation)

### Jour 4 — Refonte des droits supplémentaires

- [objectif] Corriger LOG-03/LOG-04 : Ajouter un champ `rolesSupplementaires` au modèle et à l'UI
  - Fichier : `prisma/schema.prisma`
  - Fichier : `utilisateurs/page.tsx`
  - Fichier : `utilisateurs/[id]/route.ts`
  - Fichier : `lib/roles-permissions.ts` (fonction de résolution des permissions effectives)

### Jour 5 — Filtrage par entité + recherche/filtre UI

- [objectif] Corriger LOG-07 : Filtrage par entité dans l'API GET
  - Fichier : `utilisateurs/route.ts`
- [objectif] Implémenter UX-02 : Recherche et filtres côté UI
  - Fichier : `utilisateurs/page.tsx`

### Jour 6 — Polish UX + sécurité

- [objectif] UX-06 : Style des lignes inactives (opacité réduite)
- [objectif] LOG-13 : Icône UserX au lieu de Trash2
- [objectif] UX-05 : Avertissement session non invalidée
- [objectif] LOG-09 : findUnique pour email
- [objectif] LOG-10 : Validation regex login côté serveur PATCH
- [objectif] SEC-11 : Enrichir les anciennes valeurs dans l'audit log

### Jour 7 — Sécurité renforcée + `security.ts`

- [objectif] LOG-08 : Protection serveur de la page `/register`
- [objectif] SEC-07 : Rate limiting sur création et modification d'utilisateurs
- [objectif] LOG-06 : Implémentation réelle de `security.ts` (ou suppression du bypass si la licence n'est pas requise)
- [objectif] LOG-11 : Ajouter `lastLoginAt` et `loginCount` au modèle Utilisateur + migration
- [objectif] Tests manuels de régression sur le parcours complet

---

## Top 15 actions immédiates

1. **Bloquer l'escalade SUPER_ADMIN via droits supplémentaires** (LOG-01/SEC-01)
2. **Empêcher l'auto-promotion ADMIN → SUPER_ADMIN** (LOG-02)
3. **Implémenter l'invalidation de session** (SEC-02/LOG-05)
4. **Ajouter la réactivation d'utilisateurs** (UX-01)
5. **Remplacer `requireRole` par `requirePermission` sur les routes utilisateurs** (LOG-12/SEC-04)
6. **Filtrer les utilisateurs par entité dans l'API GET** (LOG-07)
7. **Ajouter recherche/filtres/tri dans le tableau utilisateurs** (UX-02)
8. **Refonder le stockage des rôles supplémentaires** (LOG-03/LOG-04)
9. **Protéger la route `/register` côté serveur** (LOG-08)
10. **Ajouter validation regex login côté PATCH** (LOG-10)
11. **Corriger l'icône de désactivation** (LOG-13)
12. **Ajouter `lastLoginAt` au modèle Utilisateur** (LOG-11)
13. **Griser les lignes d'utilisateurs inactifs** (UX-06/LOG-16)
14. **Enrichir l'audit log des modifications utilisateur** (SEC-11)
15. **Synchroniser le schéma PostgreSQL avec le schéma SQLite** (LOG-14)
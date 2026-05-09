# Audit - Dashboard ERP GestiCom Pro

## 1. Périmètre audité

- **Module** : Dashboard ERP (page principale)
- **Fichiers analysés** : 12 fichiers principaux + schéma de données
- **Date de l'audit** : 2026-05-09

---

## 2. Fichiers analysés

### Fichiers Core
| Fichier | Description |
|---------|-------------|
| `app/(dashboard)/dashboard/page.tsx` | Page principale du dashboard |
| `app/api/dashboard/route.ts` | API principale - calculs KPIs |
| `app/api/dashboard/bilan-journalier/route.ts` | API bilan journalier |
| `app/api/dashboard/preferences/route.ts` | API préférences utilisateur |
| `app/api/predictions/rupture/route.ts` | API prédictions rupture stock |
| `components/dashboard/KpiCard.tsx` | Composant carte KPI |
| `components/dashboard/RecentActivity.tsx` | Composant activité récente |
| `components/dashboard/SuggestionsAchat.tsx` | Composant suggestions IA |
| `lib/get-entite-id.ts` | Gestion entités par utilisateur |
| `prisma/schema.prisma` | Schéma de données SQLite |

---

## 3. Fonctionnement réel détecté

### Architecture générale
Le dashboard est composé de :
1. **API principale** (`/api/dashboard`) - Agrège 16 requêtes en parallèle avec timeout de 20s
2. **UI React** - Utilise SWR pour le caching et revalidation
3. **Widget IA** - Appels séparés pour prédictions de rupture

### Métriques calculées

| Métrique | Source | Méthode |
|----------|--------|---------|
| CA Jour/Hier | Vente | Aggregation par date |
| Transactions | Vente | Count par date |
| Clients actifs | Client | Count WHERE actif=true |
| Produits catalogue | Produit | Count WHERE actif=true |
| Stock faible | Stock + Produit | Requête RAW SQL |
| Top 5 CA | VenteLigne | GroupBy produitId |
| Valeur stock | Stock + Produit | RAW SQL (PAMP/prixVente) |
| Trésorerie | EcritureComptable + Caisse + Banque | Agrégats multiples |
| Dettes fournisseurs | Achat | Sum(montantTotal + fraisApproche - montantPaye) |
| Créances clients | Vente | Sum(montantTotal - montantPaye) |
| Tendances mensuelles | Vente | RAW SQL - 24 mois glissants |
| Alertes système | SystemAlerte | Filtre lu=false |
| Alertes crédit | Client + Vente | Calcul ratio vs plafondCredit |

---

## 4. Fonction attendue du sous-menu

Le dashboard ERP doit fournir une **vue décisionnelle temps réel** avec :
- KPIs financiers (CA jour/mois, panier moyen, valeur stock)
- KPIs opérationnels (transactions, produits, clients, mouvements)
- Alertes (stock faible, crédit client, système)
- Visualisations (top produits, répartition catégories, tendances)
- Actions rapides (nouvelle vente, achat, produit)
- Prédictions IA (rupture de stock imminente)

---

## 5. Écarts et incohérences

### 5.1 Incohérences de données

| # | Problème | Détail |
|---|----------|--------|
| E1 | Incohérence statuts vente | API dashboard accepte `'VALIDE'` et `'VALIDEE'` mais predictions/rupture n'utilise que `'VALIDEE'` |
| E2 | Calcul créances incorrect | `creancesAgg` utilise filtre sans exclure les ventes annulées - intègre potentiellement des écritures non valides |
| E3 | Trésorerie Caisse incomplète | Filtre par `createdAt` au lieu de `dateOperation` - si un mouvement de昨天的 Caisse est créé aujourd'hui, il ne sera pas comptabilisé |
| E4 | Top produits sans période | La requête top produits n'a pas de filtre de date - retourne les tops sur TODOUTE la vie |

### 5.2 Incohérences UI/UX

| # | Problème | Détail |
|---|----------|--------|
| E5 | TypeScript any[] | `creditAlerts` et `systemAlertes` typés `any[]` - pas de typage fort |
| E6 | Affichage ID vente | `RecentActivity` affiche `item.id` (number) au lieu du numéro formaté |
| E7 | Gestion timeout incohérente | Le message d'erreur utilise "Fermez le portable" - pas approprié pour desktop |
| E8 | Loading state attendu | Page attend `mounted` avant d'afficher - cause flash si hydration différé |

---

## 6. Anomalies détectées

### 6.1 Erreurs de calcul

| ID | Gravité | Description | Impact | Cause probable |
|----|---------|-------------|--------|----------------|
| CALC-01 | **CRITIQUE** | Dettes fournisseurs = (montantTotal + fraisApproche) - montantPaye | Les achats annulés (statut=ANNULE) sont inclus dans le calcul | Filtre `statut: { not: 'ANNULE' }` manquante ligne 153-156 |
| CALC-02 | **CRITIQUE** | Créances clients = montantTotal - montantPaye | Les ventes avec statut 'ANNULE' ou 'BROUILLE' sont potentiellement incluses | Filtre statut insuffisant ligne 159-162 |
| CALC-03 | **IMPORTANT** | Taux rupture = nbRuptures / totalProduitsCatalogue | Divise par TOUS les produits actifs et pas seulement ceux en stock | Erreur de formule ligne 256 |
| CALC-04 | **MOYEN** | Monthly trends année N-1 | Utilise `year - 1` mais pour les mois futuros (ex: mai 2026), mai 2025 n'existe pas dans les données si la requête limite à 24 mois | Logique de fenêtre glissante ligne 317-332 |
| CALC-05 | **MOYEN** | Trésorerie globale = debit - credit | Logique OHADA probablement inversée - les comptes 5xx utilisent généralement credit - debit | Incompréhension du plan comptable |

### 6.2 Erreurs de logique logicielle

| ID | Gravité | Description | Impact | Fichier |
|----|---------|-------------|--------|---------|
| LOG-01 | **CRITIQUE** | Timeout sans cleanup | Les queries continuent en background après timeout - surcharge serveur | `app/api/dashboard/route.ts:211-214` |
| LOG-02 | **IMPORTANT** | Credit alerts utilisent 'VALIDEE' | Incohérent avec autres requêtes qui acceptent 'VALIDE' et 'VALIDEE' | `app/api/dashboard/route.ts:380` |
| LOG-03 | **IMPORTANT** | Predictions sans entiteId | L'API prédictions n'utilise pas `getEntiteId` - pas de filtrage par entité | `app/api/predictions/rupture/route.ts` |
| LOG-04 | **MOYEN** | Détail trésorerie useless | La boucle `detailTresorerRaw` ne fait rien (lignes 263-269) | `app/api/dashboard/route.ts:263-269` |
| LOG-05 | **MOYEN** | Marquer-lues API mismatch | App POST avec body mais DashboardLayoutClient utilise PATCH sans body | `page.tsx:192` vs `DashboardLayoutClient.tsx:385` |

### 6.3 Anomalies UI/UX

| ID | Gravité | Description | Impact | Fichier |
|----|---------|-------------|--------|---------|
| UX-01 | **MOYEN** | Affichage ID brut | Affiche ID numérique au lieu de numéro de vente formaté | `RecentActivity.tsx:92` |
| UX-02 | **MOYEN** | Loading spinner seul | Le loading state n'inclut pas le skeleton des données précédentes | `page.tsx:129-135` |
| UX-03 | **MINEUR** | Message timeout bizarre | "Fermez le portable puis rechargez" ne correspond pas au contexte | `page.tsx:86` |
| UX-04 | **MINEUR** | Typage any[] | Absence de types forts pour les données d'alerte | `page.tsx:58-59` |

### 6.4 Risques de données / sécurité / permissions

| ID | Gravité | Description | Impact |
|----|---------|-------------|--------|
| SEC-01 | **CRITIQUE** | Pas de permissioncheck dashboard | Tout utilisateur connecté peut voir TOUTES les données - pas de filtrage par rôle |
| SEC-02 | **IMPORTANT** | Pas de rate limiting | Le endpoint peut être appelé en boucle par un attaquant ou un client mal configuré |
| SEC-03 | **IMPORTANT** | EntiteId=0 non géré | Si `getEntiteId` retourne 0, les requêtes peuvent retourner des données de TOUTES les entités |
| PERF-01 | **IMPORTANT** | Pas d'index sur vente.statut | Les agrégations sont lentes sur grandes bases |
| PERF-02 | **IMPORTANT** | Pas d'index sur vente.date | Les requêtes par période sont lentes |
| PERF-03 | **MOYEN** | Top produits illimité | GroupBy sur toutes les ventes historiques |

---

## 7. Propositions de correction

### Correction CALC-01 : Dettes fournisseurs
```typescript
// Dans app/api/dashboard/route.ts ligne 153
prisma.achat.aggregate({
  where: {
    statut: { not: 'ANNULE' },  // <-- AJOUTER CE FILTRE
    ...entiteCondition as any
  },
  // ...
})
```

### Correction CALC-02 : Créances clients
```typescript
// Dans app/api/dashboard/route.ts ligne 159
prisma.vente.aggregate({
  where: {
    statut: { in: ['VALIDE', 'VALIDEE'] },  // <-- S'assurer que tous les statuts non valides sont exclus
    ...entiteCondition as any
  },
  // ...
})
```

### Correction LOG-01 : Timeout avec cleanup
```typescript
// Remplacer Promise.race par un contrôle explicite
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), DASHBOARD_TIMEOUT_MS)

try {
  const result = await Promise.all(queries.map(q => q.catch(e => {
    console.error('Query failed:', e)
    return null
  })))
  clearTimeout(timeoutId)
  // ...
} catch (timeout) {
  // Cleanup: annuler les queries en cours si possible
  console.warn('Dashboard timeout - aborting queries')
  // Retourner données partielles avec indicateur
}
```

### Correction LOG-03 : Predictions avec entiteId
```typescript
// Dans app/api/predictions/rupture/route.ts
const entiteId = await getEntiteId(session)
const entiteCondition = entiteId ? { entiteId } : {}

// Ajouter dans le groupBy
where: {
  vente: {
    date: { gte: thirtyDaysAgo },
    statut: 'VALIDEE',
    ...entiteCondition
  },
}
```

### Correction E5 : Typage CreditAlerts
```typescript
// Ajouter un type dans page.tsx
type CreditAlert = {
  id: string
  type: 'CRITICAL' | 'WARNING'
  categorie: 'CREDIT'
  message: string
  date: string
}

type DashboardData = {
  // ...
  creditAlerts?: CreditAlert[]
  systemAlertes?: SystemAlerte[]
}
```

### Correction SEC-01 : Permission dashboard
```typescript
// Dans app/api/dashboard/route.ts
const session = await getSession()
if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

// Ajouter vérification permission
const user = await prisma.utilisateur.findUnique({
  where: { id: session.userId },
  select: { permissionsPersonnalisees: true }
})
const perms = user?.permissionsPersonnalisees ? JSON.parse(user.permissionsPersonnalisees) : []
if (!perms.includes('dashboard:read') && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
  return NextResponse.json({ error: 'Permission insuffisante' }, { status: 403 })
}
```

---

## 8. Priorité des corrections

| Priorité | ID | Correction | Complexité | Temps estimé |
|----------|----|------------|-------------|--------------|
| **P1 - Critique** | CALC-01 | Exclure achats annulés du calcul des dettes | Faible | 30 min |
| **P1 - Critique** | CALC-02 | Exclure ventes non valides des créances | Faible | 30 min |
| **P1 - Critique** | LOG-01 | Timeout avec cleanup | Moyenne | 1h |
| **P1 - Critique** | SEC-01 | Permission dashboard | Moyenne | 2h |
| **P2 - Important** | LOG-03 | Ajouter entiteId aux predictions | Faible | 30 min |
| **P2 - Important** | SEC-02 | Rate limiting API | Moyenne | 1h |
| **P2 - Important** | LOG-02 | Uniformiser statuts ('VALIDEE' only) | Faible | 30 min |
| **P3 - Moyen** | UX-01 | Afficher numéro vente formaté | Faible | 15 min |
| **P3 - Moyen** | CALC-03 | Corriger calcul taux rupture | Faible | 15 min |
| **P4 - Confort** | UX-04 | Typage fort creditAlerts | Moyenne | 1h |

---

## 9. Questions ou zones incertaines

1. **Trésorerie OHADA** : La formule `debit - credit` est-elle correcte selon le plan OHADA ? Les classes 5xx fonctionnent-elles comme décrit ?

2. **Statut 'VALIDE' vs 'VALIDEE'** : Le système utilise-t-il les deux statuts interchangeably ou y a-t-il une différence fonctionnelle ?

3. **Panier moyen** : Le calcul actuel utilise le total historique. Faut-il le limiter à une période (mois en cours) ?

4. **Comptes trésorerie** : Quels sont les numéros de compte utilisés pour Caisse (57 ?) et Banque (51/52 ?) pour le détail ?

---

## 10. Conclusion opérationnelle

### Score de fiabilité : **6.5/10**

Le dashboard fonctionne mais présente plusieurs **risques critiques** :
- Calculs financiers incorrects (dettes, créances)
- Problèmes de performance (timeout sans cleanup, pas d'index)
- Risques de sécurité (pas de permission, pas de filtrage entité)

### Top 15 actions immédiates

| # | Action | Priorité |
|---|--------|----------|
| 1 | Corriger filtre statut ANNULE pour calculs dettes | P1 |
| 2 | Corriger filtre statut pour calculs créances | P1 |
| 3 | Implémenter cleanup des queries après timeout | P1 |
| 4 | Ajouter permission 'dashboard:read' | P1 |
| 5 | Ajouter getEntiteId dans predictions API | P2 |
| 6 | Ajouter rate limiting (ex: 60 req/min) | P2 |
| 7 | Uniformiser tous les statuts à 'VALIDEE' | P2 |
| 8 | Ajouter index sur vente(statut) et vente(date) | P2 |
| 9 | Corriger affichage ID -> numéro vente | P3 |
| 10 | Corriger formule taux rupture | P3 |
| 11 | Ajouter validation entiteId=0 | P2 |
| 12 | Typage fort pour les alertes | P4 |
| 13 | Corriger message timeout | P4 |
| 14 | Améliorer loading state avec skeleton | P4 |
| 15 | Ajouter filtrage date pour Top produits | P3 |

---

*Audit realizado le 2026-05-09 - Prochaine étape : Validation des corrections avant implémentation*
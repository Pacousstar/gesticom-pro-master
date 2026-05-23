# AUDIT - Menu ANALYTIQUE & RAPPORTS - Sous-menu Rapports généraux

---

## 1. Fichiers concernés

### Page principale
- `app/(dashboard)/dashboard/rapports/page.tsx` (1058 lignes) - Page principale des rapports

### APIs utilisées
- `app/api/rapports/route.ts` - API principale des rapports
- `app/api/rapports/ventes/clients/route.ts` - CA par client
- `app/api/rapports/ventes/etat-paiement/route.ts` - État paiement ventes
- `app/api/rapports/achats/fournisseurs/route.ts` - État paiement achats
- `app/api/rapports/ventes/factures/route.ts` - Factures ventes
- `app/api/rapports/stocks/valeur/route.ts` - Valorisation stock
- `app/api/rapports/stocks/mouvements/route.ts` - Mouvements stock
- `app/api/rapports/ventes/clients/produits/route.ts` - Produits par client
- `app/api/rapports/achats/fournisseurs/produits/route.ts` - Produits par fournisseur
- `app/api/rapports/export/route.ts` - Export Excel

### Navigation
- `app/(dashboard)/DashboardLayoutClient.tsx` (ligne 97) - Point d'accès menu

---

## 2. Fonctionnement réel

La page "Rapports Généraux" présente un tableau de bord analytique structuré en 3 onglets :

### Onglet 1 : Stocks & Logistique
- **Valeur d'inventaire globale** - Somme des stocks valorisés au PAMP/prix d'achat
- **Alertes de rupture** - Produits dont la quantité < seuil minimum
- **Top produits** - Produits à forte rotation (quantité vendues)
- **Valorisation détaillée** - Tableau paginé des produits avec valeur unitaire et totale
- **Mouvements de stock** - Historique des entrées/sorties avec pagination

### Onglet 2 : Intelligence Clients
- **Palmarès achats clients** - Liste des clients triés par CA décroissant
- **Composition du panier** - Détail des produits achetés par client sélectionné

### Onglet 3 : Recouvrement & Finances
- **État paiement créances clients** - Montant total, payé, reste à payer par client
- **État paiement dettes fournisseurs** - Montant total, payé, reste à payer par fournisseur
- **Composition du panier fournisseur** - Détail des achats par fournisseur sélectionné

### Filtres disponibles
- Date de début / Date de fin (période)
- Point de vente (magasin)
- Recherche globale (filtre local sur les tableaux)

### Métriques affichées
- Chiffre d'Affaires facturé (période actuelle vs précédente)
- Trésorerie encaissée
- Performance de encaissement (%)

---

## 3. Fonction attendue

Le sous-menu "Rapports généraux" devrait fournir une vue consolidée des :
1. **Performances commerciales** - CA, évolution, tendances
2. **État des stocks** - Valorisation, alertes, mouvements
3. **Situation financière** - Créances clients, dettes fournisseurs
4. **Comportement clients** - Analyse des achats par client

Les données devraient être :
- Filtrables par période et point de vente
- Comparables entre périodes
- Exportables

---

## 4. Écarts et incohérences

### Écart 1 : Paramètres API incohérents
| Appel dans page | Paramètres utilisés | API attendue | Paramètres attendus |
|-----------------|-------------------|-------------|-------------------|
| `/api/rapports/ventes/clients` | `start`, `end` | `route.ts` | `dateDebut`, `dateFin` |
| `/api/rapports/export` | `start`, `end` | `route.ts` | `dateDebut`, `dateFin` |

**Impact** : Ces appels échoueront silencieusement ou retourneront des données incorrectes (sans filtrage de période).

### Écart 2 : Vérifications de permissions incohérentes
| API | Permission requise | Cohérent avec le menu ? |
|-----|-------------------|------------------------|
| `/api/rapports/route.ts` | **AUCUNE** | Non |
| `/api/rapports/ventes/clients/route.ts` | `ventes:view` | Partiel |
| `/api/rapports/ventes/etat-paiement/route.ts` | `rapports:view` | Oui |
| `/api/rapports/achats/fournisseurs/route.ts` | **AUCUNE** | Non |
| `/api/rapports/stocks/valeur/route.ts` | `stocks:view` | Non |
| `/api/rapports/export/route.ts` | **AUCUNE** | Non |

**Impact** : Contrôle d'accès incohérent, risques de sécurité.

### Écart 3 : Filtres de statut incohérents
| API | Filtre de statut | Probleme |
|-----|-----------------|----------|
| `/api/rapports/route.ts` | `{ in: ['VALIDE', 'VALIDEE'] }` | OK |
| `/api/rapports/ventes/etat-paiement/route.ts` | `'VALIDEE'` uniquement | Exclut `VALIDE` |
| `/api/rapports/ventes/factures/route.ts` | `'VALIDEE'` uniquement | Exclut `VALIDE` |
| `/api/rapports/ventes/clients/produits/route.ts` | `'VALIDEE'` uniquement | Exclut `VALIDE` |
| `/api/rapports/achats/fournisseurs/produits/route.ts` | `'VALIDEE'` uniquement | Exclut `VALIDE` |
| `/api/rapports/rentabilite/route.ts` | `'VALIDEE'` uniquement | Exclut `VALIDE` |
| `/api/rapports/export/route.ts` | `'VALIDEE'` uniquement | Exclut `VALIDE` |

**Impact** : Données incomplètes dans certains rapports (ventes/achats en statut VALIDE non comptabilisés).

---

## 5. Erreurs de calcul détectées

### Erreur 1 : Performance de encaissement par défaut
**Fichier** : `page.tsx`, ligne 472
```typescript
{comparaison.periodeActuelle.ca > 0 ? ((...) * 100).toFixed(1) : '100'}
```
**Problème** : Affiche 100% si CA = 0, ce qui est trompeur.
**Impact UI** : Fausse impression de bonne performance.

### Erreur 2 : Division par zéro potentielle
**Fichier** : `page.tsx`, ligne 464
```typescript
evol={comparaison.periodePrecedente.caEncaisse > 0 ? ((...) / ...) * 100 : 0}
```
**Problème** : La période précédente peut avoir 0 encaissement.
**Mitigation** : Présence d'une protection (ternaire).

---

## 6. Erreurs de logique logicielle détectées

### Erreur 1 : Valeur d'inventaire à une date
**Fichier** : `/api/rapports/stocks/valeur/route.ts`, lignes 52-73

La logique de calcul de la valorisation à une date donnée :
1. Récupère le stock actuel
2. Pour les mouvements postérieurs à la date, les retranche (entrées) ou ajoute (sorties)

**Problème** : Cette logique est incorrecte. Si on veut la valeur à une date passée, il faut :
- Soit utiliser les mouvements jusqu'à cette date
- Soit partir du stock actuel et reconstruire à rebours

La logique actuelle suppose que le stock actuel est correct, mais si des mouvements ont été modifiés/annulés après la date, le calcul sera faux.

### Erreur 2 : Période précédente pour comparaison
**Fichier** : `/api/rapports/route.ts`, lignes 165-174

```typescript
const debPrecedent = new Date(deb)
debPrecedent.setDate(debPrecedent.getDate() - dureeJours - 1)
const finPrecedent = new Date(deb)
finPrecedent.setDate(finPrecedent.getDate() - 1)
```

**Problème** : La logique suppose une période consecutive sans jour de chevauchement, mais le -1 peut créer un jour manquant si la période inclut des jours non travaillé. De plus, si l'utilisateur sélectionne une période non-calendaire (ex: 15 derniers jours ouvrés), la période précédente ne sera pas comparable.

### Erreur 3 : Recherche globale non appliquée uniformément
**Fichier** : `page.tsx`

Le `searchTerm` est passé à certains composants mais pas à tous :
- ✓ `LogistiqueAlertes` - filtré
- ✓ `LogistiqueTop` - filtré
- ✓ `PaiementTable` - filtré
- ✗ Tableaux de valorisation et mouvements - partiellement filtré (uniquement dans le render)
- ✗ Palmarès clients - non filtré visuellement mais les données ne sont pas filtrées côté API

---

## 7. Anomalies UI/UX détectées

### Anomalie 1 : Pagination incohérente
- Onglet logistique : Pagination sur valorisations (20 items) et mouvements
- Onglet clients : Pagination client (10 items) mais pas sur les produits
- Onglet finances : Pagination locale (8 items) mais pas sur les données complètes

### Anomalie 2 : Filtre de recherche global
- La recherche fonctionne sur les tableaux affichés mais pas sur les données sous-jacentes
- Si un client n'est pas dans la première page du palmarès, il ne sera pas trouvable par recherche

### Anomalie 3 : Feedback de chargement
- Le loading initial (lignes 334-340) attend que toutes les données soientChargées
- Mais en cas d'erreur partielle sur une API, le chargement peutparaître succès alors que certaines données sont manquantes

---

## 8. Risques de données / sécurité / permissions

### Risque 1 : Absence de vérification de permission sur API principale
**Fichier** : `app/api/rapports/route.ts`
```typescript
// Aucune vérification de permission
const session = await getSession()
if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
```
**Problème** : Seul le login est vérifié, pas les permissions.
**Risque** : Tout utilisateur connecté peut accéder à cette API, même sans permission `rapports:view`.

### Risque 2 : Données partielles à cause du filtre de statut
Les rapports de vente et d'achat excluent potentiellement des transactions en attente de validation (statut VALIDE).

### Risque 3 : Pas de limitation de données pour les exports
L'API export peut retourner potentiellement beaucoup de données sans pagination ni limitation de taille.

---

## 9. Propositions de correction

### Correction 1 : Uniformiser les noms de paramètres API
**Priorité** : HAUTE
- Modifier les appels dans `page.tsx` pour utiliser `dateDebut` et `dateFin` au lieu de `start` et `end`
- Ou modifier les APIs pour accepter les deux variantes

### Correction 2 : Ajouter vérifications de permissions cohérentes
**Priorité** : HAUTE
- Ajouter `requirePermission(session, 'rapports:view')` à toutes les APIs de rapports
- Créer une permission unifiée `rapports:view` pour tout le menu

### Correction 3 : Uniformiser les filtres de statut
**Priorité** : CRITIQUE
- Changer tous les `{ statut: 'VALIDEE' }` en `{ statut: { in: ['VALIDE', 'VALIDEE'] } }`

### Correction 4 : Améliorer la validation des dates
**Priorité** : MOYENNE
- Ajouter une validation que dateDebut <= dateFin
- Afficher un message d'erreur si inversion

### Correction 5 : Améliorer le calcul de valorisation à une date
**Priorité** : MOYENNE
- Utiliser une requête qui agrège les mouvements jusqu'à la date вместо de soustraire du stock actuel

### Correction 6 : Améliorer l'UX de la performance de encaissement
**Priorité** : MINEURE
- Afficher "N/A" ou "--" au lieu de "100%" si CA = 0

---

## 10. Priorité des corrections

| # | Correction | Priorité | Gravité |
|---|------------|----------|---------|
| 1 | Uniformiser filtres de statut | IMMEDIATE | CRITIQUE |
| 2 | Ajouter permissions API principales | IMMEDIATE | IMPORTANTE |
| 3 | Corriger noms paramètres API | HAUTE | MOYENNE |
| 4 | Améliorer calcul valorisation date | MOYENNE | MOYENNE |
| 5 | Validation dates | MOYENNE | MINEURE |
| 6 | UX performance encaissement | CONFORT | MINEURE |

---

## 11. Score de fiabilité

### Calcul du score
- **Fonctionnalité de base** : 70% (TP fonctionnant mais avec bugs)
- **Cohérence des données** : 50% (filtres de statut incohérents)
- **Sécurité/Permissions** : 40% (permissions manquantes ou incohérentes)
- **UX/UI** : 75% (interface correcte, quelques anomalies)
- **Maintenabilité** : 60% (code structuré mais avec duplications)

### Score global : **59% - FIABILITÉ MOYENNE**

---

## Résumé exécutif

Le sous-menu "Rapports généraux" est fonctionnel mais présente des anomalies critiques :

1. **Données incomplètes** : Les filtres de statut incohérents peuvent exclure des transactions légitimes
2. **Sécurité défaillante** : L'API principale n'a pas de vérification de permission
3. **Incohérences techniques** : Paramètres API différents entre appels et APIs

**Actions immédiates requises** :
1. Uniformiser les filtres de statut sur toutes les APIs
2. Ajouter les vérifications de permission manquantes
3. Corriger les noms de paramètres API

---

*Audit réalisé le 09/05/2026*
*Projet : GestiCom Pro*
*Périmètre : Menu ANALYTIQUE & RAPPORTS > Rapports généraux*
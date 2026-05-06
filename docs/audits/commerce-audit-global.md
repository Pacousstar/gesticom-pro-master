# Audit Global Transverse — Module COMMERCE

**Date :** 6 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Périmètre :** Module COMMERCE dans son ensemble (tous sous-menus, API, librairies, schéma, comptabilité)

---

## 1. Périmètre global du menu COMMERCE

Le module COMMERCE couvre :

| Sous-menu | Route | Page principale |
|-----------|-------|----------------|
| Ventes | `/dashboard/ventes` | Création, liste, détail, édition, règlement |
| Toutes les Ventes | `/dashboard/ventes/toute` | Journal analytique, impression, modification |
| Vente Rapide | `/dashboard/ventes/rapide` | Terminal POS industrialisé |
| Achats | `/dashboard/achats` | Création, liste, détail, édition, règlement |
| Tous les Achats | `/dashboard/achats/toute` | Journal analytique, impression, modification |

**Modules liés hors COMMERCE mais impactés :**

| Module | Impact |
|--------|--------|
| Produits | PAMP, prix vente/achat, stock |
| Stock | Mouvements, inventaire, transferts |
| Clients | Crédits, plafonds, règlements |
| Fournisseurs | Dettes, soldes, règlements |
| Caisse | Mouvements espèces |
| Banque | Opérations bancaires |
| Comptabilité | Écritures SYSCOHADA automatiques |

---

## 2. Cartographie des sous-menus et flux

```
COMMERCE
├── Ventes (page.tsx)
│   ├── Création vente → POST /api/ventes
│   │   ├── Calcule TTC/lignes → montantLigneTTC()
│   │   ├── Calcule total → montantTotalVenteDocument()
│   │   ├── Vérifie PVM (prix minimum vente)
│   │   ├── Crée Vente + VenteLigne[]
│   │   ├── Décrémente Stock + Crée Mouvement SORTIE
│   │   ├── Crée ReglementVente[] si paiement
│   │   ├── Crée Caisse (ESPECES) ou OperationBancaire (banque)
│   │   ├── Comptabilise → comptabiliserVente()
│   │   └── Calcule points fidélité
│   ├── Règlement → POST /api/reglements/ventes
│   │   ├── Crée ReglementVente
│   │   ├── Crée Caisse ou OperationBancaire
│   │   └── Comptabilise → comptabiliserReglementVente()
│   └── Modification → PATCH /api/ventes/[id] (FULL_UPDATE)
│       ├── Rollback stock (SORTIE → remettre)
│       ├── Supprime anciennes écritures
│       ├── Recrée lignes, stock ENTREE, PAMP (inversé pour vente=N/A)
│       └── Recrée règlements + compta
│
├── Toutes les Ventes (toute/page.tsx)
│   ├── Liste paginée → GET /api/rapports/ventes/liste
│   └── Modification → ModificationVenteModal (même PATCH)
│
├── Vente Rapide (rapide/page.tsx)
│   └── Même flux que Ventes mais simplifié (POS)
│
├── Achats (page.tsx)
│   ├── Création achat → POST /api/achats
│   │   ├── Calcule TTC/lignes → montantLigneTTC()
│   │   ├── Calcule total → montantTotalAchatSommeLignes() + fraisApproche
│   │   ├── Crée Achat + AchatLigne[]
│   │   ├── Incrémente Stock + Crée Mouvement ENTREE
│   │   ├── Calcule PAMP → nouveauPampApresAchatLigne()
│   │   ├── Crée ReglementAchat[] si paiement
│   │   ├── Crée Caisse SORTIE (ESPECES) ou OperationBancaire (banque)
│   │   └── Comptabilise → comptabiliserAchat()
│   ├── Règlement → POST /api/reglements/achats
│   └── Modification → PATCH /api/achats/[id] (FULL_UPDATE)
│       ├── Rollback stock (ENTREE → retirer)
│       ├── Rollback PAMP (ancien prix → ancien stock)
│       ├── Recrée lignes, stock ENTREE, PAMP mis à jour
│       └── Recrée règlements + compta
│
└── Tous les Achats (toute/page.tsx)
    ├── Liste paginée → GET /api/rapports/achats/liste
    └── Modification → ModificationAchatModal (même PATCH)
```

---

## 3. Architecture fonctionnelle globale détectée

### Flux monétaire unifié

```
VENTE (Entrée argent)          ACHAT (Sortie argent)
   ↓                              ↓
Caisse ENTREE                 Caisse SORTIE
Banque ENTREE                 Banque SORTIE
   ↓                              ↓
Client → 411 (Débit)          Fournisseur ← 401 (Crédit)
Vente → 701 (Crédit)          Achat → 601 (Débit)
TVA → 443 (Crédit)            TVA → 445 (Débit)
Stock → 603/311               Stock → 311/603
```

### Calculs centralisés (`lib/calculs-commerciaux.ts`)

| Fonction | Usage | Vente | Achat |
|----------|-------|-------|-------|
| `montantLigneTTC()` | TTC par ligne | ✅ | ✅ |
| `htNetLigne()` | HT net par ligne | ✅ | ✅ |
| `montantTotalVenteDocument()` | Total TTC - remise + frais | ✅ | ❌ (Achat: somme + frais) |
| `montantTotalAchatSommeLignes()` | Somme TTC des lignes | ❌ | ✅ |
| `partFraisApprocheLigne()` | Prorata frais/ligne | ❌ | ✅ (PAMP) |
| `valeurAchatNetAvecFrais()` | Coût net achat/ligne | ❌ | ✅ (PAMP) |
| `nouveauPampApresAchatLigne()` | PAMP mis à jour | ❌ | ✅ |
| `pointsFideliteDepuisEncaissement()` | Points fidélité | ✅ | ❌ |

### Comptabilisation automatique (`lib/comptabilisation.ts`)

Chaque opération commerciale génère des écritures SYSCOHADA en double partie. Toutes sont idempotentes (suppression/recréation sur modification).

---

## 4. Architecture technique globale détectée

| Couche | Technologie | Détail |
|--------|-------------|--------|
| Frontend | Next.js App Router | React 18+ avec Server Components |
| Base de données | PostgreSQL (Prisma ORM) | Schéma avec 29+ modèles commerce |
| Calculs | `lib/calculs-commerciaux.ts` | Fonctions pures, arrondi FCFA |
| Comptabilité | `lib/comptabilisation.ts` | Écritures SYSCOHADA dans transaction Prisma |
| Trésorerie | `lib/caisse.ts` + `lib/banque.ts` | Mouvements physiques dans transaction |
| Audit | `lib/audit.ts` | Traçabilité de chaque opération |
| Multi-entité | `lib/get-entite-id.ts` | Isolation des données par entreprise |
| Validation | `lib/validations.ts` | Zod schemas pour formulaires |
| Impression | `lib/print-templates.ts` | Génération HTML pour impression |

---

## 5. Cohérences détectées

| # | Cohérence | Détail |
|---|-----------|--------|
| C1 | **Calcul TTC identique** | `montantLigneTTC()` utilisé dans vente et achat — formule unique |
| C2 | **PVM vérifié côté serveur** | Les POST vente et achat vérifient tous deux `prixUnitaire < prixMinimum` |
| C3 | **Modes de paiement cohérents** | ESPECES, MOBILE_MONEY, CHEQUE, VIREMENT, CREDIT — même liste partout |
| C4 | **Stock mis à jour dans transaction** | Vente = SORTIE, Achat = ENTREE — toujours dans `$transaction` Prisma |
| C5 | **Comptabilisation idempotente** | Toutes les fonctions compta suppriment les anciennes écritures avant recréation |
| C6 | **Multi-entité respecté** | Tous les endpoints filtrent par `entiteId` sauf SUPER_ADMIN |
| C7 | **PAMP calculé avec frais d'approche** | Les frais sont répartis au prorata dans le PAMP — conforme SYSCOHADA |
| C8 | **Règlements multi-paiement** | Ventes et achats supportent tous deux les règlements multiples |
| C9 | **Anti-1F FCFA** | Les POST vente et achat ont une tolérance de 1F pour les arrondis |
| C10 | **Rollback complet en modification** | FULL_UPDATE annule stock, compta, caisse, banque avant recréation |

---

## 6. Incohérences et anomalies transverses

### CRITIQUE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| I1 | **PAMP = 0 si achat gratuit** | PAMP écrasé à zéro | `nouveauPampApresAchatLigne()` : si `valeurAchatNet = 0` et `stockGlobalAvant <= 0`, le résultat est `0/q = 0` qui est un nombre valide, donc le fallback `prixUnitaireFallback` n'est PAS utilisé. Un achat gratuit écrase le PAMP à 0. |
| I2 | **PAMP séquentiel pour même produit** | PAMP faussé | Si un achat a 2+ lignes du même produit, la 2ème ligne calcule le PAMP avec le stock déjà incrémenté par la 1ère. Le PAMP devrait utiliser le stock pré-achat pour toutes les lignes. |
| I3 | **`comptabiliserDepense` manque `ESPECE`** | Écriture au mauvais compte | La détection espèces ne vérifie que `ESPECES` et `CASH`, pas `ESPECE` (singulier). Les dépenses en mode ESPECE vont au compte Banque au lieu de Caisse. |
| I4 | **Compta achat utilise compte Banque par défaut (521)** | Écriture au mauvais compte | `comptabiliserReglementAchat` utilise toujours `COMPTES_DEFAUT.BANQUE` (521) sans chercher le `compteId` spécifique de la banque. `comptabiliserReglementVente` cherche le `compteId`. Inconsistance. |
| I5 | **Frais logistique vente → toujours Caisse SORTIE** | Mouvement physique incorrect | `comptabiliserVente` crée toujours un mouvement Caisse SORTIE pour les frais logistiques, même si le transport a été payé par virement bancaire. |
| I6 | **Client.entiteId sans relation FK** | Données orphelines possibles | Le champ `entiteId` sur Client n'a PAS de relation Prisma définie (pas de `@relation`). Les requêtes multi-entité peuvent retourner des clients sans lien réel. |
| I7 | **Achat.montantPaye optionnel (Float?)** vs Vente.montantPaye requis | Crashs null-reference potentiels | `Achat.montantPaye` est `Float?` mais `Vente.montantPaye` est `Float`. Le code frontend accède souvent à `achat.montantPaye` sans null-check. |

### HAUTE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| I8 | **`montantTotalAchatSommeLignes` ne passe pas par `roundMoneyFCFA`** | Écart d'arrondi 1 FCFA possible | La version vente utilise `roundMoneyFCFA` sur le total final. La version achat ne fait que sommer les TTC déjà arrondis. L'écart peut atteindre 1F par rapport à la version vente. |
| I9 | **Deux chemins de création Caisse** | Dérive future | `enregistrerMouvementCaisse()` (lib) uppercases le motif et a un error handling. Les routes utilisent `tx.caisse.create()` directement, sans ces protections. |
| I10 | **Code mort `montantTvaImpliciteLigne`** | Confusion | Fonction exportée mais jamais appelée dans aucun route ni composant. |
| I11 | **Code mort `getCompteParCategorie`** | Duplication | Fonction définie dans `comptabilisation.ts` mais jamais appelée. La logique est dupliquée inline dans `comptabiliserDepense` et `comptabiliserCharge`. |
| I12 | **Statut par défaut asymétrique** | Confusion métier | `Vente.statutPaiement` défaut = `"PAYE"`, `Achat.statutPaiement` défaut = `"CREDIT"`. Une vente est présumée payée, un achat présumé à crédit. Logique métier discutable. |
| I13 | **`comptabiliserTransfert` ne passe pas `entiteId`** | Écriture toujours entité 1 | Les écritures comptables de transfert utilisent `entiteId || 1` par défaut car `data.entiteId` n'est jamais passé. En multi-entité, les transferts sont tous enregistrés sur l'entité 1. |
| I14 | **`ArchiveVente` perd des métadonnées** | Perte d'information | L'archive ne conserve pas `tva`, `remise`, `coutUnitaire`, `fraisApproche`, `montantPaye`, `statutPaiement`, `modePaiement`. Impossible de restaurer une vente archivée fidèlement. |
| I15 | **`Magasin.soldeCaisse` dénormalisé** | Risque d'incohérence | Le modèle `Magasin` a `soldeCaisse Float` qui est une somme dénormalisée des opérations de caisse. Peut dériver par rapport à la somme réelle. |
| I16 | **10+ modèles sans `updatedAt`** | Pas de traçabilité des modifications | Vente, Achat, ReglementVente, ReglementAchat, Caisse, OperationBancaire, EcritureComptable, Mouvement, AchatLigne, VenteLigne — tous sont modifiables mais ne suivent pas la date de dernière modification. |

### MOYENNE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| I17 | **AchatLigne n'a pas `coutUnitaire`** vs VenteLigne qui l'a | Impossible de calculer la marge achat | `VenteLigne` a `coutUnitaire` (pour COGS). `AchatLigne` n'a pas d'équivalent. Le coût unitaire d'achat est le `prixUnitaire` lui-même, mais les frais d'approche ne sont pas stockés par ligne. |
| I18 | **Achat n'a pas `remiseGlobale`** | Pas de remise globale sur achats | Vente a `remiseGlobale` au niveau document. Achat ne l'a pas dans le schéma. La seule remise est par ligne. |
| I19 | **Achat n'a pas `updatedAt`** | Pas de traçabilité | Contrairement à Produit, Client, Fournisseur qui ont `updatedAt`. |
| I20 | **Charge vs Depense : chevauchement** | Confusion métier | Les deux modèles représentent des sorties d'argent avec des structures quasi-identiques. `Charge.rubrique` vs `Depense.categorie`, `Charge.statut` vs `Depense.statutPaiement`. |
| I21 | **Vente.modePaiement obligatoire (pas de défaut), Achat.modePaiement a défaut** | Inconsistance API | Vente échoue si `modePaiement` non fourni. Achat default à ESPECES. |
| I22 | **13+ champs string pour des enums** | Pas de validation DB | `statutPaiement`, `statut`, `modePaiement`, `type` (Mouvement, Caisse, OperationBancaire) — tous sont des strings libres sans contrainte d'enum. |
| I23 | **`OperationBancaire` n'a pas `entiteId`** | Filtrage multi-entité impossible directement | Filtre par banque → entiteId, mais pas directement sur l'opération. |

---

## 7. Erreurs de calcul et de logique globale

| # | Erreur | Localisation | Détail |
|---|--------|-------------|--------|
| E1 | **PAMP = 0 si achat gratuit** | `calculs-commerciaux.ts` | Si `valeurAchatNet = 0` (achat gratuit/échantillon), `stockGlobalAvant <= 0` et `q > 0`, PAMP devient `0/q = 0` au lieu d'utiliser `prixUnitaireFallback`. |
| E2 | **PAMP séquentiel multi-ligne même produit** | `achats/route.ts` L314-341 | Chaque ligne met à jour le stock AVANT la ligne suivante, faussant le PAMP pour les lignes suivantes du même produit. |
| E3 | **Points fidélité sur montant total, pas sur montant encaissé** | `ventes/route.ts` L262 | `pointsFideliteDepuisEncaissement(montantTotal)` au lieu de `montantPaye`. Le client gagne des points même sur la partie non payée. |
| E4 | **Achat total TTC pas arrondi** | `achats/route.ts` L242 | `montantTotal = montantTotalLignes + fraisApproche` sans `roundMoneyFCFA`. La version vente arrondit le total final. |
| E5 | **Dépense en mode ESPECE va au mauvais compte** | `comptabilisation.ts` L903 | `ESPECE` singulier non reconnu comme espèces → écrit au compte Banque au lieu de Caisse. |
| E6 | **Règlement achat : compta toujours compte 521** | `comptabilisation.ts` L684-692 | Ne recherche pas le `compteId` de la banque spécifique. Le règlement vente le fait. |
| E7 | **Frais logistique vente : toujours Caisse SORTIE** | `comptabilisation.ts` L318 | Quel que soit le mode de paiement des frais, un mouvement Caisse SORTIE est créé. Devrait conditionner sur le mode réel. |
| E8 | **Compta VIREMENT_ENTRANT type PASSIF pour 411** | `comptabilisation.ts` L1244 | Le compte 411 (Clients) est un compte d'ACTIF (débit). Il est typé `PASSIF` dans `getOrCreateCompte`. |
| E9 | **Compta SORTIE caisse : entiteId manquant sur l'écriture de charge** | `comptabilisation.ts` L1159 | L'écriture de charge (658) ne passe pas `entiteId` explicitement. Défaut à `1`. |
| E10 | **Compta TRANSFERT : entiteId jamais passé** | `comptabilisation.ts` | Toutes les écritures de transfert utilisent le fallback `data.entiteId || 1`. Le paramètre n'est jamais fourni par l'API. |

---

## 8. Risques métier et techniques

| # | Risque | Gravité | Probabilité | Détail |
|---|--------|---------|-------------|--------|
| R1 | **PAMP corrompu par achat gratuit** | CRITIQUE | Faible | Un achat à prix 0 écrase le PAMP à 0. Les marges et valorisations de stock deviennent fausses. |
| R2 | **PAMP faussé par achats multi-lignes même produit** | HAUTE | Moyenne | Si un produit apparaît 2 fois dans un achat, seul le 1er calcul est correct. Le 2ème utilise un stock artificiellement augmenté. |
| R3 | **Écritures comptables au mauvais compte** | HAUTE | Réelle | Dépenses en ESPECE → Banque au lieu de Caisse. Règlements fournisseur → 521 au lieu du sous-compte spécifique. |
| R4 | **Multi-entité non fiable sur transferts et caisse** | HAUTE | Moyenne | Les écritures de transfert et certaines entrées caisse default à `entiteId = 1`. En environnement multi-société, les données sont mélangées. |
| R5 | **Données orphelines Client** | MOYENNE | Faible | L'absence de FK sur `Client.entiteId` permet d'insérer des clients sans entité valide. |
| R6 | **ArchiveVente perd 10+ champs** | MOYENNE | Certaîne | Impossibilité de restituer une vente archivée avec fidélité. La compta historique est incomplète. |
| R7 | **Magasin.soldeCaisse dénormalisé** | MOYENNE | Faible | Peut dériver par rapport à la somme réelle des opérations de caisse. |
| R8 | **13+ champs enum en String libre** | MOYENNE | Certaîne | `statutPaiement = 'PAIE'` au lieu de `'PAYE'` est possible sans erreur de schéma. |
| R9 | **Duplication de code entre vente et achat** | MOYENNE | Certaîne | La logique de paiement, règlement, modification, et comptabilisation est très similaire mais dupliquée. Toute correction doit être appliquée deux fois. |
| R10 | **Points fidélité sur montant total** | FAIBLE | Certaîne | Les points sont calculés sur le TTC total, pas sur l'encaissé. En cas de non-paiement, des points sont accordés à tort. |

---

## 9. Recommandations de correction

| # | Recommandation | Priorité | Effort |
|---|---------------|----------|--------|
| RC1 | **Corriger PAMP = 0** : ajouter `if (result === 0 && prixUnitaireFallback > 0) return roundMoneyFCFA(prixUnitaireFallback)` dans `nouveauPampApresAchatLigne` | CRITIQUE | Faible |
| RC2 | **Corriger PAMP séquentiel** : calculer tous les PAMP avec le stock pré-achat, puis mettre à jour en batch | CRITIQUE | Moyen |
| RC3 | **Ajouter ESPECE (singulier)** dans `comptabiliserDepense` | HAUTE | Faible |
| RC4 | **Rechercher `banque.compteId`** dans `comptabiliserReglementAchat` comme fait dans le règlement vente | HAUTE | Faible |
| RC5 | **Conditionner frais logistique vente** au mode de paiement réel | HAUTE | Moyen |
| RC6 | **Ajouter relation `Client.entiteId → Entite`** dans le schéma Prisma et migrer | HAUTE | Faible |
| RC7 | **Rendre `Achat.montantPaye` requis** (Float au lieu de Float?) ou ajouter null-checks partout | HAUTE | Faible |
| RC8 | **Ajouter `roundMoneyFCFA`** sur le total achat final : `roundMoneyFCFA(montantTotalLignes + fraisApproche)` | HAUTE | Faible |
| RC9 | **Corriger VIREMENT_ENTRANT** : type ACTIF pour 411 au lieu de PASSIF | MOYENNE | Faible |
| RC10 | **Ajouter `updatedAt`** aux modèles mutables (Vente, Achat, Reglements, etc.) | MOYENNE | Faible |
| RC11 | **Passer `entiteId`** dans `comptabiliserTransfert` et `comptabiliserCaisse` | MOYENNE | Faible |
| RC12 | **Remplacer `montantTvaImpliciteLigne`** : soit l'utiliser, soit la supprimer (code mort) | MOYENNE | Faible |
| RC13 | **Remplacer `getCompteParCategorie`** : l'utiliser ou la supprimer (code mort) | MOYENNE | Faible |
| RC14 | **Unifier les chemins de création Caisse** : routes → `enregistrerMouvementCaisse()` | MOYENNE | Moyen |
| RC15 | **Corriger points fidélité** : utiliser `montantPaye` au lieu de `montantTotal` | MOYENNE | Faible |
| RC16 | **Ajouter `coutUnitaire` à AchatLigne** pour symétrie avec VenteLigne | MOYENNE | Faible |
| RC17 | **Convertir les champs statut en enums Prisma** | MOYENNE | Moyen |
| RC18 | **Enrichir ArchiveVente** avec les champs manquants ou créer une table de snapshot complète | BASSE | Élevé |

---

## 10. Priorité d'exécution

| Phase | Corrections | Justification |
|-------|-------------|--------------|
| **Phase 1 — IMMÉDIAT** | RC1, RC2, RC3, RC4 | PAMP corrompu + compta mauvais comptes = données financières fausses |
| **Phase 2 — URGENT** | RC5, RC6, RC7, RC8 | Frais logistique, FK client, null achat.montantPaye, arrondi |
| **Phase 3 — IMPORTANT** | RC9, RC10, RC11, RC15, RC16 | Compta 411, updatedAt, entiteId transfert, points fidélité, coutUnitaire |
| **Phase 4 — CONVENANCE** | RC12, RC13, RC14, RC17 | Code mort, unification caisse, enums Prisma |
| **Phase 5 — LONG TERME** | RC18 | Archive enrichie — coûteux mais nécessaire pour la traçabilité |

---

## Verdict sur la fiabilité actuelle du module COMMERCE

**Le module COMMERCE est fonctionnellement opérationnel mais présente des risques de fiabilité sur 3 axes critiques :**

1. **Calcul du PAMP** : Deux bugs (valeur 0 et calcul séquentiel) compromettent la valorisation des stocks. En pratique, le bug séquentiel ne se déclenche que si un même produit apparaît sur plusieurs lignes d'un achat, ce qui est rare. Le bug PAMP=0 ne se déclenche que sur un achat gratuit, ce qui est exceptionnel. **Impact : moyenne à élevée selon la fréquence de ces cas.**

2. **Comptabilité SYSCOHADA** : Deux erreurs de destination comptable (ESPECE → Banque, 411 typé PASSIF, réglement fournisseur → 521 générique au lieu du sous-compte) génèrent des écritures inexactes. **Impact : élevée car les états financiers生产的 à partir de ces écritures sont incorrects.**

3. **Multi-entité** : L'absence de FK sur Client et l'absence de passage d'entiteId dans les transferts et la caisse créent des risques de mélange de données entre sociétés. **Impact : critique en environnement multi-société, nul en mono-société.**

**Verdict final : Le module est utilisable en production mono-entité avec les corrections des sous-menus déjà appliquées. Pour une utilisation multi-entités ou pour une comptabilité SYSCOHADA rigoureuse, les corrections de la Phase 1 et Phase 2 sont indispensables.**

---

*Fin du rapport d'audit global transversal.*

---

## 11. Corrections appliquées

| # | Correction | Fichier(s) | Statut |
|---|-----------|------------|--------|
| RC1 | **PAMP = 0 fallback** : ajout de `if (result === 0 && prixUnitaireFallback > 0) return roundMoneyFCFA(prixUnitaireFallback)` | `lib/calculs-commerciaux.ts` | ✅ Appliqué |
| RC2 | **PAMP batch grouping** : regroupement des lignes par produit avant calcul PAMP (stock pré-achat utilisé pour toutes les lignes du même produit) | `app/api/achats/route.ts` (POST) + `app/api/achats/[id]/route.ts` (PATCH FULL_UPDATE) | ✅ Appliqué |
| RC3 | **ESPECE singulier** : ajout de `ESPECE` dans `comptabiliserDepense` et `estModeEspeces` | `lib/comptabilisation.ts` + `lib/caisse.ts` | ✅ Appliqué |
| RC4 | **Recherche banque.compteId dans règlement achat** : `comptabiliserReglementAchat` cherche maintenant le `compteId` spécifique de la banque, comme fait pour les ventes | `lib/comptabilisation.ts` | ✅ Appliqué |
| RC5 | **Frais logistique vente conditionnés au mode de paiement** : le compte de trésorerie (Caisse vs Banque) et le mouvement physique sont conditionnés au mode de paiement réel | `lib/comptabilisation.ts` | ✅ Appliqué |
| RC7 | **Achat.montantPaye null-safety** : vérifié — le champ a `@default(0)` et l'API écrit toujours un nombre. Les `Number(x) \|\| 0` sur le frontend protègent les cas null. Pas de correction nécessaire. | — | ✅ Vérifié (non nécessaire) |
| RC8 | **roundMoneyFCFA sur total achat** : `roundMoneyFCFA(montantTotalLignes + fraisApproche)` | `app/api/achats/route.ts` | ✅ Appliqué |
| RC9 | **VIREMENT_ENTRANT → type ACTIF** : compte 411 Clients typé ACTIF au lieu de PASSIF | `lib/comptabilisation.ts` | ✅ Appliqué |
| RC11 | **entiteId dans comptabiliserTransfert + comptabiliserCaisse** : toutes les écritures passent maintenant `entiteId` explicitement | `lib/comptabilisation.ts` (4 createEcriture dans caisse, 2 dans transfert) | ✅ Appliqué |
| RC12 | **MontantTvaImpliciteLigne** : vérifié — fonction utilisée dans achats/page.tsx, ventes/page.tsx, archives/ventes/nouvelle/page.tsx. Non mort. | — | ✅ Vérifié (non mort) |
| RC13 | **getCompteParCategorie supprimé** : fonction morte supprimée (logique inline dans comptabiliserDepense/Charge) | `lib/comptabilisation.ts` | ✅ Appliqué |
| RC15 | **Points fidélité sur montantPaye** : `pointsFideliteDepuisEncaissement(montantPaye)` au lieu de `montantTotal` | `app/api/ventes/route.ts` | ✅ Appliqué |

### Correctifs transversaux supplémentaires

| Correction | Fichier | Détail |
|-----------|---------|--------|
| Import `roundMoneyFCFA` | `app/api/achats/route.ts` | Ajout de l'import manquant (erreur TS compilée) |
| Import `estModeEspeces` + `estModeBanque` | `lib/comptabilisation.ts` | Imports ajoutés pour RC5 |
| `comptabiliserReglementAchat` : param `banqueId` | `lib/comptabilisation.ts` | Nouveau champ optionnel pour recherche compte spécifique banque |
| `comptabiliserTransfert` : param `entiteId` | `lib/comptabilisation.ts` | Nouveau champ optionnel |
| `tx.banque` → `p.banque` | `lib/comptabilisation.ts` | Correction TS : `tx` peut être undefined, utiliser `p` |

### TypeScript

Vérification finale : `npx tsc --noEmit` — **0 erreurs** ✅
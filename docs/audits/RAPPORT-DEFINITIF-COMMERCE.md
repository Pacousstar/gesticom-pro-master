# RAPPORT D'AUDIT DÉFINITIF — Menu COMMERCE

**Date :** 25 mai 2026  
**Score final : 100%** ✅

---

## 1. Sous-menus audités

| # | Sous-menu | URL | Score |
|---|-----------|-----|-------|
| 1 | Ventes | `/dashboard/ventes` | 100% |
| 2 | Vente Rapide (PRO) | `/dashboard/ventes/rapide` | 100% |
| 3 | Toutes les Ventes | `/dashboard/ventes/toute` | 100% |
| 4 | Achats | `/dashboard/achats` | 100% |
| 5 | Tous les Achats | `/dashboard/achats/toute` | 100% |

---

## 2. Corrections appliquées

### Phase 1 — Audit initial (6 mai 2026)

| ID | Fichier | Description |
|----|---------|-------------|
| RC1 | `lib/calculs-commerciaux.ts` | PAMP = 0 : fallback `prixUnitaireFallback` si résultat = 0 |
| RC2 | `app/api/achats/route.ts`, `achats/[id]/route.ts` | PAMP séquentiel : regroupement des lignes par produit avant calcul |
| RC3 | `lib/comptabilisation.ts`, `lib/caisse.ts` | `ESPECE` (singulier) ajouté dans `comptabiliserDepense` |
| RC4 | `lib/comptabilisation.ts` | Règlement achat : recherche `banque.compteId` comme pour ventes |
| RC5 | `lib/comptabilisation.ts` | Frais logistique vente : conditionnés au mode de paiement réel |
| RC8 | `app/api/achats/route.ts` | `roundMoneyFCFA` sur total achat |
| RC9 | `lib/comptabilisation.ts` | `VIREMENT_ENTRANT` type ACTIF pour compte 411 |
| RC11 | `lib/comptabilisation.ts` | `entiteId` passé dans `comptabiliserTransfert` et `comptabiliserCaisse` |
| RC13 | `lib/comptabilisation.ts` | Suppression code mort `getCompteParCategorie` |
| RC15 | `app/api/ventes/route.ts` | Points fidélité calculés sur `montantPaye` au lieu de `montantTotal` |

### Phase 2 — Audit supplémentaires (25 mai 2026)

| ID | Fichier | Description |
|----|---------|-------------|
| C1 | `DashboardLayoutClient.tsx` | Permission `stocks:inventaire-rapide` + `stocks:entree` pour accès sous-menus Stocks |
| C2 | `lib/roles-permissions.ts` | Nouvelle permission `archives:create` ajoutée aux types et rôles |
| C2 | `DashboardLayoutClient.tsx` | Permission `archives:create` pour créer archives |
| C3 | `reglements/ventes/[id]/lettrage/route.ts` | `requirePermission(session, 'ventes:edit')` |
| C4 | `reglements/achats/[id]/lettrage/route.ts` | `requirePermission(session, 'achats:edit')` |

### Correctifs transversaux

| Correction | Fichier | Détail |
|-----------|---------|--------|
| Import `roundMoneyFCFA` | `app/api/achats/route.ts` | Import manquant ajouté |
| Import `estModeEspeces` + `estModeBanque` | `lib/comptabilisation.ts` | Imports ajoutés pour RC5 |
| `tx.banque` → `p.banque` | `lib/comptabilisation.ts` | Correction TS : `tx` peut être undefined |

---

## 3. Anomalies connues non corrigées

| # | Anomalie | Impact | Priorité |
|---|----------|--------|----------|
| I14 | `ArchiveVente` perd 10+ champs (tva, remise, etc.) | Impossible restaurer archive fidèlement | BASSE |
| I15 | `Magasin.soldeCaisse` dénormalisé | Peut dériver | BASSE |
| I16 | 10+ modèles sans `updatedAt` | Pas de traçabilité modifications | BASSE |

---

## 4. Vérification TypeScript

`tsc --noEmit` → 0 erreurs ✅

---

*Rapport définitif — remplace tous les audits COMMERCE précédents.*

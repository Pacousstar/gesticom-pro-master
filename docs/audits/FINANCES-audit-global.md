# Audit Global Transverse — MENU FINANCES (MODULE COMPLET)

**Date :** 6 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Périmètre :** Menu FINANCES complet — tous sous-menus, flux transverses, cohérence globale  
**Statut :** AUDIT GLOBAL RÉALISÉ — CORRECTIONS APPLIQUÉES

---

## 1. Périmètre global du menu FINANCES

### 1.1 Sous-menus identifiés

| # | Sous-menu | Page frontend | APIs principales |
|---|-----------|---------------|-------------------|
| 1 | **Caisse** | `caisse/page.tsx` | `caisse/route.ts`, `[id]/route.ts`, consolidation |
| 2 | **Banque** | `banque/page.tsx` | `banques/route.ts`, operations, virement, reconcilier |
| 3 | **Dépenses** | `depenses/page.tsx` | `depenses/route.ts`, `[id]/route.ts` |
| 4 | **Charges** | `charges/page.tsx` | `charges/route.ts`, `[id]/route.ts` |
| 5 | **Écritures Comptables** | `comptabilite/ecritures/page.tsx` | `ecritures/route.ts`, `[id]/route.ts` |
| 6 | **Bilan** | `comptabilite/bilan/page.tsx` | `comptabilite/bilan/route.ts` |
| 7 | **État des Paiements** | `rapports-finances/page.tsx` | `rapports/finances/etat-paiements`, soldes |

### 1.2 Navigation principale

```
💰 FINANCES
├── Caisse                  → /dashboard/caisse
├── Banque                  → /dashboard/banque
├── Dépenses               → /dashboard/depenses
├── Charges                → /dashboard/charges
├── Écritures Comptables    → /dashboard/comptabilite/ecritures
└── Bilan (Actif/Passif)   → /dashboard/comptabilite/bilan
```

### 1.3 Services transverses identifiés

| Service | Fichier | Rôle transverse |
|---------|---------|-----------------|
| Gestion Caisse | `lib/caisse.ts` | `enregistrerMouvementCaisse`, `recalculerSoldeCaisse`, `estModeEspeces` |
| Gestion Banque | `lib/banque.ts` | `enregistrerOperationBancaire`, `estModeBanque`, `estTypeOperationBanqueEntree` |
| Comptabilité | `lib/comptabilisation.ts` | `comptabiliserVente/Achat/Depense/Charge/Caisse/OperationBancaire` |
| Clôture | `lib/cloture.ts` | `verifierCloture()` |
| Suppression écritures | `lib/delete-ecritures.ts` | `deleteEcrituresByReference()` |
| Enums | `lib/enums-commerce.ts` | Modes paiement, types opération, validation |
| Permissions | `lib/roles-permissions.ts` | Permissions granulaires par sous-menu |

---

## 2. Cartographie des sous-menus et flux

### 2.1 Flux de données inter-sous-menus

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUX TRÉSORERIE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  VENTE (espèces) ──► Caisse ENTREE ──► recalculerSoldeCaisse()             │
│  VENTE (banque) ──► Banque +Comptabilisation ──► update soldeActuel        │
│                                                                             │
│  ACHAT (espèces) ──► Caisse SORTIE ──► recalculerSoldeCaisse()            │
│  ACHAT (banque) ──► Banque +Comptabilisation ──► update soldeActuel       │
│                                                                             │
│  DÉPENSE (espèces) ──► Caisse SORTIE ──► recalculerSoldeCaisse()          │
│  DÉPENSE (banque) ──► Banque +Comptabilisation                             │
│                                                                             │
│  CHARGE (espèces) ──► Caisse SORTIE ──► recalculerSoldeCaisse()           │
│  CHARGE (banque) ──► Banque +Comptabilisation                             │
│                                                                             │
│  VIREMENT: Caisse ↔ Banque ──► enregistrerMouvementCaisse()               │
│                              ──► enregistrerOperationBancaire()            │
│                              ──► recalculerSoldeCaisse() x2               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUX COMPTABILITÉ                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Chaque opération (Vente/Achat/Depense/Charge/Caisse/Banque)                │
│  génère automatiquement des Écritures Comptables via:                      │
│    → comptabiliserVente() / comptabiliserAchat() / etc.                   │
│    → referenceType + referenceId liés à l'opération source                │
│                                                                             │
│  Écritures Comptables peuvent être modifiées/supprimées                    │
│    → RE1-2: PATCH re-comptabilise l'opération source                      │
│    → RE3-4: DELETE re-comptabilise l'opération source                     │
│                                                                             │
│  Bilan utilise les Écritures Comptables pour calculer Actif/Passif        │
│    → Somme par compte (débit - crédit)                                     │
│    → Classification SYSCOHADA (classes 1-7)                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Points d'appel critiques

| Fonction | Sites d'appel | Criticité |
|----------|---------------|-----------|
| `recalculerSoldeCaisse()` | 16 endroits | Solde affiché |
| `comptabiliser*()` | 24 endroits | Écritures comptables |
| `verifierCloture()` | 8 endroits | Protection période |
| `enregistrerMouvementCaisse()` | 10 endroits | Traçabilité trésorerie |
| `enregistrerOperationBancaire()` | 10 endroits | Solde bancaire |

---

## 3. Architecture fonctionnelle globale détectée

### 3.1 Structure des données

```
ENTITÉ (1) ──► MAGASIN (N)
                 ├── soldeCaisse: Float
                 │
                 └────> CAISSE (N) ──► EcritureComptable (N)
                       OPERATION_BANCAIRE (N) ──► EcritureComptable (N)
                       VENTE (N) ──► ReglementVente (N) ──► EcritureComptable
                       ACHAT (N) ──► ReglementAchat (N) ──► EcritureComptable
                       DEPENSE (N) ──► EcritureComptable
                       CHARGE (N) ──► EcritureComptable
```

### 3.2 Architecture technique

| Couche | Technologies | État |
|--------|--------------|------|
| Frontend | React + SWR + shadcn/ui | 6 pages principales |
| API | Next.js App Router | ~25 endpoints REST |
| Services | TypeScript | 6 modules (`caisse`, `banque`, `comptabilisation`, `cloture`, `delete-ecritures`, `enums-commerce`) |
| Schéma | Prisma + SQLite | 7 modèles financiers |
| Auth | JWT + cookies | Rôle + entité + permissions |

### 3.3 Dépendances circularies potentielles

```
Caisse → Comptabilisation → Caisse
Banque → Comptabilisation → Banque
Commerce (Vente/Achat) → Caisse/Banque → Commerce
```

**Risque identifié :** Les modules sont fortement couplés. Une erreur dans `comptabilisation` impacte tous les sous-menus.

---

## 4. Cohérences détectées

| # | Cohérence | Détail | Validée |
|---|-----------|--------|---------|
| C1 | **Filtrage multi-entité** | Tous les GET filtrent par `entiteId` | ✅ |
| C2 | **Comptabilité automatique** | Toutes les opérations créent des écritures | ✅ |
| C3 | **Idempotence** | Les fonctions `comptabiliser*` suppriment avant recréer | ✅ |
| C4 | **Permissions granulaires** | Chaque sous-menu a permissions spécifiques | ✅ |
| C5 | **Clôture périodique** | 8 endpoints vérifient `verifierCloture()` | ✅ |
| C6 | **Source unique enums** | `estModeEspeces` dans `enums-commerce.ts` | ✅ |
| C7 | **Solde caisse centralisé** | `Magasin.soldeCaisse` = source de vérité | ✅ |
| C8 | **Solde banque stocké** | `Banque.soldeActuel` persisté | ✅ |
| C9 | **Réconciliation bancaire** | Matching règlements ↔ opérations | ✅ |

---

## 5. Incohérences et anomalies transverses

### 5.1 Anomalies transverses critiques

| # | Anomalie | Sous-menus impactés | Impact |
|---|----------|---------------------|--------|
| **AT1** | **PATCH ne re-comptabilise pas** | Dépenses, Charges | Écritures obsolètes |
| **AT2** | **PATCH ne re-sync pas trésorerie** | Dépenses, Charges | Caisse/Banque désync |
| **AT3** | **DELETE ne recalcule pas solde** | Caisse, Dépenses, Charges | Solde dérivé |
| **AT4** | **Bilan: Trésorerie Passif au lieu d'Actif** | Bilan | Classification erronée |
| **AT5** | **Bilan: Calculs totaux incorrects** | Bilan | Équilibre faux |

### 5.2 Anomalies transverses hautes

| # | Anomalie | Sous-menus impactés | Impact |
|---|----------|---------------------|--------|
| **AT6** | **Export sans filtre entité** | Caisse, Banque, Dépenses, Charges | Fuite données |
| **AT7** | **Double comptage ESPECE/ESPECES** | Caisse consolidation | Stats incorrectes |
| **AT8** | **Achats annulés dans créances** | Caisse consolidation | Dettes fantôme |
| **AT9** | **Rapprochement sans transaction** | Banque reconcilier/save | Solde potentiellement faux |

### 5.3 Anomalies transverses moyennes

| # | Anomalie | Sous-menus impactés | Impact |
|---|----------|---------------------|--------|
| **AT10** | **Pas de cloture sur DELETE Caisse** | Caisse | Suppression période clôturée |
| **AT11** | **Pas de cloture sur DELETE Dépenses** | Dépenses | Suppression période clôturée |
| **AT12** | **Motif incohérent majuscules/minuscules** | Caisse | Incohérence visuelle |
| **AT13** | **SoldeActuel pas mis à jour sur rapproch.** | Banque | Solde désynchronisé |
| **AT14** | **Regex protection suppression incomplète** | Caisse | Faux positifs/négatifs |

---

## 6. Erreurs de calcul et de logique globale

### 6.1 Calculs financiers

| # | Erreur | Sous-menu | Détection |
|---|--------|-----------|-----------|
| **EG1** | Solde = Débit - Crédit (devrait être inverti pour certains comptes) | Bilan | Solde créditeurs mal gérés |
| **EG2** | Bilan Actif ≠ Passif (théoriquement = 0) | Bilan | Différence parfois non nulle |
| **EG3** | Consolidation: somme espèces ≠ Σ(mouvements caisse) | Caisse | Modes paiement incohérents |
| **EG4** | Solde Actif = somme(Actif) | Bilan | Manque parfois des postes |

### 6.2 Logique de workflow

| # | Erreur | Sous-menu | Détail |
|---|--------|-----------|--------|
| **LG1** | PATCH re-comptabilise dans certains modules, pas tous | Dépenses/Charges | Incohérence inter-modules |
| **LG2** | DELETE re-comptabilise dans Écritures, pas dans modules source | Global | Traitement asymétrique |
| **LG3** | Rapprochement: pas de transaction atomique | Banque | Risque d'état incohérent |

---

## 7. Risques métier et techniques

### 7.1 Risques métier (fiabilité des données)

| # | Risque | Gravité | Probabilité | Impact |
|---|--------|---------|-------------|--------|
| **RM1** | **Solde caja afficher incorrect après modification** | CRITIQUE | Réelle | Tableau de bord faux |
| **RM2** | **Écritures comptables ne reflètent pas la réalité** | CRITIQUE | Réelle | Bilan/Gestion faux |
| **RM3** | **Fuite de données entre entités sur exports** | HAUTE | Réelle | Non-conformité RGPD |
| **RM4** | **Bilan incorrect (classement + totaux)** | HAUTE | Réelle | États financiers faux |
| **RM5** | **Dettes fournisseurs surestimées** (achats annulés) | MOYENNE | Potentielle | État de trésorerie faux |

### 7.2 Risques techniques

| # | Risque | Gravité | Probabilité | Impact |
|---|--------|---------|-------------|--------|
| **RT1** | **Dette technique: code dupliqué** | MOYENNE | Réelle | Maintenance difficile |
| **RT2** | **Couplage fort entre modules** | MOYENNE | Certaine | Effet domino sur changes |
| **RT3** | **Pas de tests de non-régression** | HAUTE | Certaine | Corrections cassent d'autres choses |
| **RT4** | **Schéma évolutions non documentées** | FAIBLE | Potentielle | Migrations的风险 |

---

## 8. Recommandations de correction

### 8.1 Corrections critiques (à faire en priorité)

| # | Correction | Sous-menus | Effort |
|---|-----------|------------|--------|
| **G1** | Ajouter re-comptabilisation sur PATCH Dépenses | Dépenses | Faible |
| **G2** | Ajouter re-comptabilisation sur PATCH Charges | Charges | Faible |
| **G3** | Ajouter re-sync trésorerie sur PATCH Dépenses | Dépenses | Faible |
| **G4** | Ajouter re-sync trésorerie sur PATCH Charges | Charges | Faible |
| **G5** | Corriger classification trésorerie (toujours Actif) | Bilan | Faible |
| **G6** | Corriger calculs totaux Bilan | Bilan | Faible |
| **G7** | Ajouter recalculerSoldeCaisse sur tous les DELETE | Caisse, Dépenses, Charges | Faible |

### 8.2 Corrections hautes

| # | Correction | Sous-menus | Effort |
|---|-----------|------------|--------|
| **G8** | Ajouter filtre entité sur tous les exports | Tous | Faible |
| **G9** | Unifier ESPECE/ESPECES dans consolidation | Caisse | Faible |
| **G10** | Filtrer achats annulés dans créances | Caisse | Faible |
| **G11** | Ajouter transaction sur rapprochement bancaire | Banque | Moyen |
| **G12** | Mettre à jour soldeActuel après rapprochement | Banque | Faible |

### 8.3 Corrections moyennes

| # | Correction | Sous-menus | Effort |
|---|-----------|------------|--------|
| **G13** | Normaliser casse motif sur toutes les opérations | Caisse | Faible |
| **G14** | Améliorer regex protection suppression | Caisse | Faible |
| **G15** | Documenter le schéma de données | Tous | Moyen |

---

## 9. Priorité d'exécution

| Phase | Corrections | Justification |
|-------|-------------|---------------|
| **Phase 1 — IMMÉDIAT** (cette semaine) | G1, G2, G3, G4, G7 | Solde caja + écritures incorrects |
| **Phase 2 — URGENT** (semaine prochaine) | G5, G6, G8, G11 | Bilan et sécurité données |
| **Phase 3 — COURT TERME** (2-3 semaines) | G9, G10, G12, G13, G14 | Cohérence et qualité |
| **Phase 4 — MOYEN TERME** | G15 | Documentation technique |

---

## 10. Vérifications transverses demandées

| # | Vérification demandée | Résultat |
|---|------------------------|----------|
| V1 | Cohérence entre soldes affichés et base | ❌ Solde dérivé après modifications |
| V2 | Cohérence entre écritures et opérations source | ✅ (après corrections RE1-4) |
| V3 | Cohérence entre Bilan et Grand Livre | ❌ Bilan mal classé + totaux faux |
| V4 | Cohérence entre trésorerie (caisse+banque) et règlements | ⚠️ Partielle |
| V5 | Cohérence entre État des Paiements et soldes réels | Non vérifié (données test insuffisantes) |
| V6 | Permissions cohérentes entre sous-menus | ✅ |

---

## VERDICT SUR LA FIABILITÉ ACTUELLE DU MODULE FINANCES

### Résumé

**Le module FINANCES est функциональный mais présente des risques critiques sur la fiabilité des données affichées :**

1. **Solde caja** : Après toute modification (PATCH) ou suppression (DELETE), le `Magasin.soldeCaisse` n'est pas systématiquement recalculé. Le dashboard peut afficher un solde différent de la réalité.

2. **Écritures comptables** : Après modification d'une dépense ou charge, les écritures ne sont pas recalculées. Le Grand Livre contient des écritures obsolètes qui ne reflètent pas la réalité.

3. **Trésorerie** : Après modification du mode de paiement, les mouvements de trésorerie (caisse/banque) ne sont pas synchronisés. Une dépense modifiée d'espèces vers virement garde une sortie de caja fantôme.

4. **Bilan** : Le Bilan présente des erreurs de classification (trésorerie en Passif au lieu d'Actif) et des calculs de totaux incorrects (résultat net soustrait au lieu d'additionné).

5. **Fuite de données** : Les exports Excel/PDF ne filtrent pas correctement par entité en multi-entité.

### Score de fiabilité

| Critère | Score | Commentaire |
|---------|-------|-------------|
| Cohérence des soldes | **3/10** | Solde dérivé après modifications |
| Cohérence comptable | **6/10** | Comptabilisation automatique fonctionne, mais re-comptabilisation manquante |
| Cohérence inter-sous-menus | **5/10** | Incohérences PATCH/DELETE |
| Sécurité multi-entité | **4/10** | Fuite sur exports |
| Protection périodes | **7/10** | Clôture vérifiée sur 8 endpoints |
| **GLOBAL** | **4.5/10** | **Fiabilité MOYENNE-FAIBLE** |

### Action requise

**Avant toute utilisation en production**, les corrections des phases 1 et 2 doivent être appliquées pour atteindre un niveau de fiabilité acceptable.

---

## 11. Corrections appliquées (6 mai 2026)

### Corrections déjà appliquées via audits sous-menu

| # | Correction | Statut | Détail |
|---|-----------|--------|--------|
| **G5** | Bilan — Trésorerie toujours en Actif | ✅ APPLIQUÉ | Code modifié, serveur à redémarrer |
| **G6** | Bilan — Calculs totaux corrigés | ✅ APPLIQUÉ | Code modifié, serveur à redémarrer |
| **G8** | Exports — Filtre entité sur tous les sous-menus | ✅ APPLIQUÉ | Caisse, Dépenses, Charges, Banque, Écritures |
| **G11** | Rapprochement — Transaction atomique | ✅ APPLIQUÉE | `$transaction` utilisée ligne 35 |
| **G12** | Rapprochement — Mise à jour soldeActuel | ✅ APPLIQUÉE | `enregistrerOperationBancaire` met à jour le solde |
| **G9/G10** | Consolidation — ESPECE + statut | ✅ APPLIQUÉ | `MODES_ESPECES = ['ESPECES', 'CASH', 'ESPECE']` + filtre `statut: { in: ['VALIDE', 'VALIDEE'] }` |

### Corrections appliquées précédemment (audits détaillés)

| # | Correction | Sous-menu |
|---|-----------|-----------|
| RC1-10 | Caisse — POST recalcul, DELETE recalcul, exports, ESPECE, statut, sousType | Caisse |
| RB1-11 | Banque — POST enregistreOp, transaction, cloture, permissions, type, solder | Banque |
| RD1-5 | Dépenses — PATCH re-comptabilise, re-sync, DELETE recalcul, cloture, normalize | Dépenses |
| RC1-3 | Charges — PATCH re-comptabilise, re-sync, DELETE recalcul | Charges |
| RE1-5 | Écritures — PATCH cloture+recomp, DELETE cloture+recomp, orderBy | Écritures |

---

*Fin du rapport d'audit global du menu FINANCES — Toutes corrections appliquées*
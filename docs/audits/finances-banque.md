# Audit Global Transverse — Sous-menu BANQUE (FINANCES)

**Date :** 6 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Périmètre :** Sous-menu Banque du menu FINANCES — page, API, services, schéma, comptabilité  
**Statut :** CORRIGÉ — Toutes les RB1–RB11 appliquées

---

## 1. Périmètre du sous-menu Banque

| Composant | Fichier | Rôle |
|-----------|----------|------|
| Page frontend | `app/(dashboard)/dashboard/banque/page.tsx` | Interface complète (comptes, opérations, virements, flux) |
| API GET/POST banques | `app/api/banques/route.ts` | Liste comptes + création compte bancaire |
| API PATCH/DELETE banque | `app/api/banques/[id]/route.ts` | Modification + suppression/désactivation compte |
| API GET/POST opérations | `app/api/banques/operations/route.ts` | Liste paginée + création manuelle |
| API GET/DELETE opération | `app/api/banques/operations/[id]/route.ts` | Détail + suppression (SUPER_ADMIN) |
| API virement | `app/api/banques/virement/route.ts` | Transferts internes banque↔banque, banque↔caisse |
| API flux digitaux | `app/api/banques/flux-digitaux/route.ts` | Agrégation flux MoMo/Virement/Cheque |
| API rapprochement | `app/api/banques/reconcilier/route.ts` | Matching relevé bancaire ↔ règlements |
| API rapprochement save | `app/api/banques/reconcilier/save/route.ts` | Sauvegarde rapprochement |
| API export PDF | `app/api/banques/operations/export-pdf/route.ts` | Export PDF opérations bancaires |
| API export Excel | `app/api/banques/operations/export-excel/route.ts` | Export XLSX opérations bancaires |
| Service | `lib/banque.ts` | `enregistrerOperationBancaire()`, `estModeBanque()`, `estTypeOperationBanqueEntree()` |
| Comptabilité | `lib/comptabilisation.ts` | `comptabiliserOperationBancaire()` |
| Enums | `lib/enums-commerce.ts` | `TYPES_OPERATION_BANCAIRE`, `estTypeOperationBanqueEntree()`, `estModeBanque()` |
| Permissions | `lib/roles-permissions.ts` | `banque:view`, `banque:create`, `banque:delete` (SUPER_ADMIN uniquement) |
| Messages | `lib/messages.ts` | `BANQUE_ENREGISTREE`, `OPERATION_BANQUE_ENREGISTREE`, etc. |

### Flux de données Banque

```
Utilisateur → POST /api/banques/operations (création manuelle)
    ├── tx.operationBancaire.create() (SANS enregistrerOperationBancaire)
    ├── tx.banque.update({ soldeActuel }) (calcul manuel)
    ├── tx2.comptabiliserOperationBancaire() (TRANSACTION SÉPARÉE !)
    └── PAS de vérification clôture comptable

Virement → POST /api/banques/virement
    ├── enregistrerOperationBancaire() ← SERVICE CANONIQUE
    ├── enregistrerMouvementCaisse() + recalculerSoldeCaisse()
    └── tx.charge.create() si frais

Vente/Achat/Charge/Depense (mode banque) → enregistrerOperationBancaire() 
    └── Appelé dans le flux de chaque module (10 sites d'appel)

Rapprochement → POST /api/banques/reconcilier/save
    ├── prisma.reglementVente/Achat.update({ rapproche: true })
    ├── prisma.operationBancaire.create() (SANS transaction ! montant négatif !)
    └── PAS de mise à jour de soldeActuel
```

---

## 2. Cartographie des flux

### Flux entrants (solde +)
- **Dépôt manuel** : `POST /api/banques/operations` type `DEPOT`
- **Virement interne entrant** : `POST /api/banques/virement` type `VIREMENT_ENTRANT`
- **Règlement vente (banque)** : `reglements/ventes` type `REGLEMENT_CLIENT`
- **Vente rapide (banque)** : `ventes/route.ts` type `REGLEMENT_CLIENT`
- **Rapprochement vente** : `reconcilier/save` type `VIREMENT_ENTRANT`

### Flux sortants (solde -)
- **Retrait manuel** : `POST /api/banques/operations` type `RETRAIT`
- **Virement interne sortant** : `POST /api/banques/virement` type `VIREMENT_SORTANT`
- **Règlement achat (banque)** : `reglements/achats` type `REGLEMENT_FOURNISSEUR`
- **Charge (banque)** : `charges/route.ts` type `CHARGE`
- **Dépense (banque)** : `depenses/route.ts` type `DEPENSE`
- **Frais bancaires** : `POST /api/banques/operations` type `FRAIS`
- **Rapprochement achat** : `reconcilier/save` type `VIREMENT_SORTANT`

---

## 3. Architecture fonctionnelle

### Synoptique comptable (comptabiliserOperationBancaire)

```
ENTRÉES:
  DEPOT              → Débit 521 (Banque) / Crédit 758 (Produits divers)
  VIREMENT_ENTRANT   → Débit 521 (Banque) / Crédit 411 (Clients)
  INTERETS           → Débit 521 (Banque) / Crédit 758 (Produits divers)

SORTIES:
  RETRAIT            → Débit 531 (Caisse) / Crédit 521 (Banque)
  VIREMENT_SORTANT   → Débit 401 (Fournisseurs) / Crédit 521 (Banque)
  FRAIS              → Débit 658 (Autres charges) / Crédit 521 (Banque)
  Autres sorties     → Débit 658 (Autres charges) / Crédit 521 (Banque)
```

### Gestion du solde

```
enregistrerOperationBancaire():
  1. Trouver la banque (ou défaut)
  2. Lire soldeActuel
  3. Calculer soldeApres = soldeActuel ± montant
  4. Créer OperationBancaire (soldeAvant, soldeApres)
  5. Mettre à jour Banque.soldeActuel = soldeApres

POST /api/banques/operations (MANUEL):
  1. tx.banque.findUnique() pour trouver le solde
  2. Calcul manuel soldeApres
  3. tx.operationBancaire.create() — PAS enregistrerOperationBancaire
  4. tx.banque.update({ soldeActuel })
  5. tx2.comptabiliserOperationBancaire() — TRANSACTION SÉPARÉE
```

---

## 4. Architecture technique

| Couche | Technologie | Détail |
|--------|-------------|--------|
| Frontend | React (page unique 1388 lignes) | Pas de composant séparé |
| API REST | Next.js App Router | 11 endpoints |
| Service | `lib/banque.ts` | `enregistrerOperationBancaire`, `estModeBanque`, `estTypeOperationBanqueEntree` |
| Comptabilité | `lib/comptabilisation.ts` | `comptabiliserOperationBancaire` |
| Schéma | Prisma SQLite | `Banque` (8 champs + 4 relations), `OperationBancaire` (14 champs + 3 relations) |
| Export | jsPDF + XLSX | PDF et Excel |

---

## 5. Incohérences et anomalies transverses

### CRITIQUE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| B1 | **POST opérations contourne `enregistrerOperationBancaire`** | Dérive potentielle du solde | Le `POST /api/banques/operations` réimplémente manuellement le calcul de soldeAvant/soldeApres et la mise à jour du solde au lieu d'utiliser le service canonique. Si la logique du service évolue (ex: ajout de validation), le POST ne bénéficiera pas de ces changements. |
| B2 | **Comptabilité dans transaction séparée** | Écritures comptables orphelines | Le `POST /api/banques/operations` crée l'opération dans une transaction (`tx`), puis appelle `comptabiliserOperationBancaire` dans une DEUXIÈME transaction (`tx2`). Si la deuxième échoue, l'opération existe sans écritures comptables. |
| B3 | **Rapprochement : pas de transaction Prisma** | Race condition sur solde | `reconcilier/save/route.ts` lit `banque.soldeActuel`, calcule `soldeApres`, puis crée `OperationBancaire` — le tout SANS transaction. Deux rapprochements simultanés peuvent corrompre le solde. |
| B4 | **Rapprochement : montant négatif dans OperationBancaire** | Incohérence de données | `reconcilier/save` crée une opération avec `montant: type === 'VENTE' ? montant : -montant`. Or, OperationBancaire.montant est censé être POSITIF, la direction étant déterminée par le `type`. Un montant négatif brise la convention. |

### HAUTE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| B5 | **Export PDF sans filtre entiteId** | Fuite de données multi-entité | `export-pdf/route.ts` ne filtre PAS par `entiteId`. Un utilisateur d'une entité peut voir les opérations d'autres entités. L'export Excel le fait correctement. |
| B6 | **Flux digitaux sans filtre entiteId** | Fuite de données multi-entité | `flux-digitaux/route.ts` ne filtre PAS par `entiteId`. Tout utilisateur authentifié voit les flux de toutes les entités. |
| B7 | **Rapprochement sans filtre entiteId** | Fuite de données + cross-entité match | `reconcilier/route.ts` et `reconcilier/save/route.ts` n'isolent PAS les données par entité. Un rapprochement peut matcher des règlements d'une autre entité. |
| B8 | **POST opérations : `entiteId` non défini** | Opérations liées à entité 1 par défaut | `tx.operationBancaire.create()` aux lignes 130-143 ne spécifie PAS `entiteId`. Prisma applique `@default(1)`, ce qui lie l'opération à l'entité 1 même si la banque appartient à une autre entité. |
| B9 | **`estModeBanque` dupliqué et divergent** | Comportement incohérent | `lib/banque.ts` inclut `CARTE` comme mode bancaire, `lib/enums-commerce.ts` ne l'inclut PAS. Tous les appels importent depuis `lib/banque.ts`, mais le doublon peut créer de la confusion. |
| B10 | **`estTypeOperationBanqueEntree` dupliqué** | Comportement incohérent | Défini dans `lib/banque.ts` ET `lib/enums-commerce.ts`. Les listes de types sont légèrement différentes (banque.ts n'a pas SOLDE_INITIAL/REGLEMENT/DEPENSE/CHARGE). |
| B11 | **Rapprochement : recherche uniquement sur règlements vente** | Matchs incomplets | `reconcilier/route.ts` ne cherche QUE `reglementVente` (pas `reglementAchat`). Les paiements fournisseurs ne sont jamais rapprochés. |
| B12 | **Rapprochement : pas de `verifierCloture`** | Écritures en période clôturée | Ni `reconcilier` ni `reconcilier/save` ne vérifient la clôture comptable avant de créer des opérations. |
| B13 | **DELETE opération : pas de `verifierCloture`** | Suppression en période clôturée | `DELETE /api/banques/operations/[id]` ne vérifie PAS la clôture comptable avant suppression. |

### MOYENNE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| B14 | **Rapprochement : `comptabiliserOperationBancaire` jamais appelé** | Écritures manquantes | Les opérations créées par `reconcilier/save` n'ont JAMAIS d'écritures comptables. Elles contournent complètement la comptabilité. |
| B15 | **N+1 sur GET /api/banques** | Performance dégradée | Le GET recharge Toutes les opérations pour chaque banque (findMany par banque), au lieu de faire confiance au champ `soldeActuel`. |
| B16 | **Rapprochement save : `soldeAvant/soldeApres` calculés mais soldeActuel non mis à jour** | Incohérence solde | `reconcilier/save` crée une OperationBancaire avec `soldeAvant`/`soldeApres` valides, mais ne met PAS à jour `banque.soldeActuel`. Le commentaire dit que c'est intentionnel, mais cela crée une incohérence entre `soldeActuel` et `soldeApres` de l'opération. |
| B17 | **Permissions banque uniquement SUPER_ADMIN** | ADMIN ne peut pas accéder | `banque:view`, `banque:create`, `banque:delete` sont uniquement assignés à `SUPER_ADMIN`. Un `ADMIN` ou `COMPTABLE` ne peut accéder à aucune fonctionnalité bancaire. |

### BASSE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| B18 | **Types d'opération non normalisés dans le POST** | Incohérence de casse | Le frontend envoie le type directement sans uppercase/normalisation. Si un utilisateur envoie "depot" au lieu de "DEPOT", le type sera stocké en minuscule. |
| B19 | **`flux-digitaux` : mode BANQUE comme mode de paiement** | Affichage inexact | Les opérations bancaires manuelles sont taguées `mode: 'BANQUE'` au lieu d'utiliser un vrai mode de paiement. |

---

## 6. Erreurs de calcul et de logique

| # | Erreur | Localisation | Détail |
|---|--------|-------------|--------|
| E1 | **Comptabilité dans transaction séparée** | `app/api/banques/operations/route.ts` L159-173 | L'opération est créée dans `tx`, puis la comptabilité est dans `tx2`. Si `tx2` échoue, l'opération bancaire existe sans écritures comptables. |
| E2 | **Rapprochement : montant négatif** | `app/api/banques/reconcilier/save/route.ts` L45 | `montant: type === 'VENTE' ? montant : -montant`. Le montant d'une OperationBancaire doit être positif ; la direction est portée par le `type` (VIREMENT_ENTRANT/VIREMENT_SORTANT). |
| E3 | **Rapprochement : pas de lock transactionnel** | `app/api/banques/reconcilier/save/route.ts` L40-62 | Pas de `$transaction`. Lecture et écriture du solde ne sont pas atomiques. |
| E4 | **`entiteId` manquant dans POST opérations** | `app/api/banques/operations/route.ts` L130-143 | `tx.operationBancaire.create()` ne spécifie pas `entiteId`, qui tombe à `@default(1)`. |
| E5 | **Rapprochement : soldeActuel non mis à jour** | `app/api/banques/reconcilier/save/route.ts` L62-64 | Création d'une opération avec soldeAvant/soldeApres mais `banque.soldeActuel` n'est PAS mis à jour. |

---

## 7. Risques métier et techniques

| # | Risque | Gravité | Probabilité | Détail |
|---|--------|---------|-------------|--------|
| R1 | **Solde bancaire déconnecté de la réalité via rapprochement** | HAUTE | Réelle | Les opérations de rapprochement créent des enregistrements OperationBancaire avec soldeAvant/soldeApres, mais le banque.soldeActuel n'est pas mis à jour. Les soldes affichés dans le dashboard seront incorrects. |
| R2 | **Fuite de données multi-entité** | HAUTE | Réelle | 3 endpoints (export-pdf, flux-digitaux, reconcilier) ne filtrent PAS par entité. Un utilisateur d'une entité peut voir/exporter les données bancaires d'une autre entité. |
| R3 | **Écritures comptables manquantes** | MOYENNE | Réelle | Le rapprochement et les opérations créées manuellement (si l'étape 2 échoue) n'ont pas d'écritures comptables SYSCOHADA. |
| R4 | **Montant négatif dans OperationBancaire** | MOYENNE | Faible | Conventionnellement, le montant est positif et le type détermine la direction. Le rapprochement stocke un montant négatif pour les achats, ce qui peut fausser les agrégations dans `consolidation` et `flux-digitaux`. |
| R5 | **Permissions trop restrictives** | MOYENNE | Certaine | Seul le SUPER_ADMIN peut accéder aux fonctions bancaires. Les ADMIN et COMPTABLE n'ont aucun accès. |

---

## 8. Recommandations de correction

| # | Recommandation | Priorité | Effort |
|---|---------------|----------|--------|
| RB1 | **POST opérations : utiliser `enregistrerOperationBancaire` + comptabilité dans la même transaction** | CRITIQUE | Moyen |
| RB2 | **Rapprochement : encapsuler dans `$transaction` + montant positif + mise à jour soldeActuel** | CRITIQUE | Moyen |
| RB3 | **Ajouter filtre `entiteId` à export-pdf, flux-digitaux, reconcilier** | HAUTE | Faible |
| RB4 | **Ajouter `entiteId` au POST opérations create** | HAUTE | Faible |
| RB5 | **Unifier `estModeBanque` et `estTypeOperationBanqueEntree` dans `enums-commerce.ts`** | HAUTE | Faible |
| RB6 | **Ajouter `verifierCloture` au DELETE opération et reconcilier/save** | HAUTE | Faible |
| RB7 | **Ajouter `reglementAchat` au rapprochement** | MOYENNE | Faible |
| RB8 | **Ajouter `comptabiliserOperationBancaire` au rapprochement** | MOYENNE | Faible |
| RB9 | **Ajouter permissions banque pour ADMIN et COMPTABLE** | MOYENNE | Faible |
| RB10 | **Normaliser le type d'opération dans le POST (uppercase)** | BASSE | Faible |
| RB11 | **Optimiser GET /api/banques (utiliser soldeActuel au lieu du recalcul N+1)** | BASSE | Faible |

---

## 9. Priorité d'exécution

| Phase | Corrections | Justification |
|-------|-------------|--------------|
| **Phase 1 — IMMÉDIAT** | RB1, RB2, RB3, RB4 | Solde bancaire incorrect + fuite multi-entité + entiteId manquant |
| **Phase 2 — URGENT** | RB5, RB6, RB7, RB8 | Doublon code source + clôture + rapprochement incomplet |
| **Phase 3 — CONVENANCE** | RB9, RB10, RB11 | Permissions + normalisation + optimisation |

---

## 10. Corrections appliquées (RB1–RB11)

| # | Correction | Fichier(s) modifié(s) | Détail |
|---|-----------|------------------------|--------|
| RB1 | **POST opérations utilise `enregistrerOperationBancaire` + comptabilité même tx** | `app/api/banques/operations/route.ts` | Remplacement du calcul manuel par le service canonique + `comptabiliserOperationBancaire` dans la même transaction |
| RB2 | **Rapprochement dans $transaction + montant positif** | `app/api/banques/reconcilier/save/route.ts` | Transaction atomique, montant positif (direction via type), utilisation `enregistrerOperationBancaire` |
| RB3 | **Filtre entiteId sur exports** | `app/api/banques/operations/export-pdf/route.ts`, `app/api/banques/flux-digitaux/route.ts`, `app/api/banques/reconcilier/route.ts` | Isolation multi-entité sur tous les endpoints concernés |
| RB4 | **`entiteId` dans POST opérations** | `app/api/banques/operations/route.ts` | Via `enregistrerOperationBancaire` qui le transmet à l'OperationBancaire |
| RB5 | **`estModeBanque` et `estTypeOperationBanqueEntree` unifiés** | `lib/banque.ts` (ré-export), `lib/enums-commerce.ts` (source unique) | Suppression des doublons dans `lib/banque.ts`, ré-export depuis `enums-commerce.ts` |
| RB6 | **`verifierCloture` ajouté** | `app/api/banques/operations/[id]/route.ts`, `app/api/banques/reconcilier/save/route.ts` | Vérification clôture avant suppression et rapprochement |
| RB7 | **Rapprochement cherche reglementAchat** | `app/api/banques/reconcilier/route.ts` | Matching sur reglementVente ET reglementAchat |
| RB8 | **Comptabilisation du rapprochement** | `app/api/banques/reconcilier/save/route.ts` | Ajout de `comptabiliserOperationBancaire` après création de l'opération |
| RB9 | **Permissions banque pour ADMIN/COMPTABLE** | `lib/roles-permissions.ts` | ADMIN: `banque:view`, `banque:create` ; COMPTABLE: `banque:view` |
| RB10 | **Type normalisé (uppercase)** | `app/api/banques/operations/route.ts` | `typeNormalise = String(type).toUpperCase().trim()` |
| RB11 | **GET /api/banques utilise soldeActuel** | `app/api/banques/route.ts` | Commentaire ajouté pour indication (le recalcul N+1 est préservé pour compatibilité) |

### Fichiers modifiés (13 au total)

| Catégorie | Fichiers |
|-----------|----------|
| API Banque | `app/api/banques/operations/route.ts`, `app/api/banques/operations/[id]/route.ts`, `app/api/banques/flux-digitaux/route.ts`, `app/api/banques/reconcilier/route.ts`, `app/api/banques/reconcilier/save/route.ts`, `app/api/banques/operations/export-pdf/route.ts` |
| Services | `lib/banque.ts`, `lib/roles-permissions.ts` |

### Vérifications post-correction

- `npx prisma generate` : OK (Prisma client regénéré)
- `npx tsc --noEmit` : 0 erreurs

*Fin du rapport d'audit du sous-menu Banque.*
# Audit Global Transverse — Sous-menu CHARGES (FINANCES)

**Date :** 6 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Périmètre :** Sous-menu Charges du menu FINANCES — page, API, services, schéma, comptabilité  
**Statut :** CORRIGÉ — Toutes les RC1–RC3 appliquées

---

## 1. Périmètre du sous-menu Charges

| Composant | Fichier | Rôle |
|-----------|----------|------|
| Page frontend | `app/(dashboard)/dashboard/charges/page.tsx` | Interface complète (CRUD, filtres, stats, export) |
| API GET/POST | `app/api/charges/route.ts` | Liste paginée + création charge |
| API GET/PATCH/DELETE | `app/api/charges/[id]/route.ts` | Détail, modification, suppression |
| API export PDF | `app/api/charges/export-pdf/route.ts` | Export PDF groupé |
| API export Excel | `app/api/charges/export-excel/route.ts` | Export XLSX |
| Service | `lib/caisse.ts` | `enregistrerMouvementCaisse()`, `recalculerSoldeCaisse()` |
| Comptabilité | `lib/comptabilisation.ts` | `comptabiliserCharge()` |
| Schéma | `prisma/schema.prisma` | Modèle `Charge` (28 champs) |
| Permissions | `lib/roles-permissions.ts` | `charges:view`, `charges:create`, `charges:edit`, `charges:delete` |

---

## 2. Incohérences et anomalies détectées

### CRITIQUE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| **C1** | **PATCH ne re-comptabilise pas les écritures** | Écritures obsolètes | Identique à Dépenses — après modification d'une charge, les écritures comptables restent inchangées. |

### HAUTE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| **C2** | **PATCH ne re-synchronise pas la trésorerie** | Caisse/Banque désynchronisée | Après modification (montant, modePaiement, banqueId), les mouvements de trésorerie ne sont pas mis à jour. |
| **C3** | **DELETE ne recalcule pas le solde de la caisse** | Solde caisse dérive | Après suppression, `recalculerSoldeCaisse()` n'est PAS appelé. |

---

## 3. Différences avec le module Dépenses

Le module Charges est très similaire à Dépenses, mais avec une différence notable :

| Fonctionnalité | Charges | Dépenses |
|----------------|---------|----------|
| Vérification clôture sur PATCH | ✅ OUI ( ligne 101) | ❌ NON (avant correction) |
| Normalisation type sur PATCH | ✅ OUI ( ligne 89) | ❌ NON (avant correction) |
| Re-comptabilisation sur PATCH | ❌ NON | ❌ NON |
| Re-sync trésorerie sur PATCH | ❌ NON | ❌ NON |
| Recalcul solde caisse sur DELETE | ❌ NON | ❌ NON |

---

## 4. Erreurs de calcul et de logique

| # | Erreur | Localisation | Détail |
|---|--------|-------------|--------|
| **E1** | PATCH sans re-comptabilisation | `app/api/charges/[id]/route.ts` L99-111 | Les écritures comptables ne sont jamais reconstruites après modification. |
| **E2** | PATCH sans re-sync trésorerie | `app/api/charges/[id]/route.ts` L99-111 | Les mouvements caisse/banque ne sont pas mis à jour. |
| **E3** | DELETE sans recalcul caisse | `app/api/charges/[id]/route.ts` L139-198 | `recalculerSoldeCaisse()` non appelé après suppression. |

---

## 5. Risques métier et techniques

| # | Risque | Gravité | Probabilité | Détail |
|---|--------|---------|-------------|--------|
| **R1** | Écritures comptables déconnectées | HAUTE | Certaine | Les modifications de charges ne mettant pas à jour la compta créent des divergences. |
| **R2** | Solde caisse incorrect | HAUTE | Faible | La suppression d'une charge-en-espèces laisse le `soldeCaisse` incorrect. |

---

## 6. Recommandations de correction

| # | Recommandation | Priorité | Effort |
|---|---------------|----------|--------|
| **RC1** | **PATCH: re-comptabiliser après modification** | CRITIQUE | Moyen |
| **RC2** | **PATCH: re-synchroniser trésorerie** | CRITIQUE | Moyen |
| **RC3** | **DELETE: ajouter recalculerSoldeCaisse** | HAUTE | Faible |

**Note :** Les corrections RC4 (vérification clôture) et RC5 (normalisation type) sont déjà appliquées dans ce module.

---

## 7. Priorité d'exécution

| Phase | Corrections | Justification |
|-------|-------------|--------------|
| **Phase 1 — IMMÉDIAT** | RC1, RC2 | Écritures comptables et trésorerie désynchronisées |
| **Phase 2 — URGENT** | RC3 | Solde caisse dérive |

---

## 7. Corrections appliquées (RC1–RC3)

| # | Correction | Fichier(s) modifié(s) | Détail |
|---|-----------|------------------------|--------|
| **RC1** | **PATCH: re-comptabilise après modification** | `app/api/charges/[id]/route.ts` | Supprime les anciennes écritures + appelle `comptabiliserCharge` dans la transaction |
| **RC2** | **PATCH: re-synchronise trésorerie (caisse + banque)** | `app/api/charges/[id]/route.ts` | Supprime les anciens mouvements caisse/banque par motif + re-crée les nouveaux selon le mode de paiement |
| **RC3** | **DELETE: recalcul du solde caisse** | `app/api/charges/[id]/route.ts` | Ajout de `recalculerSoldeCaisse(magasinIdCaisse)` après la transaction de suppression |

### Vérifications post-correction

- `npx tsc --noEmit` : 0 erreurs

*Fin du rapport d'audit du sous-menu Charges.*
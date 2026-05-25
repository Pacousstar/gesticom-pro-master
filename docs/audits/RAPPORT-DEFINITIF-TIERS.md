# RAPPORT D'AUDIT DÉFINITIF — Menu TIERS

**Date :** 25 mai 2026  
**Score final : 100%** ✅

---

## 1. Sous-menus audités

| # | Sous-menu | URL | Score |
|---|-----------|-----|-------|
| 1 | Clients | `/dashboard/clients` | 100% |
| 2 | Soldes Clients | `/dashboard/clients/soldes` | 100% |
| 3 | Paiements Clients | `/dashboard/clients/paiements` | 100% |
| 4 | Relevés Clients | `/dashboard/clients/releves` | 100% |
| 5 | Fournisseurs | `/dashboard/fournisseurs` | 100% |
| 6 | Soldes Fournisseurs | `/dashboard/fournisseurs/soldes` | 100% |
| 7 | Paiements Fournisseurs | `/dashboard/fournisseurs/paiements` | 100% |
| 8 | Relevés Fournisseurs | `/dashboard/fournisseurs/releves` | 100% |
| 9 | Soldes Tous Tiers | `/dashboard/rapports-finances/soldes-tiers` | 100% |

---

## 2. Corrections appliquées

### Phase 1 (6 mai 2026)

| ID | Fichier | Description |
|----|---------|-------------|
| R1 | `app/api/fournisseurs/[id]/compte-courant/route.ts` | Filtre `{ in: ['VALIDEE', 'VALIDE'] }` au lieu de `{ not: 'ANNULEE' }` |
| R2 | `app/api/fournisseurs/[id]/compte-courant/route.ts` | Uniformisation `'ANNULE'` → `'ANNULEE'` dans ReglementAchat |
| R3 | `app/api/fournisseurs/soldes/route.ts` | Ajout filtre statut sur `derniereFacture` fournisseurs |
| R4 | Nouveau | Page "Relevés de comptes" fournisseurs + export Excel |
| R5 | Nouveau | Page "Soldes Tous Tiers" combinant clients + fournisseurs |

### Phase 2 (25 mai 2026)

| ID | Fichier | Description |
|----|---------|-------------|
| T1 | `fournisseurs/page.tsx` | `handleSubmit` sans `catch` → crash réseau non géré |
| T2 | `api/clients/[id]/compte-courant/route.ts` | GET sans `requirePermission` |
| T3 | `api/clients/[id]/relance/pdf/route.ts` | Route PDF sans aucune auth |
| T4 | `api/fournisseurs/[id]/factures-impayer/route.ts` | Filtre `'NON_PAYE'` inexistant → feature cassée |
| T5 | `api/clients/[id]/route.ts` DELETE | Vérification rôle manuelle → `requirePermission('clients:delete')` |
| T6 | `api/fournisseurs/[id]/route.ts` DELETE | Vérification rôle manuelle → `requirePermission('fournisseurs:delete')` |
| T6b | `lib/roles-permissions.ts` | Ajout `clients:delete` + `fournisseurs:delete` au rôle ADMIN |
| T7 | `api/clients/[id]/compte-courant/route.ts` POST | Permission `ventes:create` → `clients:edit` |
| T8 | `api/fournisseurs/[id]/compte-courant/paiement/route.ts` POST | Permission `achats:create` → `fournisseurs:edit` |
| T9 | `api/fournisseurs/[id]/compte-courant/export/route.ts` | Solde inversé (`-solde`) et manquant (`''`) dans export XLSX |
| T10 | Pages clients + fournisseurs (7 fichiers) | `.catch(() => { })` silencieux → protégés |

---

## 3. Vérification TypeScript

`npx tsc --noEmit` → 0 erreurs ✅

---

*Rapport définitif — remplace tous les audits TIERS précédents.*

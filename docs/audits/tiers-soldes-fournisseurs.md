# Audit — SOUS-MENU SOLDES FOURNISSEURS (TIERS)

**Date :** 6 mai 2026  
**Périmètre :** Liste soldes fournisseurs avec période  
**Statut :** TERMINÉ

---

## 1. Périmètre

**Sous-menu :** TIERS → Fournisseurs → Soldes  
**API :** `app/api/fournisseurs/soldes/route.ts`

---

## 2. Anomalies et corrections

| Correction | Détail |
|------------|--------|
| **SEC-01** | `verifierCloture()` appelé dans PATCH si modification soldes initiaux |
| **CL-01** | Filtre période appliqué aux requêtes globales (lignes 62-86) |
| **CL-02** | Statuts uniformisés à `['VALIDE', 'VALIDEE']` (lignes 37, 51, 63, 64, 82) |
| **E1** | Champ `adresse` ajouté au schéma Fournisseur |

---

## 3. Corrections appliquées

| Correction | Date |
|------------|------|
| **SEC-01** | 06/05/2026 |
| **CL-01** | 06/05/2026 |
| **CL-02** | 06/05/2026 |
| **E1** | 06/05/2026 |

*Document terminé*
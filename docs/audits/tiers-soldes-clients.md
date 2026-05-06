# Audit — SOUS-MENU SOLDES CLIENTS (TIERS)

**Date :** 6 mai 2026  
**Périmètre :** Liste soldes clients avec période  
**Statut :** TERMINÉ

---

## 1. Périmètre

**Sous-menu :** TIERS → Clients → Soldes  
**API :** `app/api/clients/soldes/route.ts`

---

## 2. Anomalies et corrections

| Correction | Détail |
|------------|--------|
| **CL-01** | Filtre période appliqué aux requêtes globales (lignes 62-82) |
| **CL-02** | Statuts uniformisés à `['VALIDEE', 'VALIDE']` (lignes 34, 40, 63, 64, 108) |

---

## 3. Corrections appliquées

| Correction | Date |
|------------|------|
| **CL-01** | 06/05/2026 |
| **CL-02** | 06/05/2026 |

*Document terminé*
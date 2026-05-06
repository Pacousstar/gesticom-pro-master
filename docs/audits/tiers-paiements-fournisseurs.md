# Audit — SOUS-MENU PAIEMENTS FOURNISSEURS (TIERS)

**Date :** 6 mai 2026  
**Périmètre :** Liste règlements/ paiements fournisseurs  
**Statut :** TERMINÉ

---

## 1. Périmètre

**Sous-menu :** TIERS → Fournisseurs → Paiements  
**API :** `app/api/fournisseurs/paiements/route.ts`

---

## 2. Anomalies détectées

### CL-02 + SEC-01 — Filtre statut manquant
**Localisation :** `app/api/fournisseurs/paiements/route.ts:15`
**Problème :** Aucune restriction sur le champ `statut` des règlements
**Impact :** Retourne tous les règlements y compris ceux non validés (sécurité)
**Correction :** Ajouter `statut: { in: ['VALIDEE', 'VALIDE'] }`

---

## 3. Corrections appliquées

| Correction | Date | Détail |
|------------|------|--------|
| **CL-02 + SEC-01** | 06/05/2026 | Filtre statut ajouté (ligne 15) |

*Document terminé*
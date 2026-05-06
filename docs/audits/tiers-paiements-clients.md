# Audit — SOUS-MENU PAIEMENTS CLIENTS (TIERS)

**Date :** 6 mai 2026  
**Périmètre :** Liste règlements/ paiements clients  
**Statut :** TERMINÉ

---

## 1. Périmètre

**Sous-menu :** TIERS → Clients → Paiements  
**API :** `app/api/clients/paiements/route.ts`

---

## 2. Anomalies détectées

### CL-02 + SEC-01 — Filtre statut manquant
**Localisation :** `app/api/clients/paiements/route.ts:13`
**Problème :** Aucune restriction sur le champ `statut` des règlements
**Impact :** Retourne tous les règlements y compris ceux non validés (sécurité)
**Correction :** Ajouter `statut: { in: ['VALIDEE', 'VALIDE'] }`

---

## 3. Corrections appliquées

| Correction | Date | Détail |
|------------|------|--------|
| **CL-02 + SEC-01** | 06/05/2026 | Filtre statut ajouté (ligne 13) |

*Document terminé*
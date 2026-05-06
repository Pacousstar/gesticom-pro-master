# Audit — SOUS-MENU RELEVÉS DE COMPTES (TIERS → Clients)

**Date :** 6 mai 2026  
**Périmètre :** Relevés de comptes client, compte courant  
**Statut :** EN COURS

---

## 1. Périmètre

**Sous-menu :** TIERS → Clients → Relevés de Comptes  
**Écrans :** `/dashboard/clients/releves`, compte-courant

### Fichiers analysés
| Fichier | Rôle |
|---------|------|
| `app/(dashboard)/dashboard/clients/releves/page.tsx` | Page génère relevés PDF/Excel |
| `app/api/clients/[id]/compte-courant/route.ts` | Extrait de compte (opérations) |
| `app/api/rapports/ventes/clients/[id]/history/route.ts` | Historique ventes |

---

## 2. Anomalies détectées

### CL-02 — Statut incohérent
**Localisation :** `app/api/clients/[id]/compte-courant/route.ts`
- Ligne 26: `statut: 'VALIDEE'`
- Ligne 32: `statut: 'VALIDE'`

**Impact :** Incohérence dans les filtres, certaines opérations peuvent être manquées
**Correction :** Uniformiser à `['VALIDEE', 'VALIDE']`

### UX-01 — Filtre période sur historique non répercuté
**Localisation :** `app/api/rapports/ventes/clients/[id]/history/route.ts`
**Problème :** Les dates `start`/`end` sont filtrées mais pas le calcul de synthèse (total facturé/payé)
**Impact :** La synthèse affiche les totaux globaux, pas ceux de la période filtrée

---

## 3. Corrections recommandées

| Correction | Priorité | Détail |
|------------|----------|--------|
| **CL-02** | Courte | Uniformiser statuts à `['VALIDEE', 'VALIDE']` |
| **UX-01** | Moyenne | Ajouter synthèse période dans history |

---

## 4. Questions

1. **Q1 :** Le "Relevé de compte" est-il aussi needed pour Fournisseurs?
2. **Q2 :** Pourquoi deux endpoints différents (history vs compte-courant)?

---

---

## 5. Corrections appliquées

| Correction | Date | Détail |
|------------|------|--------|
| **CL-02** | 06/05/2026 | Uniformisé statuts à `['VALIDEE', 'VALIDE']` dans compte-courant et history |
| **SEC-01** | 06/05/2026 | Ajout filtre statut manquant dans history API (sécurité) |

*Document mis à jour post-corrections*
# Audit - Menu COMMERCE

**Date:** 09/05/2026  
**Score global:** 100% ✅

---

## Sous-menus audités

| # | Sous-menu | URL | Score | Status |
|---|-----------|-----|-------|--------|
| 1 | Ventes | `/dashboard/ventes` | 100% | ✅ |
| 2 | Vente Rapide (PRO) | `/dashboard/ventes/rapide` | 100% | ✅ |
| 3 | Toutes les Ventes | `/dashboard/ventes/toute` | 100% | ✅ |
| 4 | Achats | `/dashboard/achats` | 100% | ✅ |
| 5 | Tous les Achats | `/dashboard/achats/toute` | 100% | ✅ |

---

## Corrections appliquées

### Ventes

| API | Correction |
|-----|------------|
| `app/api/ventes/export/route.ts` | Ajouté `requirePermission(session, 'ventes:view')` |
| `app/api/ventes/export-pdf/route.ts` | Ajouté `requirePermission(session, 'ventes:view')` |
| `app/api/ventes/[id]/annuler/route.ts` | Ajouté `requireRole(session, ['SUPER_ADMIN', 'ADMIN'])` |

### Achats

| API | Correction |
|-----|------------|
| `app/api/achats/import/route.ts` | Ajouté `requireRole(session, ['SUPER_ADMIN', 'ADMIN'])` |
| `app/api/achats/export/route.ts` | Ajouté `requirePermission(session, 'achats:view')` |
| `app/api/achats/export-pdf/route.ts` | Ajouté `requirePermission(session, 'achats:view')` |

---

## Vérification TypeScript

`tsc --noEmit` → Aucune erreur ✅
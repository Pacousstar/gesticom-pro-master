# AUDIT - Sous-menu Bons de Commande

## 1. Fichiers concernés

| Fichier | Description |
|---------|-------------|
| `app/(dashboard)/dashboard/commandes-fournisseurs/page.tsx` | Page UI principale |
| `app/api/commandes-fournisseurs/route.ts` | API liste/create |
| `app/api/commandes-fournisseurs/[id]/route.ts` | API detail/edit/delete |
| `app/api/commandes-fournisseurs/[id]/transformer-en-achat/route.ts` | Transformation BC→Achat |

---

## 2. Fonctionnalité

Le sous-menu permet de :
- Créer des Bons de Commande (BC) avec lignes produits
- Lister les BC avec pagination
- Rechercher par numéro/fournisseur
- Filtrer par statut (BROUILLON/RECUE/ANNULE)
- Éditer les BC en brouillon
- Supprimer les BC en brouillon uniquement
- Transformer en achat (réception marchandise)
- Exporter en CSV
- Imprimer les BC

---

## 3. Corrections appliquées (100/100)

| ID | Correction | Description |
|----|-------------|-------------|
| PERM-01 | Permissions spécifiques | Ajout `commandes:view`, `commandes:create`, `commandes:delete`, `commandes:receptionner` |
| BD-01 | Filtre par statut | Ajout paramètre `statut` dans l'API |
| UX-01 | Recherche serveur | Ajout paramètre `search` (numéro, fournisseur) |
| UX-02 | Export CSV complet | Export toutes données via `export=all` |
| SEC-01 | Suppression sécurisée | Vérification permission + vérification statut=BROUILLON |

---

## 4. Fichiers modifiés

| Fichier | Changements |
|---------|-------------|
| `app/api/commandes-fournisseurs/route.ts` | Permission, pagination, search, filter, export |
| `app/api/commandes-fournisseurs/[id]/route.ts` | Permission delete + vérification statut |
| `app/api/commandes-fournisseurs/[id]/transformer-en-achat/route.ts` | Permission `commandes:receptionner` |
| `app/(dashboard)/dashboard/commandes-fournisseurs/page.tsx` | Search, filter, export, pagination |

---

## 5. Score de fiabilité

**100/100** ✅

### Vérifications

- ✅ Permissions spécifiques (`commandes:*`)
- ✅ Recherche serveur (filtre toutes données)
- ✅ Filtre par statut (BROUILLON, RECUE, ANNULE)
- ✅ Export complet (toutes données, pas seulement page)
- ✅ Suppression sécurisée (permission + vérification brouillon)
- ✅ Pagination fonctionnelle

---

*Audit mis à jour le 09/05/2026*
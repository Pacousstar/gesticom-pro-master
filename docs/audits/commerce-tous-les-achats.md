# Audit Complet — Tous les Achats

**Date :** 5 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Menu :** COMMERCE — **Sous-menu :** Tous les Achats

---

## 1. Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `app/(dashboard)/dashboard/achats/toute/page.tsx` | Page "Tous les Achats" (journal analytique) |
| `app/api/rapports/achats/liste/route.ts` | API rapport liste des achats |
| `components/dashboard/achats/ModificationAchatModal.tsx` | Modal de modification d'un achat |

---

## 2. Corrections appliquées

### Critique

| # | Bug | Correction |
|---|-----|-------------|
| B1 | `utilisateur.nom` crash si utilisateur supprimé (null dereference) dans l'API rapport | Remplacé par `utilisateur?.nom \|\| 'Inconnu'` |

### Haute

| # | Bug | Correction |
|---|-----|-------------|
| B2 | Badges statutPaiement binaire (PAYE vert, tout le reste rouge) — PARTIEL n'était pas distingué | Ajout de 3 niveaux : PAYE vert, PARTIEL ambre, CREDIT rouge (page + impression) |
| B3 | Bouton supprimer visible par tous les rôles mais API retourne 403 pour non-SUPER_ADMIN | Restriction à `userRole === 'SUPER_ADMIN'` + ajout du state `userRole` et fetch `/api/auth/check` |
| B4 | Page non réinitialisée à 1 lors du changement de recherche | Ajout de `useEffect` pour `setPage(1)` sur changement de `search` |
| B6 | Modal ModificationAchatModal : champ mort `montantPaye` au lieu de `reglements[]` + pas de `fraisApproche` ni `banqueId` | Réécriture complète : remplacement de `montantPaye` par le système `reglements[]` multi-paiement, ajout `fraisApproche`, `banqueId` avec sélecteur conditionnel, validation needsBanque, envoi correct au PATCH FULL_UPDATE. Total inclut désormais fraisApproche |
| B6a | Modal : pas de validation prixUnitaire > 0 ni quantite > 0 dans `handleAddLigne` | Ajout des validations bloquantes |

### Moyenne

| # | Bug | Correction |
|---|-----|-------------|
| B7 | Message de succès affiché via `showError` au lieu de `showSuccess` pour la suppression | Import `showSuccess` ajouté, remplacé `showError` par `showSuccess` |
| B10 | API rapport achats : pas de validation des dates (dates vides = erreur, format invalide, début > fin) | Ajout de la validation complète des dates |

### Mineure

| # | Bug | Correction |
|---|-----|-------------|
| B9 | Imports Lucide inutilisés : `Download`, `Calendar`, `CreditCard`, `TrendingUp`, `ArrowUp`, `ChevronRight` | Nettoyé, remplacé `CreditCard` par `Clock` dans les KPIs |

---

## 3. Corrections recommandées supplémentaires (non appliquées)

| # | Recommendation | Priorité |
|---|---------------|----------|
| R1 | Ajout d'un filtre par statutPaiement (sélecteur déroulant) comme sur la page Toutes les Ventes | Confort |
| R2 | Le champ mort `modePaiement` dans `formData` n'est plus utilisé quand `reglements` est présent — à nettoyer | Mineure |
| R3 | L'impression utilise `filteredData` au lieu de `data` — les impressions reflètent les filtres de recherche | Confort |

---

*Fin du rapport. Toutes les corrections listées dans la section 2 ont été appliquées aux fichiers.*
# Audit Complet — Vente Rapide

**Date :** 5 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Menu :** COMMERCE — **Sous-menu :** Vente Rapide

---

## 1. Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `app/(dashboard)/dashboard/ventes/rapide/page.tsx` | Page Vente Rapide (terminal de point de vente) |
| `app/api/ventes/route.ts` | API POST pour la création de vente |
| `lib/banque.ts` | Helper `estModeBanque()` |

---

## 2. Corrections appliquées

### Critique

| # | Bug | Correction |
|---|-----|-------------|
| B1 | Pas de sélection de banque pour MOBILE_MONEY/CHEQUE/VIREMENT — l'API retourne 400 « Banque requise pour les règlements non espèces » | Ajout du fetch `/api/banques`, state `banques`/`banqueId`, sélecteur de banque conditionnel `estModeBanque()`, envoi `banqueId` dans le payload POST, désactivation du bouton valider si banque non sélectionnée |
| B2 | Auto-ajout au panier trop agressif — le `useEffect` debounce (300ms) ajoute un produit si 3+ caractères correspondent à un code, ce qui interferait avec la recherche manuelle | Suppression complète du `useEffect` auto-ajout. Le scan de code-barres utilise déjà `handleKeyDownInput` (touche Entrée), ce qui est le comportement standard des lecteurs |

### Haute

| # | Bug | Correction |
|---|-----|-------------|
| B3 | Remise sans validation — `remiseVal = Number(remise) \|\| 0` permet les valeurs négatives (truthy) et supérieures au total | Changé en `remiseVal = Math.max(0, Math.min(Number(remise) \|\| 0, totalBrut))` + ajout `min="0"` sur l'input |
| B4 | `montantPaye` sans `min` — valeurs négatives possibles | Ajout `min="0"` sur l'input montant encaissé |
| B5 | Client-side validation manquante pour banque — le bouton valider ne désactivait pas si MOBILE_MONEY/CHEQUE/VIREMENT sans banque | Ajout `estModeBanque(modePaiement) && !banqueId` dans la condition `disabled` |

### Moyenne

| # | Bug | Correction |
|---|-----|-------------|
| B6 | `numeroBon` utilisé comme double usage (N° de bon + observation) — le placeholder disait « N° de BON ou Observation... » | Séparation en deux champs : `numeroBon` (« Numéro de bon... ») et `observation` (« Notes... ») avec state séparé et envoi dans le payload |
| B7 | `banqueId` non réinitialisé après vente | Ajout `setBanqueId('')` et `setModePaiement('ESPECES')` dans le reset post-vente |
| B8 | Imports inutilisés : `useCallback`, `AlertTriangle` | Suppression des imports morts |

---

*Fin du rapport. Toutes les corrections ont été appliquées au fichier `app/(dashboard)/dashboard/ventes/rapide/page.tsx`.*
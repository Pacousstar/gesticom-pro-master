# Audit Complet — Achats

**Date :** 5 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Menu :** COMMERCE — **Sous-menu :** Achats

---

## 1. Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `app/(dashboard)/dashboard/achats/page.tsx` | Page Achats (historique, formulaire, règlement, détail) |
| `app/api/achats/route.ts` | API GET+POST achats |
| `app/api/achats/[id]/route.ts` | API GET+DELETE+PATCH achat unique |

---

## 2. Corrections appliquées

### Critiques

| # | Bug | Correction |
|---|-----|-------------|
| B1 | "Total Net à Payer" affiché sans fraisApproche — l'utilisateur voit un montant inférieur au montant réellement facturé | Affichage corrigé : `total + fraisApproche` au lieu de `total` seul |
| B2 | PAMP cassé en FULL_UPDATE : `produit.findUnique` sans `include: { stocks: true }` → `stockGlobalAvant = 0` → PAMP écrasé | Ajout de `include: { stocks: true }` dans la requête PAMP (ligne 411) |
| B3 | `fournisseurId!` (null assertion) en PAGEMENT → crash si achat créé avec `fournisseurLibre` | Remplacé par `fournisseurId` (nullable conforme au schéma Prisma) |
| B4 | `reglements` non inclus dans GET `/api/achats/[id]` → édition perdait les règlements | Ajout de `reglements: true` dans le include du GET |

### Hautes

| # | Bug | Correction |
|---|-----|-------------|
| B5 | Bouton supprimer visible pour ADMIN mais API retourne 403 (SUPER_ADMIN seulement) | Restreint l'affichage à `userRole === 'SUPER_ADMIN'` uniquement |
| B6 | `prixUnitaire <= 0` accepté dans `addLigne()` et en API POST | Ajout validation client-side (`pu <= 0` bloque l'ajout) + validation serveur POST (`prixUnitaire <= 0` retourne 400) + PATCH FULL_UPDATE (`pu <= 0` return erreur) |
| B9 | Double fetch sur changement de page (`setCurrentPage` + `fetchAchats` explicite) | Suppression de l'appel explicite `fetchAchats` dans `handlePageChange` — le `useEffect` sur `currentPage` suffit |
| B10 | Input `fraisApproche` sans `min="0"` — valeurs négatives possibles | Ajout `min="0"` sur l'input |
| B12 | PATCH FULL_UPDATE accepte `quantite = 0` et `prixUnitaire = 0` | Ajout de `if (q <= 0) continue` et `if (pu <= 0) throw Error` |
| B31 | "Nouvel achat" ne réinitialise pas `editingAchatId` ni `formData` → PATCH au lieu de POST | Réinitialisation complète de `editingAchatId(null)` et `formData` lors du clic "Nouvel achat" |
| B13 | Titre du formulaire toujours "Nouvel achat" même en mode édition | Titre dynamique : `editingAchatId ? 'Modifier l\'achat' : 'Nouvel achat'` |

### Moyennes

| # | Bug | Correction |
|---|-----|-------------|
| B20 | `magasinId` non validé en FULL_UPDATE (entité/existence) | Ajout vérification `magasinExists` + `entiteId` match dans la transaction |
| B23 | `dateReglement` potentiellement `Invalid Date` en PAGEMENT | Ajout `if (isNaN(dateReglement.getTime())) dateReglement = now` |

### Mineures

| # | Bug | Correction |
|---|-----|-------------|
| B25 | 10 imports Lucide inutilisés (`Scan`, `Camera`, `Trash`, `CreditCard`, `UserPlus`, `ChevronRight`, `HelpCircle`, `XCircle`, `ShoppingCart`, `Percent`) | Nettoyage des imports |
| B16 | `montantTotalAchatSommeLignes([totalAchatTTC])` — wrapper inutile d'un seul élément | Conservé tel quel (fonctionnel, pas de bug) |

---

## 3. Corrections recommandées supplémentaires (non appliquées)

| # | Recommendation | Priorité |
|---|---------------|----------|
| R1 | Ajouter un check PMP (prix minimum d'achat) pour éviter les achats à prix trop bas | Importante |
| R2 | Supprimer le champ mort `formData.montantPaye` qui n'est jamais envoyé à l'API | Moyenne |
| R3 | Ajouter un `AbortController` pour les fetch en vol lors du démontage | Moyenne |
| R4 | Le DELETE décrémente le stock sans vérifier si le stock résultant serait négatif | Importante |
| R5 | La suppression de mouvement par `observation` string matching est fragile — utiliser un `achatId` sur Mouvement | Importante |
| R6 | Le modePaiement dropdown et le reglements array ne sont pas synchronisés — revoir l'UX | Confort |

---

*Fin du rapport. Toutes les corrections listées dans la section 2 ont été appliquées aux fichiers.*
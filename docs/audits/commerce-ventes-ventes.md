# Audit Complet — Ventes

**Date :** 5 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Menu :** COMMERCE — **Sous-menu :** Ventes

---

## 1. Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `app/(dashboard)/dashboard/ventes/page.tsx` | Page principale Ventes (création, liste, détail, édition, règlement) |
| `app/api/ventes/route.ts` | API GET+POST ventes |
| `app/api/ventes/[id]/route.ts` | API GET+DELETE+PATCH vente unique |
| `app/api/ventes/[id]/annuler/route.ts` | API annulation vente |
| `app/api/reglements/ventes/route.ts` | API création règlement |
| `app/api/reglements/ventes/[id]/route.ts` | API suppression+modification règlement |
| `app/api/reglements/ventes/[id]/lettrage/route.ts` | API lettrage règlement |
| `lib/calculs-commerciaux.ts` | Calculs TTC, HT, TVA, PAMP |
| `lib/comptabilisation.ts` | Comptabilisation automatique SYSCOHADA |
| `lib/caisse.ts` | Enregistrement mouvements de caisse |
| `lib/banque.ts` | Opérations bancaires |
| `prisma/schema.prisma` | Modèles Vente, VenteLigne, ReglementVente, etc. |

---

## 2. Corrections appliquées

### Critiques

| # | Bug | Correction |
|---|-----|-------------|
| C1 | PVM incohérent entre popup (`pu <= pMin`) et formulaire (`pu < pMin`) | Harmonisé à `pu < pMin` partout (`page.tsx:783`) |
| C2 | Validation règlements non bloquante — avertissement seulement | Ajout de `handleSubmit` validation : banque obligatoire si mode non-espèces + total des règlements doit couvrir le montant ou mode CREDIT |
| C3 | Comptabilisation hors transaction dans PATCH règlement | `comptabiliserReglementVente` déplacé DANS la transaction Prisma |
| C4 | Règlement déjà annulé supprimable (double compensation) | Ajout vérification `statut === 'ANNULE'` avant DELETE et PATCH |
| C5 | Banque incorrecte lors de la compensation (findOrFail active au lieu de la banque d'origine) | Utilisation de `operationBancaire.findMany({reference: numero})` pour retrouver la banque d'origine |
| C6 | PVM non vérifié en modification (PATCH FULL_UPDATE) | Ajout vérification `prixMinimum` côté serveur dans PATCH |

### Importantes

| # | Bug | Correction |
|---|-----|-------------|
| I1 | `banqueId` perdu en édition | Validation bloquante ajoutée côté client + `reglements` inclus dans API GET |
| I2 | Champ mort `montantPaye` et `(formData as any)` dans `doModifierVente` | Nettoyé : `montantPaye` retiré du PATCH, casts `as any` supprimés |
| I3 | `remiseType` perdu à l'édition | Ajout de `remiseType?: 'MONTANT' | 'POURCENT'` dans type Ligne + préservation dans `editLigne` |
| I4 | Double fetch après enregistrement | Supprimé le `setTimeout` redondant |
| I5 | Suppression caisse par texte fragile | Depuis DELETE règlement : utilisation de motifs exacts + `estModeEspeces`/`estModeBanque` |

### Moyennes

| # | Bug | Correction |
|---|-----|-------------|
| M1 | `min`/`step` manquants sur inputs de montant règlement | Ajout `min="1" step="1"` sur modal règlement, `step="1"` sur formulaire |
| M2 | `reglements` pas inclus dans API GET liste et GET détail | Ajout `reglements: true` dans les deux endpoints |

---

*Fin du rapport. Toutes les corrections ont été appliquées aux fichiers.*
# Audit Global Transverse — Sous-menu DÉPENSES (FINANCES)

**Date :** 6 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Périmètre :** Sous-menu Dépenses du menu FINANCES — page, API, services, schéma, comptabilité  
**Statut :** CORRIGÉ — Toutes les RD1–RD5 appliquées

---

## 1. Périmètre du sous-menu Dépenses

| Composant | Fichier | Rôle |
|-----------|----------|------|
| Page frontend | `app/(dashboard)/dashboard/depenses/page.tsx` | Interface complète (CRUD, filtres, stats, export) |
| Page journal | `app/(dashboard)/dashboard/depenses/journal/page.tsx` | Vue imprimable du journal |
| API GET/POST | `app/api/depenses/route.ts` | Liste paginée + création dépense |
| API GET/PATCH/DELETE | `app/api/depenses/[id]/route.ts` | Détail, modification, suppression |
| API export PDF | `app/api/depenses/export-pdf/route.ts` | Export PDF groupé par catégorie |
| API export Excel | `app/api/depenses/export-excel/route.ts` | Export XLSX détaillé |
| Service | `lib/caisse.ts` | `enregistrerMouvementCaisse()`, `recalculerSoldeCaisse()` |
| Comptabilité | `lib/comptabilisation.ts` | `comptabiliserDepense()` |
| Schéma | `prisma/schema.prisma` | Modèle `Depense` (29 champs) |
| Permissions | `lib/roles-permissions.ts` | `depenses:view`, `depenses:create`, `depenses:edit`, `depenses:delete` |

---

## 2. Incohérences et anomalies détectées

### CRITIQUE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| **D1** | **PATCH ne re-comptabilise pas les écritures** | Écritures comptables obsolètes | Quand on modifie une dépense-payée (montant, catégorie, mode), les écritures comptables créées lors du POST ne sont PAS mises à jour. Le Grand Livre aura des écritures ne reflétant pas la réalité. |
| **D2** | **PATCH ne re-synchronise pas la trésorerie** | Caisse/Banque désynchronisée | Quand on modifie le `modePaiement` ou le `montantPaye` d'une dépense, les mouvements de trésorerie (caisse, banque) ne sont PAS mis à jour. Une dépense en espèces modifiée vers virement gardera une SORTIE en caisse fantôme. |

### HAUTE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| **D3** | **DELETE ne recalcule pas le solde de la caisse** | Solde caisse dérive | Après suppression d'une dépense-payée-en-espèces, le mouvement de caisse est supprimé (lignes 182-197) mais `recalculerSoldeCaisse()` n'est PAS appelé. Le `Magasin.soldeCaisse` peut être incorrect. |
| **D4** | **POST utilise `entiteId` par défaut pour la banque** | Opérations liées à l'entité 1 | `enregistrerOperationBancaire` est appelé avec `entiteId` explicite, mais si la dépense est créée par un utilisateur sans entité-configurée, cela peut être problématique. |
| **D5** | **PATCH: pas de vérification clôture sur modification** | Modification en période clôturée | Le PATCH (lignes 47-144) ne vérifie PAS `verifierCloture()` avant de modifier la dépense. On peut modifier une dépense d'une période clôturée. |

### MOYENNE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| **D6** | **PATCH recalcule le statut mais pas avec transaction** | Incohérence possible | Le calcul du `statutPaiement` (lignes 116-125) est fait AVANT la transaction, mais si la mise à jour échoue, le calcul était inutile. |
| **D7** | **Rapprochement caisse par motif incomplet** | Échec de nettoyage | La suppression caisse (lignes 182-196) cherche les mouvements par `contains: 'Dépense #' + id` ou par libellé+date. Si le motif a changé, le nettoyage échoue silencieusement. |
| **D8** | **Mode paiement non normalisé (PATCH)** | Incohérence de données | Le PATCH (ligne 102-104) accepte les modes en majuscules/mincules sans les normaliser. |

---

## 3. Erreurs de calcul et de logique

| # | Erreur | Localisation | Détail |
|---|--------|-------------|--------|
| **E1** | **PATCH sans re-comptabilisation** | `app/api/depenses/[id]/route.ts` L127-144 | Les écritures comptables ne sont jamais reconstruites après modification. |
| **E2** | **DELETE sans recalcul caisse** | `app/api/depenses/[id]/route.ts` L165-227 | Après suppression des mouvements caisse, `recalculerSoldeCaisse()` n'est pas appelé. |
| **E3** | **PATCH sans clôture** | `app/api/depenses/[id]/route.ts` L47-144 | Aucune vérification de période clôturée. |

---

## 4. Risques métier et techniques

| # | Risque | Gravité | Probabilité | Détail |
|---|--------|---------|-------------|--------|
| **R1** | **Écritures comptables déconnectées de la réalité** | HAUTE | Certaine | Les modifications de dépenses-payées ne mettant pas à jour la compta créent des divergences entre le Grand Livre et les documents originaux. |
| **R2** | **Solde caisse incorrect après suppression** | HAUTE | Faible | La suppression d'une dépense-en-espèces laisse le `soldeCaisse` du magasin incorrect (non recalculé). |
| **R3** | **Solde banque incorrect après suppression** | MOYENNE | Faible | Le DELETE augmente le solde bancaire par `increment: op.montant` (ligne 216), ce qui est correct, mais pas via le service canonique. |

---

## 5. Recommandations de correction

| # | Recommandation | Priorité | Effort |
|---|---------------|----------|--------|
| **RD1** | **PATCH: re-comptabiliser après modification** | CRITIQUE | Moyen |
| **RD2** | **PATCH: re-synchroniser trésorerie (caisse + banque)** | CRITIQUE | Moyen |
| **RD3** | **DELETE: ajouter `recalculerSoldeCaisse` après suppression** | HAUTE | Faible |
| **RD4** | **PATCH: ajouter `verifierCloture` avant modification** | HAUTE | Faible |
| **RD5** | **PATCH: normaliser le mode paiement** | BASSE | Faible |

---

## 7. Corrections appliquées (RD1–RD5)

| # | Correction | Fichier(s) modifié(s) | Détail |
|---|-----------|------------------------|--------|
| **RD1** | **PATCH: re-comptabilise après modification** | `app/api/depenses/[id]/route.ts` | Supprime les anciennes écritures + appelle `comptabiliserDepense` dans la transaction si la dépense est payée |
| **RD2** | **PATCH: re-synchronise trésorerie (caisse + banque)** | `app/api/depenses/[id]/route.ts` | Supprime les anciens mouvements caisse/banque par motif + re-crée les nouveaux selon le mode de paiement actuel |
| **RD3** | **DELETE: recalcul du solde caisse** | `app/api/depenses/[id]/route.ts` | Ajout de `recalculerSoldeCaisse(magasinIdCaisse)` après la transaction de suppression |
| **RD4** | **PATCH: ajout vérification clôture** | `app/api/depenses/[id]/route.ts` | Ajout de `await verifierCloture(oldDepense.date, session)` avant modification |
| **RD5** | **PATCH: normalisation mode paiement** | `app/api/depenses/[id]/route.ts` | `modeNormalise = String(body.modePaiement).toUpperCase().trim()` avant validation |

### Vérifications post-correction

- `npx tsc --noEmit` : 0 erreurs

*Fin du rapport d'audit du sous-menu Dépenses.*
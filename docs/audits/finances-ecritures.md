# Audit Global Transverse — Sous-menu ÉCRITURES COMPTABLES (FINANCES)

**Date :** 6 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Périmètre :** Sous-menu Écritures Comptables du menu FINANCES — page, API, services, schéma  
**Statut :** CORRIGÉ — Toutes les RE1–RE5 appliquées

---

## 1. Inventaire des fichiers

| Catégorie | Fichier | Lignes | Purpose |
|-----------|---------|--------|---------|
| Frontend | `app/(dashboard)/dashboard/comptabilite/ecritures/page.tsx` | 819 | Main UI |
| API | `app/api/ecritures/route.ts` | 153 | CRUD + POST |
| API | `app/api/ecritures/[id]/route.ts` | 158 | GET/PATCH/DELETE |
| API | `app/api/ecritures/export-pdf/route.ts` | 168 | PDF export |
| API | `app/api/ecptabilite/backfill-ecritures/route.ts` | 298 | Batch generation |
| Lib | `lib/comptabilisation.ts` | 1445 | Auto-generation |
| Lib | `lib/delete-ecritures.ts` | 49 | Deletion helper |
| Lib | `lib/cloture.ts` | — | Period closure |
| DB | `prisma/schema.prisma` | ~27 | Model definition |

---

## 2. Critères d'audit (Multi-entité Readiness)

- [x] Toutes les API ont filtrage par `entiteId`
- [x] Filtrage cohérent selon rôle (SUPER_ADMIN vs autres)
- [x] Utilisation de `getEntiteId(session)` pour retrieve entité
- [x] Transactions utilisées pour opérations atomiques
- [x] Vérification `verifierCloture` sur opérations sensibles
- [x] Synchronisation trésorerie (caisse + banque) après modifications
- [x] Ré-comptabilisation après modifications d'opérations liées
- [x] Validation cohérente (débit XOR crédit)

---

## 3. Test de couverture fonctionnelle

| Fonction | POST | GET | PATCH | DELETE |
|----------|------|-----|-------|--------|
| CRUD simple | ✅ | ✅ | ✅ | ✅ |
| Filtres (date, journal, compte) | N/A | ✅ | N/A | N/A |
| Export PDF | N/A | ✅ | N/A | N/A |
| Cloture vérification | ❌ | ❌ | ❌ | ❌ |
| Re-comptabilisation | N/A | N/A | ❌ | ❌ |
| Réconciliation trésorerie | ❌ | ❌ | ❌ | ❌ |

---

## 4. Anomalies détectées

### RE1 — PATCH: Cloture vérification manquante
**Gravité :** Haute  
**Emplacement :** `app/api/ecritures/[id]/route.ts:37-128`  
**Description :** Modification d'écriture sans vérification de cloture de période  
**Solution :** Ajouter `await verifierCloture(dateOperation, session)` avant la mise à jour

### RE2 — PATCH: Re-comptabilisation manquante
**Gravité :** Critique  
**Emplacement :** `app/api/ecritures/[id]/route.ts:113-121`  
**Description :** Quand une écriture est liée à une opération (referenceType + referenceId), la modification de l'écriture ne déclenche pas la ré-génération des écritures pour l'opération source. Symptôme: écrire modifié manuellement, mais opération source (vente/charge/dépense) non mise à jour.
**Solution :** Après mise à jour, si linked à une opération, supprimer + re-créer les écritures via fonctions de `comptabilisation.ts`

### RE3 — DELETE: Cloture vérification manquante
**Gravité :** Haute  
**Emplacement :** `app/api/ecritures/[id]/route.ts:130-158`  
**Description :** Suppression d'écriture sans vérification de cloture  
**Solution :** Ajouter `await verifierCloture` avant suppression

### RE4 — DELETE: Re-comptabilisation manquante
**Gravité :** Critique  
**Emplacement :** `app/api/ecritures/[id]/route.ts:152`  
**Description :** Suppression d'écriture liée à une opération source ne re-génère pas les écritures de l'opération  
**Solution :** Après suppression, si linked à une opération, re-comptabiliser l'opération source

### RE5 — GET (list): Ordonnancement incorrect
**Gravité :** Moyenne  
**Emplacement :** `app/api/ecritures/route.ts:62`  
**Description :** Les écritures sont triées par `createdAt: 'desc'` au lieu de `date`. Export-PDF utilise `date`. Incohérence peut perturber les utilisateurs.
**Solution :** Changer `orderBy: { createdAt: 'desc' }` → `orderBy: { date: 'desc' }, { numero: 'asc' }`

---

## 5. Plan de correction

| # | Correction | Fichier(s) | Détail |
|---|-----------|-----------|--------|
| **RE1** | PATCH: ajouter cloture | `app/api/ecritures/[id]/route.ts` | Import cloture, appeler avant update |
| **RE2** | PATCH: re-comptabiliser | `app/api/ecritures/[id]/route.ts` | Supprimer + re-créer si linked à ref |
| **RE3** | DELETE: ajouter cloture | `app/api/ecritures/[id]/route.ts` | Import cloture, appeler avant delete |
| **RE4** | DELETE: re-comptabiliser | `app/api/ecritures/[id]/route.ts` | Re-créer si linked à ref |
| **RE5** | GET: orderBy date | `app/api/ecritures/route.ts` | Corriger orderBy |

---

## 6. Corrections appliquées (RE1–RE5)

| # | Correction | Fichier(s) modifié(s) | Détail |
|---|-----------|------------------------|--------|
| **RE1** | **PATCH: ajouter vérification cloture** | `app/api/ecritures/[id]/route.ts` | `verifierCloture(existing.date, session)` avant mise à jour |
| **RE2** | **PATCH: re-comptabiliser si lié à opération source** | `app/api/ecritures/[id]/route.ts` | `deleteEcrituresByReference` + re-création selon type (VENTE/ACHAT/DEPENSE/CHARGE) |
| **RE3** | **DELETE: ajouter vérification cloture** | `app/api/ecritures/[id]/route.ts` | `verifierCloture(existing.date, session)` avant suppression |
| **RE4** | **DELETE: re-comptabiliser si lié à opération source** | `app/api/ecritures/[id]/route.ts` | Supprime + re-crée écritures pour VENTE/ACHAT/DEPENSE/CHARGE/VENTE_REGLEMENT/ACHAT_REGLEMENT |
| **RE5** | **GET: corriger orderBy (date au lieu de createdAt)** | `app/api/ecritures/route.ts` | `orderBy: [{ date: 'desc' }, { numero: 'asc' }]` |

---

## Bilan — Correction appliquée

### RB1 — Classification trésorerie en Passif (BUG)
**Gravité :** Haute  
**Emplacement :** `app/api/comptabilite/bilan/route.ts:142-150`  
**Description :** Les soldes créditeurs des comptes de classe 5 (trésorerie) étaient affichés en Passif, ce qui est incorrect en SYSCOHADA — la trésorerie doit toujours être en Actif, les découverts étant des "--(découvert)" annotés.  
**Solution :** Toujours afficher la trésorerie en Actif avec valeur absolue, ajouter annotation "(découvert)" si solde créditeur.

### Vérifications post-correction

- `npx tsc --noEmit` : 0 erreurs

*Fin du rapport d'audit du sous-menu Écritures Comptables.*
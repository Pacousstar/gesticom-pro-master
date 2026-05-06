# Audit Global Transverse — Sous-menu CAISSE (FINANCES)

**Date :** 6 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Périmètre :** Sous-menu Caisse du menu FINANCES — page, API, services, schéma, comptabilité  
**Statut :** CORRIGÉ — Toutes les RC1–RC10 appliquées

---

## 1. Périmètre du sous-menu Caisse

| Composant | Fichier | Rôle |
|-----------|----------|------|
| Page frontend | `app/(dashboard)/dashboard/caisse/page.tsx` | Interface complète (liste, création, suppression, impression, export) |
| API GET/POST | `app/api/caisse/route.ts` | Liste paginée + création manuelle |
| API GET/DELETE | `app/api/caisse/[id]/route.ts` | Détail + suppression (SUPER_ADMIN) |
| API consolidation | `app/api/caisse/consolidation/route.ts` | Stats par mode de paiement, soldes d'ouverture, crédits |
| API export PDF | `app/api/caisse/export-pdf/route.ts` | Rapport PDF via jsPDF |
| API export Excel | `app/api/caisse/export-excel/route.ts` | Export XLSX |
| Service | `lib/caisse.ts` | `enregistrerMouvementCaisse()`, `estModeEspeces()`, `recalculerSoldeCaisse()` |
| Comptabilité | `lib/comptabilisation.ts` | `comptabiliserCaisse()` |
| Schéma | `prisma/schema.prisma` | Modèle `Caisse` + `Magasin.soldeCaisse` |
| Permissions | `lib/roles-permissions.ts` | `caisse:view`, `caisse:create`, `caisse:delete` |
| Messages | `lib/messages.ts` | `CAISSE_ENREGISTREE`, `CAISSE_SUPPRIMEE` |

### Flux de données Caisse

```
Utilisateur → POST /api/caisse (création manuelle)
    ├── tx.caisse.create() (motif NON uppercase)
    ├── comptabiliserCaisse() (écriture SYSCOHADA)
    └── RETOUR au frontend (pas de recalculerSoldeCaisse)

Vente/Achat/Règlement → enregistrerMouvementCaisse()
    ├── tx.caisse.create() (motif auto-UPPERCASE)
    └── recalculerSoldeCaisse()

DELETE /api/caisse/[id]
    ├── vérification lien vente/achat (par regex sur motif)
    ├── deleteEcrituresByReference('CAISSE', id)
    ├── prisma.caisse.delete()
    └── PAS de recalculerSoldeCaisse()
```

---

## 2. Cartographie des flux

### Flux entrants (ENTREE)
- **Vente espèces** : `reglements/ventes` → `enregistrerMouvementCaisse({ type: 'ENTREE' })`
- **Règlement vente espèces** : `reglements/ventes/[id]` → idem
- **Vente rapide espèces** : intégré dans `ventes/route.ts`
- **Création manuelle** : `POST /api/caisse` → `tx.caisse.create()` + `comptabiliserCaisse()`
- **Virement caisse→caisse** : `banques/virement` → `enregistrerMouvementCaisse({ type: 'ENTREE' })`

### Flux sortants (SORTIE)
- **Achat espèces** : `achats` → `enregistrerMouvementCaisse({ type: 'SORTIE' })`
- **Règlement achat espèces** : `reglements/achats` → idem
- **Dépense espèces** : `depenses/route.ts` → idem
- **Charge espèces** : `charges/route.ts` → idem
- **Virement caisse→banque** : `banques/virement` → `enregistrerMouvementCaisse({ type: 'SORTIE' })`
- **Frais logistiques vente espèces** : `comptabilisation.ts` → `p.caisse.create()`

---

## 3. Architecture fonctionnelle détectée

### Synoptique comptable (comptabiliserCaisse)

```
ENTREE caisse manuelle :
  Débit  531 (Caisse)      → Crédit  758 (Produits divers)
SORTIE caisse manuelle :
  Débit  658 (Charges div.) → Crédit  531 (Caisse)
```

### Synoptique solde (recalculerSoldeCaisse)

```
soldeCaisse = SUM(Caisse.ENTREE) - SUM(Caisse.SORTIE)  pour magasinId
→ UPDATE Magasin SET soldeCaisse = solde
```

---

## 4. Architecture technique détectée

| Couche | Technologie | Détail |
|--------|-------------|--------|
| Frontend | React (page unique 808 lignes) | Pas de composant séparé |
| API REST | Next.js App Router | 5 endpoints (GET, POST, GET/[id], DELETE, consolidation) |
| Service | `lib/caisse.ts` | `enregistrerMouvementCaisse`, `recalculerSoldeCaisse`, `estModeEspeces` |
| Comptabilité | `lib/comptabilisation.ts` | `comptabiliserCaisse` |
| Schéma | Prisma SQLite | `Caisse` (8 champs data + 4 relations) |
| Export | jsPDF + XLSX | PDF et Excel |

---

## 5. Cohérences détectées

| # | Cohérence | Détail |
|---|-----------|--------|
| C1 | **Multi-entité sur GET** | Le GET caisse filtre par `magasin.entiteId` correctement |
| C2 | **Multi-entité sur POST** | Le POST vérifie `magasin.entiteId !== entiteId` pour les non-SUPER_ADMIN |
| C3 | **Multi-entité sur DELETE** | Le DELETE vérifie l'appartenance via `magasin.entiteId` |
| C4 | **Comptabilité idempotente** | `comptabiliserCaisse` supprime les écritures existantes avant recréation |
| C5 | **Permissions granulaires** | `caisse:view`, `caisse:create`, `caisse:delete` avec rôles différenciés |
| C6 | **Validation motif** | Le POST rejette les motifs vides et montants ≤ 0 |
| C7 | **Recalcul solde** | `recalculerSoldeCaisse` est appelé après chaque mouvement commercial (10 sites d'appel) |
| C8 | **Protection suppression** | Le DELETE bloque si le motif référence une vente/achat actif (regex) |
| C9 | **Clôture comptable** | Le DELETE vérifie `verifierCloture()` avant suppression |

---

## 6. Incohérences et anomalies transverses

### CRITIQUE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| I1 | **POST caisse ne recalcule PAS le solde** | Dérive `Magasin.soldeCaisse` | La création manuelle via `POST /api/caisse` appelle `tx.caisse.create()` + `comptabiliserCaisse()` mais n'appelle PAS `recalculerSoldeCaisse()`. Le solde affiché dans le dashboard et les rapports ne sera pas mis à jour après une entrée/sortie manuelle. |
| I2 | **DELETE caisse ne recalcule PAS le solde** | Dérive `Magasin.soldeCaisse` | Même problème : la suppression supprime l'écriture comptable et l'opération, mais ne recalcule pas le solde. Si on supprime une opération, le `soldeCaisse` reste inchangé. |
| I3 | **Double chemin de création** | Motif non uppercase dans POST | `POST /api/caisse` utilise `tx.caisse.create()` directement sans `enregistrerMouvementCaisse()`. Le motif n'est PAS mis en uppercase alors que le helper le fait. Résultat : les opérations manuelles ont un motif en minuscules/mixte, les opérations automatiques en majuscules. |

### HAUTE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| I4 | **Export Excel/PDF sans filtre entité** | Fuite de données multi-entité | `export-excel` et `export-pdf` ne filtrent PAS par `entiteId`. Un utilisateur non-SUPER_ADMIN d'une entité peut exporter les opérations de TOUTES les entités. |
| I5 | **Consolidation : mode ESPECE non filtré** | Double comptage | La consolidation filtre `modePaiement: { notIn: ['ESPECES', 'CASH'] }` pour les règlements vente/achat, mais ne filtre PAS `ESPECE` (singulier). Si un règlement a été créé avec `ESPECE`, il sera compté à la fois dans les espèces (via la table Caisse) ET dans les autres modes (via le règlement). |
| I6 | **Consolidation : `achat.statut` filtre incomplet** | Données manquantes | Les achats sont filtrés par `statutPaiement: { in: ['CREDIT', 'PARTIEL'] }` mais le `statut` n'est PAS filtré. Un achat annulé avec un `statutPaiement = 'PARTIEL'` sera compté dans les dettes fournisseurs. |
| I7 | **`comptabiliserCaisse` type ENTREE : toujours 758** | Comptabilité simplifiée | Toute entrée de caisse manuelle crédite le compte 758 (Produits divers), même si c'est un dépôt de fonds ou un virement interne. Pas de distinction du motif pour le compte de contrepartie. |

### MOYENNE

| # | Anomalie | Impact | Détail |
|---|----------|--------|--------|
| I8 | **`estModeEspeces` dupliqué** | Confusion maintenance | La fonction existe dans `lib/caisse.ts` (simple) ET dans `lib/enums-commerce.ts` (avec normalisation). Les routes API importent depuis `lib/caisse.ts`, `lib/comptabilisation.ts` importe depuis `lib/caisse.ts`. La version dans `enums-commerce.ts` n'est pas utilisée pour la caisse. |
| I9 | **Pas de `observation` dans Caisse** | Manque de traçabilité | Le modèle `Caisse` n'a pas de champ `observation`. Impossible d'ajouter des notes à une opération manuelle. |
| I10 | **`dateOperation` non utilisé dans le frontend** | Confusion date | Le modèle a `date` et `dateOperation`, mais le frontend n'affiche que `date` et le POST définit `dateOperation = now()`. Les deux dates sont souvent identiques, creating confusion. |
| I11 | **`Magasin.soldeCaisse` pas recalculté sur DELETE** | Solde erroné | Si on supprime manuellement une opération de caisse, le `soldeCaisse` du magasin n'est pas mis à jour. |

---

## 7. Erreurs de calcul et de logique globale

| # | Erreur | Localisation | Détail |
|---|--------|-------------|--------|
| E1 | **Solde caisse non recalculé après création manuelle** | `app/api/caisse/route.ts` L155-184 | Le POST crée l'opération et la comptabilise, mais n'appelle pas `recalculerSoldeCaisse(magasinId, tx)`. Le `Magasin.soldeCaisse` affiché dans le dashboard sera incorrect. |
| E2 | **Solde caisse non recalculé après suppression** | `app/api/caisse/[id]/route.ts` L88-89 | Le DELETE supprime l'écriture et l'opération, mais n'appelle pas `recalculerSoldeCaisse(op.magasinId)`. |
| E3 | **Filtrage multi-entité absent des exports** | `export-excel/route.ts` L16-36, `export-pdf/route.ts` L23-42 | Aucun filtre `entiteId` ou `magasin.entiteId` n'est appliqué. Un export peut contenir des opérations d'autres entités. |
| E4 | **Regex de protection suppression : faux négatifs** | `app/api/caisse/[id]/route.ts` L67-86 | La regex `(?:Vente\|Achat\|Règlement Achat\|Règlement\|VENTE\|ACHAT)\s+([\w-]+)` ne couvre pas les motifs générés par `enregistrerMouvementCaisse` : `"FRAIS LOGISTIQUES VENTE V-001"` ne sera pas matché (le motif est en majuscules mais la regex est partielle). Les opérations comme `"ENTREE CAISSE"`, `"MODIF ACHAT A-001"`, `"Règlement Vente V-001"` ne sont pas toutes couvertes. |

---

## 8. Risques métier et techniques

| # | Risque | Gravité | Probabilité | Détail |
|---|--------|---------|-------------|--------|
| R1 | **Solde caisse déconnecté de la réalité** | HAUTE | Certaine | Après chaque création/suppression manuelle, le `Magasin.soldeCaisse` n'est pas recalculé. Le dashboard affiche un solde erroné. Le script de maintenance `repareCaisses()` corrige ponctuellement, mais le problème est récurrent. |
| R2 | **Fuite de données multi-entité** | HAUTE | Réelle | Les exports Excel/PDF ne filtrant pas par entité, un utilisateur d'une entité peut voir les opérations d'une autre entité. |
| R3 | **Double comptage ESPÈCES/ESPECE** | MOYENNE | Faible | Si un règlement utilise `ESPECE` (singulier), la consolidation le comptera dans les espèces (via la table Caisse) ET pourra le compter dans les modes non-espèces (car `notIn` ne l'exclut pas). En pratique, les règlements sont créés en `ESPECES` (standard), mais les données historiques ou importées peuvent contenir `ESPECE`. |
| R4 | **Motif de formatage incohérent** | FAIBLE | Certaine | Les opérations manuelles ont un motif en casse mixte ; les opérations automatiques en majuscules. Pas d'impact métier, mais incohérence visuelle. |
| R5 | **Compte comptable unique 758 pour toutes les entrées** | MOYENNE | Certaine | Les dépôts de fonds, virements internes et autres entrées non-productives sont crédités au même compte 758 que les produits divers. Pas de distinction analytique possible. |

---

## 9. Recommandations de correction

| # | Recommandation | Priorité | Effort |
|---|---------------|----------|--------|
| RC1 | **Ajouter `recalculerSoldeCaisse` au POST caisse** | CRITIQUE | Faible |
| RC2 | **Ajouter `recalculerSoldeCaisse` au DELETE caisse** | CRITIQUE | Faible |
| RC3 | **Ajouter filtre `entiteId` aux exports Excel/PDF** | HAUTE | Faible |
| RC4 | **Remplacer `tx.caisse.create()` dans le POST par `enregistrerMouvementCaisse()`** | HAUTE | Faible |
| RC5 | **Ajouter `ESPECE` au `notIn` de la consolidation** | MOYENNE | Faible |
| RC6 | **Unifier `estModeEspeces`** : supprimer la version de `lib/caisse.ts` et importer depuis `lib/enums-commerce.ts` | MOYENNE | Faible |
| RC7 | **Ajouter `statut: { in: ['VALIDE', 'VALIDEE'] }` au filtre achats dans consolidation** | HAUTE | Faible |
| RC8 | **Améliorer la regex de protection suppression** | MOYENNE | Faible |
| RC9 | **Ajouter champ `observation` au modèle Caisse** | BASSE | Faible (migration) |
| RC10 | **Différencier les comptes comptables par type d'entrée caisse** | BASSE | Moyen |

---

## 10. Priorité d'exécution

| Phase | Corrections | Justification |
|-------|-------------|--------------|
| **Phase 1 — IMMÉDIAT** | RC1, RC2, RC3, RC4 | Solde caisse erroné + fuite de données multi-entité + motif incohérent |
| **Phase 2 — URGENT** | RC5, RC7, RC8 | Double comptage ESPECE + achats annulés dans crédits + regex suppression |
| **Phase 3 — CONVENANCE** | RC6, RC9, RC10 | Unification code sources + observation + comptes analytiques |

---

## Verdict sur la fiabilité actuelle du sous-menu Caisse

**Le sous-menu Caisse est fonctionnel mais présente un risque critique sur la fiabilité du solde affiché :** les créations et suppressions manuelles ne mettent pas à jour `Magasin.soldeCaisse`. En environnement mono-entité, le dashboard affiche un solde qui peut être différent de la réalité. En multi-entité, les exports Excel/PDF fuient des données entre entités.

**Le mécanisme de comptabilité automatique (comptabiliserCaisse) fonctionne correctement** depuis les corrections de la Phase 1 (entiteId passé dans toutes les écritures). Les 10 appelants de `enregistrerMouvementCaisse` avec `recalculerSoldeCaisse` sont fiables.

**Le problème principal est le chemin direct `POST /api/caisse` qui contourne le helper**, causant 3 défauts : pas de recalcul solde, pas de uppercase du motif, pas de normalisation.

---

## 11. Corrections appliquées (RC1–RC10)

| # | Correction | Fichier(s) modifié(s) | Détail |
|---|-----------|------------------------|--------|
| RC1 | **Recalcul solde après création manuelle** | `app/api/caisse/route.ts` | Ajout de `await recalculerSoldeCaisse(magasinId, tx)` dans le POST, après `comptabiliserCaisse` |
| RC2 | **Recalcul solde après suppression** | `app/api/caisse/[id]/route.ts` | Ajout de `await recalculerSoldeCaisse(magasinId)` après `prisma.caisse.delete` |
| RC3 | **Filtre entiteId sur exports** | `app/api/caisse/export-excel/route.ts`, `app/api/caisse/export-pdf/route.ts` | Ajout du filtre `magasin.entiteId` pour les non-SUPER_ADMIN, et `entiteId` query param pour SUPER_ADMIN |
| RC4 | **POST caisse utilise `enregistrerMouvementCaisse`** | `app/api/caisse/route.ts` | Remplacement de `tx.caisse.create()` par `enregistrerMouvementCaisse()` — motif uppercase garanti, cohérence avec les autres flux |
| RC5 | **ESPECE singulier exclu de la consolidation** | `app/api/caisse/consolidation/route.ts` | Remplacement de `['ESPECES', 'CASH']` par la constante `MODES_ESPECES = ['ESPECES', 'CASH', 'ESPECE']` dans tous les `notIn` |
| RC6 | **Unification `estModeEspeces`** | `lib/caisse.ts` (supprimé), `lib/enums-commerce.ts` (source unique), `lib/comptabilisation.ts`, 8 fichiers API, 3 importations dynamiques | `estModeEspeces` supprimé de `lib/caisse.ts`, tous les imports redirigés vers `lib/enums-commerce.ts` (version plus robuste) |
| RC7 | **Filtre statut achats dans crédits fournisseurs** | `app/api/caisse/consolidation/route.ts` | Ajout de `statut: { in: ['VALIDE', 'VALIDEE'] }` au query `creditsFournisseurs` |
| RC8 | **Regex protection suppression améliorée** | `app/api/caisse/[id]/route.ts` | Remplacement regex partielle par extraction `\b(V-\d+)\b` et `\b(A-\d+)\b` + vérification `motifsAutoGenere` pour motifs sans référence explicite |
| RC9 | **Champ `observation` sur Caisse** | `prisma/schema.prisma`, `lib/caisse.ts`, `app/api/caisse/route.ts` | Ajout de `observation String?` au modèle `Caisse`, propagation dans `enregistrerMouvementCaisse` et POST API |
| RC10 | **Champ `sousType` + comptes différenciés** | `prisma/schema.prisma`, `lib/caisse.ts`, `lib/comptabilisation.ts`, `app/api/caisse/route.ts` | Ajout de `sousType String @default("MANUEL")` au modèle `Caisse`. `comptabiliserCaisse` accepte désormais `sousType` : MANUEL→758/658, APPROVISIONNEMENT→521 (crédit entrée), RETRAIT→521 (débit sortie) |

### Fichiers modifiés (18 au total)

| Catégorie | Fichiers |
|-----------|----------|
| Schéma | `prisma/schema.prisma` |
| Services | `lib/caisse.ts`, `lib/comptabilisation.ts` |
| API Caisse | `app/api/caisse/route.ts`, `app/api/caisse/[id]/route.ts`, `app/api/caisse/export-excel/route.ts`, `app/api/caisse/export-pdf/route.ts`, `app/api/caisse/consolidation/route.ts` |
| API Commerce (imports RC6) | `app/api/depenses/route.ts`, `app/api/reglements/achats/route.ts`, `app/api/reglements/ventes/route.ts`, `app/api/reglements/ventes/[id]/route.ts`, `app/api/ventes/[id]/route.ts`, `app/api/ventes/route.ts`, `app/api/achats/[id]/route.ts`, `app/api/achats/route.ts` |
| API Commerce (imports dynamiques RC6) | `app/api/charges/route.ts`, `app/api/achats/[id]/route.ts`, `app/api/ventes/[id]/annuler/route.ts` |

### Vérifications post-correction

- `npx prisma db push` : OK (schéma synchronisé, `observation` et `sousType` ajoutés)
- `npx tsc --noEmit` : 0 erreurs
- `estModeEspeces` : source unique dans `lib/enums-commerce.ts`, 0 référence à `lib/caisse.ts`

*Fin du rapport d'audit du sous-menu Caisse.*
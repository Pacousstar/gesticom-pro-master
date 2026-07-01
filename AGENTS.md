# Résumé de session — 30/06/2026

## Problème racine
Bug Modif Vente : rollback conditionnel + reapply désynchronisé → double déduction stock.
434 Modif Vente, 55 produits, 2933 unités d'écart total absolu.

## Corrections appliquées

### Code (5 fichiers modifiés)
- `app/api/ventes/[id]/route.ts` : approche delta au lieu de rollback+reapply ; retraitDiffere préservé si non fourni
- `app/api/ventes-historiques/route.ts` : wrap dans `$transaction` + entiteId sur stock.updateMany
- `app/api/stock/[id]/route.ts` (PATCH) : wrap dans `$transaction`
- `app/api/stock/[id]/route.ts` (DELETE) : mouvement SORTIE avant delete dans `$transaction`
- `app/api/produits/import/route.ts` : `$transaction` + mouvement pour ajustement stock
- `app/api/stock/coherence/route.ts` : mouvement créé pour chaque correction

### Données (C:)
- VERNIS A EAU 1L : −6 → +2
- GLOBE ETANCHE : −4 → +16
- Zéro stock négatif sur C:

## Non-bug confirmé
- Modif Achat (155 entrées) : rollback inconditionnel = mathématiquement correct. Pas de bug.

## Reste à faire
1. Appliquer VERNIS/GLOBE sur la base F: (client USB) le jour de la MAJ
2. Compiler le `.exe` avec Inno Setup

# Frais d'Approche — Comprendre le mécanisme et l'impact sur le PAMP

## Définition

Les **frais d'approche** représentent les coûts liés à l'acheminement des marchandises jusqu'au magasin :

- Transport
- Douane
- Assurance transit
- Manutention
- Tout coût nécessaire pour mettre le bien en état d'utilisation

---

## Règle comptable SYSCOHADA

En comptabilité **SYSCOHADA**, le coût d'acquisition d'un bien comprend **tous les coûts nécessaires** pour le rendre disponible :

> **Coût d'acquisition = Prix d'achat + Frais d'approche**

Le PAMP (Prix d'Achat Moyen Pondéré) doit donc intégrer les frais d'approche. C'est une obligation comptable, pas un choix.

---

## Fonctionnement dans GestiCom Pro

### Création d'un achat

1. L'utilisateur saisit un montant global de frais d'approche (ex: 25 000 F)
2. Ce montant s'ajoute au total TTC des lignes pour donner le **montant total de la facture**
3. `montantTotal = totalTTCdesLignes + fraisApproche`

### Répartition dans le PAMP

Les frais d'approche sont répartis **au prorata du HT net** de chaque ligne.

**Exemple :** Si une ligne représente 40% du HT net total, elle absorbe 40% des frais d'approche.

### Formule utilisée (`lib/calculs-commerciaux.ts`)

```
partFraisLigne = (htNetLigne / sommeHtNetTotal) × fraisApprocheTotal
valeurAchatNet  = htNetLigne + partFraisLigne
nouveauPAMP = (stockAvant × PAMP_avant + qteLigne × valeurAchatNet) / (stockAvant + qteLigne)
```

---

## Ce n'est PAS un cumul infini

Chaque achat est un événement **distinct**. Les frais d'approche ne s'empilent pas sur les mêmes quantités.

### Exemple concret

```
Achat 1 : 100 unités à 1 000 F + frais d'approche 200 F
→ Unité à 1 200 F (1 000 + 200 F de frais absorbés)

Achat 2 : 50 unités à 1 000 F + frais d'approche 150 F
→ Unité à 1 150 F (1 000 + 150 F de frais absorbés)

PAMP résultant = (100 × 1 200 + 50 × 1 150) / 150 = 1 183 F
```

C'est une **moyenne pondérée**. Les frais de chaque achat ne s'appliquent qu'**aux quantités de cet achat**, pas à tout le stock existant.

---

## Pourquoi c'est important ?

Sans les frais d'approche dans le PAMP :

| Conséquence | Impact |
|-------------|--------|
| Stock sous-évalué au bilan | L'actif est minoré |
| Marge bénéficiaire surestimée | On croit gagner plus qu'on gagne réellement |
| Décisions commerciales faussées | Prix de vente mal calculés |
| Non-conformité SYSCOHADA | Risque fiscal |

---

## Points de correction dans le code

1. **Page Achats** : Le "Total Net à Payer" affichait `totalTTCdesLignes` sans les frais → corrigé pour afficher `totalTTCdesLignes + fraisApproche`
2. **Modal ModificationAchat** : `fraisApproche` était absent du formulaire → ajouté avec validation `min="0"`
3. **API PATCH FULL_UPDATE** : Les frais d'approche sont déjà intégrés dans le calcul du montant total côté serveur
4. **Total dans le modal** : Le total affiché inclut désormais les frais d'approche

---

*Dernière mise à jour : 5 mai 2026*
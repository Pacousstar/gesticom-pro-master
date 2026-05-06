# Audit Global Transverse — SOUS-MENU FOURNISSEURS (TIERS)

**Date :** 6 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Périmètre :** Sous-menu Fournisseurs du menu TIERS — page, API, services, schéma  
**Statut :** EN COURS

---

## 1. Périmètre audité

**Sous-menu :** TIERS → Fournisseurs  
**Fonctionnalité :** Gestion des fournisseurs, soldes, paiements et compte courant

### Écrans analysés
- Liste des fournisseurs (`/dashboard/fournisseurs`)
- Soldes fournisseurs (`/dashboard/fournisseurs/soldes`)
- Paiements fournisseurs (`/dashboard/fournisseurs/paiements`)
- Compte courant fournisseur (`/dashboard/fournisseurs/[id]/compte-courant`)

---

## 2. Fichiers analysés

### Pages Frontend
| Fichier | Lignes |
|---------|--------|
| `app/(dashboard)/dashboard/fournisseurs/page.tsx` | ~500 |
| `app/(dashboard)/dashboard/fournisseurs/soldes/page.tsx` | ~300 |
| `app/(dashboard)/dashboard/fournisseurs/paiements/page.tsx` | ~200 |

### APIs Backend
| Fichier | Rôle |
|---------|------|
| `app/api/fournisseurs/route.ts` | GET (liste + dette calculée) + POST |
| `app/api/fournisseurs/[id]/route.ts` | GET/PATCH/DELETE |
| `app/api/fournisseurs/soldes/route.ts` | Calcul soldes avec période |
| `app/api/fournisseurs/paiements/route.ts` | Liste règlements |
| `app/api/fournisseurs/[id]/compte-courant/route.ts` | Extrait de compte |
| `app/api/reglements/achats/route.ts` | Création règlements |

### Modèle Prisma
| Fichier | Lignes |
|---------|--------|
| `prisma/schema.prisma` (lignes 247-267) | Modèle Fournisseur |

---

## 3. Fonctionnement réel détecté

### Flux principal
1. **Création fournisseur** → Validation simple → création avec entiteId
2. **Calcul dette** → `(Achats - Règlements) + soldeInitial - avoirInitial`
3. **Soldes** → Statut basé sur le signe du solde
4. **Paiements** → Transaction avec verrouillage

---

## 4. Scores par catégorie

| Catégorie | Score | Commentaire |
|----------|-------|-------------|
| Sécurité | 4/10 | Pas de vérification cloture sur modification soldes initiaux |
| Cohérence données | 6/10 | Statut incohérent VALIDE/VALIDEE |
| Complétude | 7/10 | Champ adresse manquant vs Client |
| UX/UI | 6/10 | Manque colonne dette visible |

**Score global estimé : 5.8/10**

---

## 5. Anomalies détaillées

### SEC-01 — Critique — Sécurité: Vérification cloture manquante
**Localisation :** `app/api/fournisseurs/[id]/route.ts` - PATCH
**Problème :** Aucune vérification de cloture exercise lors modification soldes initiaux
**Impact :** Modification soldes可能会 bypass cloture exercise
**Correction :** Ajouter `verifierCloture()` avant modification soldes initiaux

### CL-01 — Critique — Cohérence: Filtre période absent soldes globaux
**Localisation :** `app/api/fournisseurs/soldes/route.ts` - lignes 62-77
**Problème :** Requêtes globales (achatsGlobaux, reglementsGlobaux) n'utilisent pas les filtres dateDebut/dateFin
**Impact :** Le "Solde Global" affiché ne respecte pas le filtre période
**Correction :** Appliquer whereVente/whereReglement aux requêtes globales

### CL-02 — Importante — Cohérence: Statut incohérent
**Localisation :** `app/api/fournisseurs/soldes/route.ts` - lignes 66, 74
**Problème :** Ligne 66: `['VALIDE', 'VALIDEE']`, ligne 74: `'VALIDE'` seulement
**Impact :** Incohérence dans les requêtes
**Correction :** Uniformiser à `['VALIDEE', 'VALIDE']` ou constante

### E1 — Importante — Complétude: Champ adresse manquant
**Localisation :** `prisma/schema.prisma` - modèle Fournisseur (lignes 247-267)
**Problème :** Fournisseur n'a pas de champ `adresse` alors que Client en a un
**Impact :** Information incomplète pour les fournisseurs
**Correction :** Ajouter `adresse String?` au modèle Fournisseur

---

## 6. Corrections recommandées

### Phase 1 - Immédiates (Sécurité)
| Correction | Détail |
|------------|--------|
| **SEC-01** | Ajouter `verifierCloture()` si modification soldes initiaux |

### Phase 2 - Courtes (Cohérence)
| Correction | Détail |
|------------|--------|
| **CL-01** | Uniformiser filtres période pour calcul global |
| **CL-02** | Uniformiser statuts (VALIDE/VALIDEE) |

### Phase 3 - Moyen terme (Complétude)
| Correction | Détail |
|------------|--------|
| **E1** | Ajouter champ `adresse` au schéma Fournisseur |

---

## 7. Questions

1. **Q1 :** Pourquoi Fournisseur n'a pas de champ `adresse` alors que Client en a un ?
2. **Q2 :** Similarité avec Client: peut-on factoriser le code de calcul de solde ?

---

## 8. Conclusion

**Score global estimé : 5.8/10**

Le module est fonctionnel mais présente les mêmes vulnérabilités que Client pour la sécurité (cloture). Corrections SEC-01 et CL-01 prioritaires.

---

## 9. Corrections appliquées

| Correction | Date | Détail |
|------------|------|--------|
| **SEC-01** | 06/05/2026 | `verifierCloture()` appelé dans PATCH si modification soldes initiaux (`app/api/fournisseurs/[id]/route.ts`) |
| **CL-01** | 06/05/2026 | Filtre période appliqué aux requêtes globales soldes (`app/api/fournisseurs/soldes/route.ts`) |
| **CL-02** | 06/05/2026 | Uniformisé statuts à `['VALIDE', 'VALIDEE']` |
| **E1** | 06/05/2026 | Ajout champ `adresse` au schéma Fournisseur (les 2 fichiers Prisma) |

*Document mis à jour post-corrections*
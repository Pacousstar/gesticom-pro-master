# Audit Global Transverse — SOUS-MENU CLIENTS (TIERS)

**Date :** 7 mai 2026  
**Auditeur :** Audit logiciel senior (opencode)  
**Périmètre :** Sous-menu Clients du menu TIERS — page, API, services, schéma  
**Statut :** EN COURS

---

## 1. Périmètre audité

**Sous-menu :** TIERS → Clients  
**Fonctionnalité :** Gestion des clients, soldes, paiements et compte courant

### Écrans analysés
- Liste des clients (`/dashboard/clients`)
- Soldes clients (`/dashboard/clients/soldes`)
- Paiements clients (`/dashboard/clients/paiements`)
- Compte courant client (`/dashboard/clients/[id]/compte-courant`)

---

## 2. Fichiers analysés

### Pages Frontend
| Fichier | Lignes |
|---------|--------|
| `app/(dashboard)/dashboard/clients/page.tsx` | 928 |
| `app/(dashboard)/dashboard/clients/soldes/page.tsx` | 375 |
| `app/(dashboard)/dashboard/clients/paiements/page.tsx` | ~200 |

### APIs Backend
| Fichier | Rôle |
|---------|------|
| `app/api/clients/route.ts` | GET (liste + dette calculée) + POST |
| `app/api/clients/[id]/route.ts` | GET/PATCH/DELETE |
| `app/api/clients/soldes/route.ts` | Calcul soldes avec période |
| `app/api/clients/paiements/route.ts` | Liste règlements |
| `app/api/clients/[id]/compte-courant/route.ts` | Extrait de compte |
| `app/api/reglements/ventes/route.ts` | Création règlements |

### Services et Modèles
| Fichier | Rôle |
|---------|------|
| `prisma/schema.prisma` (lignes 218-245) | Modèle Client |
| `lib/validations.ts` | Zod schema clientSchema |
| `lib/roles-permissions.ts` | Permissions clients |
| `lib/comptabilisation.ts` | comptabiliserReglementVente |

---

## 3. Fonctionnement réel détecté

### Flux principal
1. **Création client** → Validation Zod → création avec entiteId
2. **Calcul dette** → `(Ventes - Règlements) + soldeInitial - avoirInitial`
3. **Soldes** → Statut 'DOIT'/'CREDIT'/'SOLDE' basé sur le signe
4. **Paiements** → Transaction avec vérrou sémantique (15s)
5. **Suppression** → Blocage si ventes/règlements liés

### Filtres multi-entité
- GET clients : filtrage par entiteId selon rôle
- GET soldes : filtrage par entiteId
- GET paiements : filtrage via relation vente

### Permissions
- `clients:view` → lecture
- `clients:create` → création
- `clients:edit` → modification
- `clients:delete` →SUPER_ADMIN/ADMIN uniquement

---

## 4. Fonction attendue du sous-menu

Le sous-menu Clients doit permettre de :
1. Gérer le fichier client (CRUD)
2. Suivre les soldes (dette totale/période)
3. Enregistrer les paiements (règlements)
4. Éditer le compte courant (extrait détaillé)
5. Exporter les données (PDF/Excel)

---

## 5. Écarts entre attendu et réel

| # | Écart | Détail |
|---|-------|--------|
| E1 | **Champ `adresse` manquant dans schéma** | POST accepte `adresse` mais Prisma ne le contient pas |
| E2 | **Statut filtres incohérents** | API clients filtre `VALIDEE, VALIDE` mais soldes API filtre seulement `VALIDEE` |
| E3 | **Pas de vérification cloture sur modification client** | Modification possible sur période clôturée |
| E4 | **Type CREDIT sans plafondCredit autorisé** | Peut créer client CREDIT sans limite |

---

## 6. Anomalies détectées

### Erreurs de logique métier

| ID | Gravité | Description | Impact |
|----|---------|-------------|--------|
| CL-01 | Importante | Filtre période ne s'applique pas au calcul global | Soldes incohérents |
| CL-02 | Importante | Statut `VALIDE` vs `VALIDEE` incohérent | Règlements manqués |
| CL-03 | Moyenne | CREDIT sans plafondCredit = pas de limite | Risque crédit |

### Erreurs de calcul

| ID | Gravité | Description | Impact |
|----|---------|-------------|--------|
| CC-01 | Moyenne | Signe soldeInitial/avoirInitial confusion | Mal compris |
| CC-02 | Moyenne | Pas de conversion timezone dates | Décalage 1 jour |

### Anomalies UI/UX

| ID | Gravité | Description | Impact |
|----|---------|-------------|--------|
| UX-01 | Moyenne | Colonne dette non visible dans tableau | Consultation lente |
| UX-03 | Mineure | Pas de pagination sur soldes | Navigation manquante |

### Risques données/sécurité

| ID | Gravité | Description | Impact |
|----|---------|-------------|--------|
| SEC-01 | Importante | Pas de vérification cloture sur modification | Période modifiée |
| SEC-02 | Moyenne | DELETE ne vérifie pas entité correctement | Suppression inter-ents |

---

## 7. Corrections recommandées

### Critiques
| Correction | Détail |
|------------|--------|
| **SEC-01** | Ajouter `verifierCloture()` si modification soldes initiaux |
| **CL-01** | Uniformiser filtres période pour calcul global |

### Importantes
| Correction | Détail |
|------------|--------|
| **CL-02** | Uniformiser statuts (créer constante) |
| **CL-03** | Validation: CREDIT → plafondCredit obligatoire |
| **E1** | Ajouter champ `adresse` au schéma Client |

### Moyennes
| Correction | Détail |
|------------|--------|
| **UX-01** | Ajouter colonne dette visible |
| **UX-03** | Pagination sur soldes |

---

## 8. Priorité d'exécution

| Phase | Corrections |
|-------|--------------|
| **Phase 1 - Immediate** | SEC-01, CL-01, CL-02 |
| **Phase 2 - Courte** | CL-03, E1 |
| **Phase 3 - Moyen terme** | UX-01, UX-03 |

---

## 9. Questions ou zones incertaines

1. **Q1 :** Pourquoi `adresse` absent du schéma Prisma ?  
2. **Q2 :** Différence sémantique CASH vs CREDIT ?  
3. **Q3 :** Impact changement `soldeInitial` sur calculs passés ?  
4. **Q4 :** Pourquoi pas de soft delete pour clients ?

---

## 10. Conclusion opérationnelle

**Score global estimé : 6.2/10**

Le module est fonctionnel pour les opérations de base. Appliquer Phase 1 pour fiabilité production.

---

## 11. Corrections appliquées

| Correction | Date | Détail |
|------------|------|--------|
| **SEC-01** | 06/05/2026 | `verifierCloture()` appelé dans PATCH si modification soldes initiaux (`app/api/clients/[id]/route.ts:81`) |
| **CL-01** | 06/05/2026 | Filtre période appliqué aux requêtes globales soldes (`app/api/clients/soldes/route.ts:62-82`) |
| **CL-02** | - | Déjà implémenté: accepte `['VALIDEE', 'VALIDE']` pour compatibilité arrière |
| **CL-03** | 06/05/2026 | Validation: type=CREDIT requiert plafonCredit > 0 (`app/api/clients/route.ts:185-188`) |
| **E1** | - | Déjà présent: champ `adresse` existe dans schéma Prisma (ligne 224) |

*Document mis à jour post-corrections*
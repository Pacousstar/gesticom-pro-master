'use client'

import { useState, useEffect, type JSX } from 'react'
import {
  ChevronDown, ChevronRight, Printer, BookOpen, ShoppingCart, Package, Users,
  Briefcase, Calculator, FileBarChart, Settings, LayoutDashboard, AlertTriangle,
  Search, Download, Lightbulb, Target, ShoppingBag, CreditCard, FileText,
  Warehouse, TrendingUp, Shield, HelpCircle, Menu, X, Camera,
  Sparkles, Star, BookMarked, ArrowUp, Layers, GraduationCap
} from 'lucide-react'

type Section = {
  id: string
  number: string
  title: string
  subtitle: string
  icon: any
  gradient: string
  shadow: string
  badge: string
  content: string[]
}

const sections: Section[] = [
  {
    id: 'introduction',
    number: '1',
    title: 'Introduction',
    subtitle: 'Premiers pas avec GestiCom Pro',
    icon: GraduationCap,
    gradient: 'from-indigo-500 via-purple-600 to-violet-700',
    shadow: 'shadow-indigo-200/50',
    badge: 'bg-purple-100 text-purple-800',
    content: [
      `## 🎯 Objectif du manuel
Bienvenue dans **GestiCom Pro** — votre logiciel de gestion commerciale et comptable tout-en-un. Ce manuel vous guide pas à pas dans l'utilisation de chaque module, des ventes à la comptabilité.

## ✨ Nouveautés v${process.env.NEXT_PUBLIC_APP_VERSION || '3.31.0'}
- ✅ Impression multi-pages sur toutes les listes
- ✅ Filtres respectés dans toutes les impressions
- ✅ Pagination automatique avec PAGE X/Y
- ✅ Performance améliorée au démarrage

## 💻 Installation & Démarrage
\`\`\`
1. Lancer le programme d'installation (GestiCom_Pro_Setup.exe)
2. Le service GestiComPro démarre automatiquement
3. Ouvrir votre navigateur → http://localhost:3001
4. L'écran de connexion apparaît
\`\`\`

[CAPTURE : écran de connexion GestiCom Pro]

## 🔑 Connexion
1. Saisir votre **nom d'utilisateur**
2. Saisir votre **mot de passe**
3. Cliquer sur **Se connecter**

> 💡 *Première connexion* : utilisez les identifiants fournis par l'administrateur.

## 🖥️ Découverte de l'interface

| Élément | Description |
|---------|-------------|
| **Barre latérale gauche** | Menu de navigation par modules (Ventes, Achats, Stock...) |
| **Barre supérieure** | Profil utilisateur, notifications, recherche |
| **Zone centrale** | Contenu actif du module sélectionné |
| **Pied de page** | Version du logiciel, connexion |

[CAPTURE : interface principale avec annotations]

> 💡 *Astuce* : la barre latérale se réduit automatiquement sur les petits écrans.`,
    ],
  },
  {
    id: 'dashboard',
    number: '2',
    title: 'Tableau de Bord',
    subtitle: 'Vue d\'ensemble de votre activité',
    icon: LayoutDashboard,
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    shadow: 'shadow-emerald-200/50',
    badge: 'bg-emerald-100 text-emerald-800',
    content: [
      `## 🎯 Objectif
Le **Dashboard** est votre cockpit de pilotage. Il centralise tous les indicateurs clés de votre entreprise en temps réel.

## 📊 Indicateurs principaux
- **Chiffre d'Affaires** (jour / mois / année)
- **Ventes du jour** : nombre de transactions
- **Achats en cours** : tendances fournisseurs
- **Stock** : alertes de rupture, valeur totale
- **Caisse** : solde et écarts

[CAPTURE : Dashboard complet avec KPI]

## 🖱️ Navigation interactive
- **Cartes KPI** : clic → accès direct au module
- **Graphique tendances** : visualisation des ventes sur la période
- **Alertes rouges** : stock bas, impayés, licences expirées
- **Notifications** : icône cloche en haut à droite

## 💡 Astuces
- Personnalisez la période avec les filtres en haut du dashboard
- Les données sont mises à jour automatiquement
- Utilisez \`F5\` pour un rafraîchissement manuel

## ⚠️ Indicateurs d'alerte
| Alerte | Signification | Action |
|--------|---------------|--------|
| 🔴 Stock bas | Produit < seuil minimum | Commander |
| 🟡 Paiement en retard | Facture impayée > 30 jours | Relancer |
| 🔵 Licence expire bientôt | < 30 jours restants | Renouveler |

[CAPTURE : zone d'alertes du dashboard]`,
    ],
  },
  {
    id: 'ventes',
    number: '3',
    title: 'Ventes',
    subtitle: 'Gestion des flux de vente et encaissements',
    icon: ShoppingCart,
    gradient: 'from-orange-400 via-rose-500 to-red-600',
    shadow: 'shadow-orange-200/50',
    badge: 'bg-orange-100 text-orange-800',
    content: [
      `## 🎯 Objectif
Le module **Ventes** vous permet de créer des factures, suivre les paiements, gérer les retours et imprimer les documents commerciaux.

## ➕ Créer une nouvelle vente

\`\`\`
Menu: 🛒 COMMERCE > Ventes
Raccourci: Ctrl+N
\`\`\`

1. Cliquer sur **Nouvelle vente** \`(+)\`
2. Sélectionner le **client** (ou saisir un client libre)
3. Choisir le **magasin** de vente
4. Définir le **mode de paiement** :
   - Espèces 💵 | Chèque 📄 | Virement 🏦
   - Mobile Money 📱 | Carte 💳 | Multi
5. Ajouter des articles :
   - Rechercher un produit par code-barres ou désignation
   - Saisir la 𝗾𝘂𝗮𝗻𝘁𝗶𝘁é
   - La TVA et le total sont calculés automatiquement
6. Cliquer sur **Enregistrer** ✅

[CAPTURE : formulaire de nouvelle vente]

## 🖨️ Imprimer une facture
1. Depuis la liste, cliquer sur **👁️ Détail**
2. Dans le détail, cliquer sur **Imprimer**
3. Le PDF s'ouvre dans un nouvel onglet
4. Utiliser \`Ctrl+P\` pour imprimer physiquement

## 📋 Filtrer les ventes
| Filtre | Utilisation |
|--------|-------------|
| 📅 **Période** | Date de début → Date de fin |
| 🔢 **Numéro** | Recherche par numéro de facture |
| 👤 **Client** | Nom ou code client |
| 📄 **Bon N°** | Numéro de bon associé |
| 🏷️ **Type** | Type de vente |
| 💳 **Statut paiement** | Payé / Partiel / Crédit |

## 📄 Impression de la liste
1. Cliquer sur **Imprimer** en haut de la page
2. ✅ Toutes les ventes filtrées sont incluses
3. ✅ KPI affichés : CA, Encaissé, Reste à recouvrer
4. ✅ Pagination automatique avec numéros de page

[CAPTURE : impression liste des ventes]

## 💡 Astuces avancées
- \`Ctrl+N\` : nouvelle vente depuis n'importe où
- \`Ctrl+F\` : focus sur la recherche
- Une vente peut être **modifiée** tant qu'elle n'est pas validée
- Les **retours** se font depuis le détail de la vente
- La **vente rapide** est accessible depuis \`/dashboard/ventes/rapide\`

## ⚠️ Résolution des problèmes
| Problème | Solution |
|----------|----------|
| Produit en rupture | Vérifier le stock ou réduire la quantité |
| Client introuvable | Créer un client libre ou ajouter le client rapidement |
| Paiement > Total | Vérifier le montant saisi |
| TVA incorrecte | Vérifier le taux TVA du produit |

[CAPTURE : liste des ventes avec filtres appliqués]`,
    ],
  },
  {
    id: 'achats',
    number: '4',
    title: 'Achats',
    subtitle: 'Gestion des approvisionnements fournisseurs',
    icon: ShoppingBag,
    gradient: 'from-blue-400 via-indigo-500 to-purple-600',
    shadow: 'shadow-blue-200/50',
    badge: 'bg-blue-100 text-blue-800',
    content: [
      `## 🎯 Objectif
Gérez vos **achats fournisseurs** de la commande à la réception : suivi des factures, paiements et historique complet.

## ➕ Créer un achat

\`\`\`
Menu: 📦 LOGISTIQUE > Achats
\`\`\`

1. Cliquer sur **Nouvel achat**
2. Sélectionner ou créer le **fournisseur**
3. Choisir le **magasin** de destination
4. Optionnel : numéro de camion / bon de commande
5. Ajouter les lignes d'achat :
   - Produit, quantité, prix unitaire
   - Remise éventuelle
   - TVA (calculée automatiquement)
6. Vérifier les totaux (HT, TVA, TTC)
7. **Enregistrer**

[CAPTURE : formulaire de nouvel achat]

## 💳 Paiement fournisseur
1. Ouvrir le détail de l'achat
2. Cliquer sur **Règlement**
3. Saisir le montant payé
4. Choisir le mode de paiement
5. ✅ Le statut passe à "Payé" ou "Partiel"

## 📄 Impression liste des achats
- Cliquer sur **Imprimer** dans la barre d'outils
- ✅ Aperçu paginé avec KPI (Volume, Payé, Reste, Nb opérations)
- ✅ Filtres respectés

[CAPTURE : impression liste des achats]

## 💡 Astuces
- Utiliser la **recherche par numéro de camion** pour les achats en gros
- Les **filtres par période** sont essentiels pour les rapports mensuels
- Un achat peut être **modifié** tant qu'il n'est pas soldé
- Les **commandes fournisseurs** sont disponibles dans le menu dédié

## ⚠️ Résolution des problèmes
| Problème | Solution |
|----------|----------|
| Doublon de facture | Vérifier avec la recherche par numéro de bon |
| Montant erroné | Vérifier les taux TVA spécifiques au fournisseur |
| Fournisseur inconnu | Le créer directement depuis le formulaire (2 clics) |

[CAPTURE : liste des achats avec filtres]`,
    ],
  },
  {
    id: 'stock',
    number: '5',
    title: 'Stock & Inventaire',
    subtitle: 'Gestion des mouvements et valorisation',
    icon: Package,
    gradient: 'from-green-400 via-emerald-500 to-teal-600',
    shadow: 'shadow-green-200/50',
    badge: 'bg-green-100 text-green-800',
    content: [
      `## 🎯 Objectif
Le module **Stock** vous permet de suivre les quantités en temps réel, gérer les entrées/sorties, faire l'inventaire et transférer entre magasins.

## 📦 Consulter le stock
\`\`\`
Menu: 📦 LOGISTIQUE > Stock
\`\`\`
- Liste de tous les produits avec quantité disponible
- **Filtres** : catégorie, recherche par code/désignation
- **Code couleur** : 🟢 stock OK | 🟡 stock bas | 🔴 rupture

[CAPTURE : page Stock avec code couleur]

## ➕ Entrée de stock
1. Cliquer sur **Entrée**
2. Sélectionner : produit, magasin, quantité
3. Motif : réapprovisionnement, retour, correction
4. ✅ Le stock est mis à jour immédiatement

## ➖ Sortie de stock
1. Cliquer sur **Sortie**
2. Produit, quantité, motif
3. ✅ Mise à jour instantanée

## 🔄 Transfert entre magasins
1. Cliquer sur **Transfert**
2. Produit, quantité, magasin source → destination
3. ✅ Les deux magasins sont mis à jour

## 📋 Inventaire
1. Onglet **Inventaire**
2. Saisir les quantités réelles pour chaque produit
3. Les **écarts** sont calculés automatiquement
4. ✅ Validation définitive ou brouillon

[CAPTURE : écran d'inventaire]

## 🖨️ Impression
- **Bouton Imprimer** : liste avec filtres appliqués
- ✅ Alertes stock bas visibles dans l'impression
- ✅ Paginé avec KPI

## 💡 Astuces
- Les **alertes stock bas** sont configurables dans les paramètres du produit
- Le **code-barres** peut être scanné avec un lecteur USB
- L'**historique des mouvements** est disponible dans \`Rapports > Inventaire\`

## ⚠️ Résolution des problèmes
| Problème | Solution |
|----------|----------|
| Stock négatif | Vérifier les sorties antérieures, corriger avec une entrée |
| Produit sans catégorie | Modifier le produit dans la fiche article |
| Écart d'inventaire | Lancer un inventaire complet périodiquement |

[CAPTURE : page Stock]`,
    ],
  },
  {
    id: 'clients',
    number: '6',
    title: 'Clients',
    subtitle: 'Fichier client, encaissements, relances',
    icon: Users,
    gradient: 'from-fuchsia-400 via-purple-500 to-violet-600',
    shadow: 'shadow-fuchsia-200/50',
    badge: 'bg-fuchsia-100 text-fuchsia-800',
    content: [
      `## 🎯 Objectif
Gérez votre **fichier clients**, les paiements, les relances automatiques et le suivi des comptes courants.

## 👥 Gestion des clients
\`\`\`
Menu: 👥 TIERS > Clients
\`\`\`
- Liste complète des clients avec coordonnées
- Clic → **Détail** : compte courant, historique des ventes

## ➕ Créer un client
1. Cliquer sur **Nouveau client**
2. Champs obligatoires : nom, téléphone
3. Optionnels : code, localisation, NCC
4. Le code client est **généré automatiquement**

## 💰 Paiements clients
\`\`\`
Menu: 👥 TIERS > Clients > Paiements
\`\`\`
1. Filtrer par période
2. Visualiser : total encaissé, répartition par mode
3. **Imprimer** le journal des encaissements

[CAPTURE : page des paiements clients]

## 📊 Soldes et relances
\`\`\`
Menu: 👥 TIERS > Clients > Soldes
\`\`\`
1. Voir le solde de chaque client
2. Détail : total dû, payé, reste à payer
3. **Relance** → génère une lettre PDF personnalisée

[CAPTURE : soldes clients]

## 🖨️ Impressions disponibles
| Document | Où ? |
|----------|------|
| Liste clients | \`Clients > Imprimer\` |
| Compte courant | \`Détail client > Compte courant\` |
| Journal encaissements | \`Clients > Paiements > Imprimer\` |
| Relance | \`Clients > Soldes > Relance\` |

## 💡 Astuces
- Recherche rapide par nom, code ou téléphone
- Un client peut avoir **plusieurs modes de paiement**
- Les relances sont **personnalisables** dans Paramètres > Impression
- Le **compte courant** montre toutes les transactions

## ⚠️ Résolution des problèmes
| Problème | Solution |
|----------|----------|
| Client en double | Fusionner via la fiche client |
| Paiement non lettré | Vérifier le lettrage dans le compte courant |
| Facture impayée | Utiliser la relance automatique |

[CAPTURE : détail client]`,
    ],
  },
  {
    id: 'fournisseurs',
    number: '7',
    title: 'Fournisseurs',
    subtitle: 'Gestion des tiers fournisseurs et dettes',
    icon: Briefcase,
    gradient: 'from-amber-400 via-orange-500 to-red-600',
    shadow: 'shadow-amber-200/50',
    badge: 'bg-amber-100 text-amber-800',
    content: [
      `## 🎯 Objectif
Gérez vos **fournisseurs**, les paiements, le compte courant et le suivi des dettes fournisseurs.

## 📇 Gestion des fournisseurs
\`\`\`
Menu: 👥 TIERS > Fournisseurs
\`\`\`
- Liste des fournisseurs avec coordonnées
- Détail : commandes, historique achats, solde

## ➕ Créer un fournisseur
1. Cliquer sur **Nouveau fournisseur**
2. Champs : raison sociale, contact, localisation, NCC
3. Enregistrer ✅

## 💳 Paiements fournisseurs
\`\`\`
Menu: 👥 TIERS > Fournisseurs > Paiements
\`\`\`
1. Filtrer par période
2. Visualiser les échéances et montants payés
3. **Imprimer** le journal des paiements

## 📜 Compte courant
1. Depuis la liste, cliquer sur un fournisseur
2. Vue **Compte courant** : achats + paiements + solde
3. Possibilité de **lettrer** les paiements

[CAPTURE : compte courant fournisseur]

## 💡 Astuces
- Le **NCC** (Numéro de Compte Contribuable) est obligatoire pour la comptabilité
- Un fournisseur peut aussi être client
- Les **soldes fournisseurs** impactent directement la trésorerie
- Consultez régulièrement le compte courant

## ⚠️ Résolution des problèmes
| Problème | Solution |
|----------|----------|
| NCC manquant | Ajouter dans la fiche fournisseur |
| Paiement en trop | Vérifier avant validation |
| Facture impayée | Suivre le compte courant régulièrement |

[CAPTURE : liste fournisseurs]`,
    ],
  },
  {
    id: 'comptabilite',
    number: '8',
    title: 'Comptabilité',
    subtitle: 'Écritures, bilan, grand-livre, journaux',
    icon: Calculator,
    gradient: 'from-slate-600 via-slate-700 to-gray-800',
    shadow: 'shadow-slate-200/50',
    badge: 'bg-slate-100 text-slate-800',
    content: [
      `## 🎯 Objectif
Module **comptable complet** : les écritures sont générées automatiquement depuis les ventes et achats. Consultez le bilan, le grand-livre et les journaux.

## 📒 Écritures comptables
\`\`\`
Menu: 💰 FINANCES > Écritures Comptables
\`\`\`
- Liste chronologique de toutes les écritures
- Filtres : période, journal, compte
- **10 000 lignes** maximum affichées

[CAPTURE : écritures comptables]

## 📊 Bilan actif/passif
\`\`\`
Menu: 💰 FINANCES > Bilan
\`\`\`
1. Sélectionner la période
2. Générer le bilan
3. Visualiser : Actif ↔ Passif
4. **Exporter** en Excel ou PDF

[CAPTURE : bilan comptable]

## 📈 Grand livre
\`\`\`
Menu: 💰 FINANCES > Grand Livre
\`\`\`
1. Choisir un **compte**
2. Définir la **période**
3. Tous les mouvements du compte sont listés

## 📔 Journaux
\`\`\`
Menu: 💰 FINANCES > Journaux
\`\`\`
| Journal | Contenu |
|---------|---------|
| Ventes | Factures clients |
| Achats | Factures fournisseurs |
| Banque | Opérations bancaires |
| Caisse | Mouvements de caisse |
| OD | Opérations diverses |

## 💡 Astuces comptables
- Les écritures sont **générées automatiquement**
- L'**initialisation** se fait dans Paramètres
- Le **lettrage automatique** simplifie le rapprochement
- **Exporter** le bilan pour votre comptable
- L'impression des écritures supporte jusqu'à **10 000 lignes**

## ⚠️ Résolution des problèmes
| Problème | Solution |
|----------|----------|
| Écriture non équilibrée | Débit ≠ Crédit → vérifier les montants |
| Compte inexistant | Vérifier le plan comptable |
| Période non clôturée | Les écritures sont encore modifiables |

[CAPTURE : grand livre]`,
    ],
  },
  {
    id: 'rapports',
    number: '9',
    title: 'Rapports & Analyses',
    subtitle: 'Tous les indicateurs pour piloter',
    icon: FileBarChart,
    gradient: 'from-rose-400 via-pink-500 to-fuchsia-600',
    shadow: 'shadow-rose-200/50',
    badge: 'bg-rose-100 text-rose-800',
    content: [
      `## 🎯 Objectif
Analysez votre activité avec des **rapports détaillés** : ventes, achats, stock, finances. Exportez en PDF ou Excel.

## 📊 Rapports Généraux
\`\`\`
Menu: 📊 ANALYTIQUE & RAPPORTS > Rapports Généraux
\`\`\`

### 📈 Rapports Ventes
| Rapport | Description |
|---------|-------------|
| **Liste des ventes** | Toutes les ventes avec filtres |
| **Par client** | Volume d'achat par client |
| **Par produit** | Top produits vendus |
| **Par vendeur** | Performance des vendeurs |

### 📦 Rapports Inventaire
| Rapport | Description |
|---------|-------------|
| **Mouvements** | Entrées/sorties avec pagination |
| **Valeur du stock** | Valorisation totale |
| **Historique produit** | Traçabilité complète |

### 💰 Rapports Finances
| Rapport | Description |
|---------|-------------|
| **État des paiements** | Synthèse encaissements/décaissements |
| **Soldes tiers** | Clients et fournisseurs |

## 🖨️ Export et impression
- 📄 **Export PDF** : cliquer sur le bouton d'export
- 📊 **Export Excel** : pour analyse dans Excel
- 🖨️ **Impression** : paginée avec KPI et totaux
- ✅ **Filtres respectés** dans tous les exports

[CAPTURE : rapports généraux]

## 💡 Astuces
- Les rapports sont **exportables** pour envoi par email
- Utilisez les **filtres** pour affiner l'analyse
- Les **KPI en haut** donnent une vue d'ensemble rapide
- Le rapport de **rentabilité produits** aide à ajuster les prix`,
    ],
  },
  {
    id: 'parametres',
    number: '10',
    title: 'Paramètres & Configuration',
    subtitle: 'Personnalisation de l\'application',
    icon: Settings,
    gradient: 'from-cyan-400 via-sky-500 to-blue-600',
    shadow: 'shadow-cyan-200/50',
    badge: 'bg-cyan-100 text-cyan-800',
    content: [
      `## 🎯 Objectif
Configurez GestiCom Pro selon vos besoins : entreprise, utilisateurs, licence, sauvegarde, modèles d'impression.

## 🏢 Informations entreprise
\`\`\`
Menu: ⚙️ SYSTÈME > Paramètres
\`\`\`
1. Nom de l'entreprise
2. Localisation, contact
3. NCC (Numéro de Compte Contribuable)
4. Logo (affiché sur les factures)

[CAPTURE : paramètres entreprise]

## 👥 Utilisateurs et permissions
\`\`\`
Menu: ⚙️ SYSTÈME > Utilisateurs
\`\`\`
| Rôle | Permissions |
|------|-------------|
| 👑 **SUPER_ADMIN** | Accès total à toutes les fonctionnalités |
| 🛡️ **ADMIN** | Gestion opérationnelle + paramètres |
| 👤 **USER** | Usage standard (ventes, achats, stock) |

## 🛡️ Licence
\`\`\`
Menu: ⚙️ SYSTÈME > Licence
\`\`\`
- Voir le **statut** et la **date d'expiration**
- Installer un fichier \`.lic\`
- ⚠️ Licence expirée → application bloquée

## 💾 Sauvegarde
- **Automatique** : configurée par défaut
- **Manuelle** : depuis Paramètres > Sauvegarde
- **Restauration** : depuis une sauvegarde existante
- Base de données : SQLite (\`.db\`) dans \`C:/gesticom/\`

## 🖨️ Modèles d'impression
\`\`\`
Menu: ⚙️ SYSTÈME > Paramètres > Impression
\`\`\`
- Personnaliser : Factures, Bons de livraison, Reçus
- Choisir le format : portrait, paysage
- Ajouter le logo et les mentions légales

## 💡 Astuces
- 🔐 Mot de passe **administrateur fort** recommandé
- 💾 **Sauvegarde avant chaque mise à jour**
- 🎨 Les modèles d'impression sont en HTML personnalisable

[CAPTURE : page sauvegarde]`,
    ],
  },
  {
    id: 'depannage',
    number: '11',
    title: 'Dépannage',
    subtitle: 'Solutions aux problèmes courants',
    icon: HelpCircle,
    gradient: 'from-red-400 via-rose-500 to-pink-600',
    shadow: 'shadow-red-200/50',
    badge: 'bg-red-100 text-red-800',
    content: [
      `## 🚨 Problèmes et solutions

### ❌ L'application ne démarre pas
| Étape | Action |
|-------|--------|
| 1 | Vérifier \`services.msc\` → service **GestiComPro** doit être "En cours d'exécution" |
| 2 | Redémarrer le service |
| 3 | Vérifier les logs dans \`C:/gesticom/\` |
| 4 | Contacter le support si persistant |

### 🔑 Erreur "Licence expirée"
1. Menu \`⚙️ SYSTÈME > Licence\`
2. Cliquer sur **Installer une licence**
3. Sélectionner le fichier \`.lic\` fourni
4. ✅ Redémarrer l'application

### 🖨️ Impression incorrecte
| Symptôme | Solution |
|----------|----------|
| 1 seule page imprimée | Mettre à jour vers v3.31.0+ |
| Filtres ignorés | Mettre à jour vers v3.31.0+ |
| Pas de PAGE X/Y | Mettre à jour vers v3.31.0+ |

### 🐢 Performances lentes
1. Le **premier démarrage** peut prendre plusieurs minutes
2. ✅ Ajouter une exclusion Windows Defender pour \`C:/gesticom/\`
3. Voir ⚙️ > **Monitoring** pour les indicateurs de performance

### 📋 Consultation des erreurs
\`\`\`
Menu: ⚙️ SYSTÈME > Erreurs
\`\`\`
- Journal des erreurs de l'application
- Filtrage par type et période
- "Aucune erreur" ✅ = tout va bien

### 📊 Monitoring
\`\`\`
Menu: ⚙️ SYSTÈME > Monitoring
\`\`\`
- Utilisation CPU / RAM
- Santé du service
- Temps de réponse

## 📞 Support GestiCom Pro

| Moyen | Coordonnées |
|-------|-------------|
| 📞 **Téléphone** | \`+225 05 44 82 49 24\` |
| ✉️ **Email** | \`pacousstar01@gmail.com\` |
| 🌐 **Site web** | \`https://gesticom.com\` |
| 📍 **Adresse** | Duékoué, Région du Guémon |

> 🕐 *Support disponible aux heures ouvrables*

### 🔍 Journal d'audit (pour le support technique)
\`\`\`
Menu: ⚙️ SYSTÈME > Journal d'audit
\`\`\`
- Toutes les actions sont tracées
- Filtrer par utilisateur, date, action
- Exporter pour envoi au support

## 🎯 Checklist de bonnes pratiques
- [ ] Faire une **sauvegarde** chaque semaine
- [ ] Vérifier les **licences** mensuellement
- [ ] Lancer un **inventaire** chaque mois
- [ ] Consulter les **erreurs** régulièrement
- [ ] Mettre à jour vers la **dernière version**
- [ ] **Exclure** \`C:/gesticom/\` de Windows Defender

[CAPTURE : page monitoring]`,
    ],
  },
]

const captureImages: Record<string, string> = {
  'CAPTURE : écran de connexion GestiCom Pro': '/captures/connexion.png',
  'CAPTURE : interface principale avec annotations': '/captures/accueil.png',
  'CAPTURE : Dashboard complet avec KPI': '/captures/dashboard.png',
  'CAPTURE : zone d\'alertes du dashboard': '/captures/dashboard-alertes.png',
  'CAPTURE : formulaire de nouvelle vente': '/captures/formulaire-de-nouvelle-vente.png',
  'CAPTURE : impression liste des ventes': '/captures/impression-liste-des-ventes.png',
  'CAPTURE : liste des ventes avec filtres appliqués': '/captures/liste-des-ventes-avec-filtres-appliqués.png',
  'CAPTURE : formulaire de nouvel achat': '/captures/achat-formulaire.png',
  'CAPTURE : impression liste des achats': '/captures/achat-impression.png',
  'CAPTURE : liste des achats avec filtres': '/captures/achat-liste.png',
  'CAPTURE : page Stock avec code couleur': '/captures/stock-page.png',
  'CAPTURE : écran d\'inventaire': '/captures/stock-inventaire.png',
  'CAPTURE : page Stock': '/captures/stock-liste-Impression.png',
  'CAPTURE : page des paiements clients': '/captures/paiement-clients.png',
  'CAPTURE : soldes clients': '/captures/soldes-clients.png',
  'CAPTURE : détail client': '/captures/client-detail.png',
  'CAPTURE : compte courant fournisseur': '/captures/fournisseur-compte.png',
  'CAPTURE : liste fournisseurs': '/captures/fournisseur-liste.png',
  'CAPTURE : écritures comptables': '/captures/ecritures-comptables.png',
  'CAPTURE : bilan comptable': '/captures/compta-bilan.png',
  'CAPTURE : grand livre': '/captures/compta-grand-livre.png',
  'CAPTURE : rapports généraux': '/captures/rapports-generaux.png',
  'CAPTURE : paramètres entreprise': '/captures/parametres-entreprise.png',
  'CAPTURE : page sauvegarde': '/captures/parametres-sauvegarde.png',
  'CAPTURE : page monitoring': '/captures/monitoring.png',
}

function getCaptureImage(name: string): string | null {
  return captureImages[name] || null
}

function renderContent(text: string) {
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={key++} className="text-xl font-black text-gray-900 mt-8 mb-4 flex items-center gap-3">
          <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-orange-400 to-rose-500 inline-block" />
          {line.replace('## ', '')}
        </h3>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h4 key={key++} className="text-base font-bold text-gray-800 mt-5 mb-2 flex items-center gap-2">
          {line.replace('### ', '')}
        </h4>
      )
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={key++} className="text-sm text-gray-600 ml-5 list-disc pl-2 leading-relaxed marker:text-orange-400">
          {line.replace('- ', '')}
        </li>
      )
    } else if (line.startsWith('| ')) {
      if (line.includes('---')) continue
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim())
      if (cells.length > 0) {
        const isHeader = line.includes('---') === false && elements.length > 0
        const prevEl = elements[elements.length - 1]
        if (prevEl && prevEl.type === 'table') {
          const table = prevEl as any
          elements[elements.length - 1] = (
            <table key={key++} className="w-full text-xs border-collapse my-4 shadow-sm rounded-lg overflow-hidden">
              {table.props.children}
              <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                {cells.map((c, i) => (
                  <td key={i} className="px-4 py-2.5 text-gray-600">{c}</td>
                ))}
              </tr>
            </table>
          )
        } else {
          elements.push(
            <table key={key++} className="w-full text-xs border-collapse my-4 shadow-sm rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                  {cells.map((c, i) => (
                    <th key={i} className="px-4 py-3 text-left font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-200">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  {cells.map((c, i) => (
                    <td key={i} className="px-4 py-2.5 text-gray-600">{c}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          )
        }
      }
    } else if (line.startsWith('[CAPTURE') && line.endsWith(']')) {
      const captureName = line.slice(1, -1)
      const imgSrc = getCaptureImage(captureName)
      if (imgSrc) {
        elements.push(
          <div key={key++} className="my-6 rounded-2xl overflow-hidden shadow-lg border border-gray-200">
            <img src={imgSrc} alt={captureName} className="w-full h-auto" />
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-2 text-center text-xs font-bold text-orange-700 uppercase tracking-wider border-t border-orange-100">
              {captureName.replace('CAPTURE : ', '')}
            </div>
          </div>
        )
      } else {
        elements.push(
          <div key={key++} className="relative group border-2 border-dashed border-orange-200 rounded-2xl p-10 my-6 text-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 hover:border-orange-300 transition-all cursor-pointer">
            <div className="absolute -top-3 left-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-gradient-to-r from-orange-400 to-rose-500 text-white shadow-lg">
                <Camera className="h-3 w-3" />
                Capture d'écran
              </span>
            </div>
            <Camera className="h-12 w-12 mx-auto mb-3 text-orange-300 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-bold text-orange-800">{captureName}</p>
            <p className="text-xs text-orange-400 mt-1">Ajouter l'image ici</p>
          </div>
        )
      }
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-3" />)
    } else if (line.match(/^\d+\. /)) {
      elements.push(
        <li key={key++} className="text-sm text-gray-600 ml-5 list-decimal pl-2 leading-relaxed marker:font-bold marker:text-orange-500">
          {line.replace(/^\d+\. /, '')}
        </li>
      )
    } else if (line.startsWith('> ')) {
      elements.push(
        <div key={key++} className="relative border-l-4 border-orange-300 bg-gradient-to-r from-orange-50 to-transparent pl-5 py-3 my-3 rounded-r-lg">
          <p className="text-sm italic text-gray-700">{line.replace('> ', '')}</p>
        </div>
      )
    } else if (line.startsWith('```')) {
      continue
    } else {
      elements.push(
        <p key={key++} className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{line}</p>
      )
    }
  }

  return elements
}

export default function ManuelUtilisateurPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleSection = (id: string) => {
    setActiveSection(activeSection === id ? null : id)
  }

  const filteredSections = searchQuery
    ? sections.filter(s => {
        const q = searchQuery.toLowerCase()
        return s.title.toLowerCase().includes(q) || s.content.some(c => c.toLowerCase().includes(q))
      })
    : sections

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-white relative">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-rose-200/20 rounded-full blur-3xl" />
      </div>

      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 w-full h-1 z-50 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-orange-400 via-rose-500 to-purple-600 transition-all duration-150"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-orange-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
        </div>
        <div className="relative px-6 py-8 no-print">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-xl shadow-orange-500/20 animate-pulse">
                    <BookOpen className="h-8 w-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <span className="flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500" />
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-4xl font-black uppercase tracking-tighter italic bg-gradient-to-r from-orange-200 via-amber-100 to-yellow-200 bg-clip-text text-transparent">
                      Manuel Utilisateur
                    </h1>
                    <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/90">
                    <span className="font-medium">GestiCom Pro</span>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="font-bold text-orange-300">v{process.env.NEXT_PUBLIC_APP_VERSION || '3.31.0'}</span>
                    <span className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="text-white/80">Guide complet d'utilisation</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="lg:hidden flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-all"
                >
                  {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  Sommaire
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 px-5 py-2.5 text-sm font-bold text-white hover:from-orange-600 hover:to-rose-700 shadow-lg shadow-orange-500/20 transition-all uppercase tracking-wider"
                >
                  <Printer className="h-4 w-4" />
                  Imprimer
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="mt-6 max-w-lg">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-orange-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Rechercher dans le manuel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:bg-white/15 backdrop-blur-sm transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 pt-12">
        <div className="flex gap-8 items-start">
          {/* Desktop TOC */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <nav className="sticky top-8 space-y-1">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 p-5">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                  <BookMarked className="h-4 w-4 text-orange-500" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">Sommaire</h2>
                  <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {sections.length} chapitres
                  </span>
                </div>
                <div className="space-y-1">
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveSection(s.id)
                        document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white transition-all text-left bg-gradient-to-r ${s.gradient} ${
                        activeSection === s.id
                          ? 'shadow-xl scale-[1.02] ring-2 ring-white/30'
                          : 'opacity-85 hover:opacity-100 hover:shadow-lg'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold bg-white/20 backdrop-blur-sm ${
                        activeSection === s.id ? 'scale-110 bg-white/30' : ''
                      } transition-transform`}>
                        {s.number}
                      </span>
                      <span className="leading-tight">{s.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {menuOpen && (
              <div className="lg:hidden bg-white rounded-2xl border border-gray-100 shadow-xl p-5 mb-6 no-print">
                <div className="flex items-center gap-2 mb-4">
                  <BookMarked className="h-4 w-4 text-orange-500" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">Sommaire</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveSection(s.id)
                        document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        setMenuOpen(false)
                      }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-white transition-all bg-gradient-to-r ${s.gradient} opacity-85 hover:opacity-100`}
                    >
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold bg-white/20 backdrop-blur-sm">
                        {s.number}
                      </span>
                      <span className="leading-tight">{s.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searchQuery && filteredSections.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <HelpCircle className="h-10 w-10 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">Aucun résultat pour "<span className="font-bold text-gray-700">{searchQuery}</span>"</p>
                <button onClick={() => setSearchQuery('')} className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium">
                  Effacer la recherche
                </button>
              </div>
            )}

            <div className="space-y-6">
              {filteredSections.map((section) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-lg shadow-gray-200/30 overflow-hidden transition-all hover:shadow-xl hover:shadow-gray-200/40"
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center justify-between px-6 sm:px-8 py-5 bg-gradient-to-r ${section.gradient} text-white relative overflow-hidden`}
                  >
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full blur-2xl" />
                      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white rounded-full blur-2xl" />
                    </div>
                    <div className="relative flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${activeSection === section.id ? 'rotate-3' : ''}`}>
                        <section.icon className="h-6 w-6" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-75">Chapitre {section.number}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${section.badge}`}>
                            {section.badge.includes('bg-purple') ? 'Débutant' :
                             section.badge.includes('bg-emerald') ? 'Vue d\'ensemble' :
                             section.badge.includes('bg-orange') ? 'Commerce' :
                             section.badge.includes('bg-blue') ? 'Logistique' :
                             section.badge.includes('bg-green') ? 'Stock' :
                             section.badge.includes('bg-fuchsia') ? 'Relation client' :
                             section.badge.includes('bg-amber') ? 'Fournisseur' :
                             section.badge.includes('bg-slate') ? 'Comptabilité' :
                             section.badge.includes('bg-rose') ? 'Analyse' :
                             section.badge.includes('bg-cyan') ? 'Configuration' : 'Support'}
                          </span>
                        </div>
                        <h2 className="text-2xl font-bold">{section.title}</h2>
                        <p className="text-sm opacity-80 mt-0.5">{section.subtitle}</p>
                      </div>
                    </div>
                    <div className="relative flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const el = document.getElementById(`print-chapter-${section.id}`)
                          if (el) {
                            const w = open('', '_blank')
                            if (w) {
                              w.document.write(`<!DOCTYPE html><html><head><title>${section.title}</title>
                                <style>body{font-family:Arial,sans-serif;padding:40px;font-size:14px;line-height:1.7;color:#1a1a1a}
                                table{border-collapse:collapse;width:100%;margin:16px 0;font-size:13px}
                                th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
                                th{background:#f5f5f5;font-weight:bold}
                                img{max-width:100%;height:auto}
                                h2{font-size:24px;color:#1a1a1a;margin-top:30px}
                                h3{font-size:18px;color:#333;margin-top:24px}
                                li{margin:6px 0}
                                blockquote{border-left:3px solid #f97316;padding:8px 16px;margin:16px 0;background:#fff7ed;border-radius:0 8px 8px 0}
                                code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px}
                                .kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:16px 0}
                                .kpi-item{border:1px solid #e5e7eb;padding:16px;border-radius:8px;text-align:center}
                                .kpi-label{font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:bold}
                                .kpi-value{font-size:20px;font-weight:bold;color:#111827}
                                .footer{text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af}
                                </style></head><body><h1 style="font-size:28px;margin-bottom:4px">${section.title}</h1>
                                <p style="color:#666;margin-top:0;margin-bottom:30px;font-size:14px">${section.subtitle}</p>
                                ${el.innerHTML}</body></html>`)
                              w.document.close()
                            }
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/25 backdrop-blur-sm transition-all"
                        title="Imprimer ce chapitre"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Chapitre
                      </button>
                      {activeSection === section.id || searchQuery
                        ? <ChevronDown className="h-5 w-5 transition-transform duration-300" />
                        : <ChevronRight className="h-5 w-5 transition-transform duration-300" />}
                    </div>
                  </button>

                  {(activeSection === section.id || searchQuery) && (
                    <div className="px-6 sm:px-8 py-6">
                      <div id={`print-chapter-${section.id}`}>
                        {section.content.map((block, i) => (
                          <div key={i}>{renderContent(block)}</div>
                        ))}
                      </div>
                      <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between no-print">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Layers className="h-3.5 w-3.5" />
                          Chapitre {section.number} sur {sections.length}
                        </div>
                        <button
                          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                          className="flex items-center gap-1.5 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-xl"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                          Retour en haut
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative mt-12 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-gray-400 overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-orange-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-500 rounded-full blur-3xl" />
        </div>
        <div className="relative px-6 py-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-orange-400" />
                <span className="text-base font-black uppercase tracking-widest text-white">GestiCom Pro</span>
              </div>
              <p className="text-sm font-medium text-white/90">
                Manuel Utilisateur — Version <span className="text-orange-300 font-bold">{process.env.NEXT_PUBLIC_APP_VERSION || '3.31.0'}</span>
              </p>
              <p className="text-xs text-white/70">
                Document généré le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="h-px w-12 bg-gradient-to-r from-transparent to-white/20" />
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span className="h-px w-12 bg-gradient-to-l from-transparent to-white/20" />
              </div>
              <p className="text-[10px] text-white/60 italic">
                "La simplicité est la sophistication suprême"
              </p>
              <p className="text-xs text-white/40 font-medium mt-3 tracking-wider">
                GestiCom Pro © 2026
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

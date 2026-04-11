'use client'

import { useState } from 'react'
import { 
  ShoppingCart, 
  TrendingUp, 
  Zap, 
  ShieldCheck, 
  LayoutDashboard, 
  Calculator, 
  Lightbulb, 
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  CreditCard,
  Target,
  FileBarChart,
  UserCheck,
  AlertTriangle,
  Package,
  Wallet,
  Scale,
  PieChart,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Info,
  BadgePercent,
  TrendingDown,
  Users,
  Briefcase,
  Truck,
  RefreshCw,
  FileText,
  History,
  Banknote,
  DollarSign,
  Landmark,
  Calendar
} from 'lucide-react'

// --- TYPES ---
type CounterDef = {
  id: string
  title: string
  icon: any
  what: string       // Ce que c'est
  how: string        // Comment on l'obtient
  example: string    // Des exemples concrets
  analysis: string   // Analyse Financière
  color: string
}

type MenuSection = {
  id: string
  label: string
  icon: any
  description: string
  counters: CounterDef[]
}

// --- DATA ---
const PEDAGOGIE_DATA: MenuSection[] = [
  {
    id: 'dashboard',
    label: '🚀 Dashboard',
    icon: LayoutDashboard,
    description: 'Le cockpit décisionnel pour piloter votre activité en temps réel.',
    counters: [
      {
        id: 'ca_jour',
        title: "Chiffre d'Affaires (Jour)",
        icon: Target,
        what: "C'est la somme totale des ventes (Hors Taxes) validées durant la journée en cours. Il représente la force de frappe commerciale immédiate de votre entreprise.",
        how: "Somme(Ventes HT de la date du jour) - Somme(Annulations du jour).",
        example: "Si vous vendez 10 articles à 5 000 F HT, votre CA du Jour affichera 50 000 F.",
        analysis: "Un CA élevé est bon signe, mais il doit être analysé avec la marge. Si vous vendez beaucoup de produits à faible marge, votre effort est important pour un gain final réduit. Comparez-le toujours à celui d'hier pour voir la tendance.",
        color: 'orange'
      },
      {
        id: 'ca_mois',
        title: "Chiffre d'Affaires (Mois)",
        icon: TrendingUp,
        what: "C'est le cumul de toutes les ventes HT réalisées depuis le 1er jour du mois civil en cours. Il permet de mesurer la performance globale sur une période plus longue.",
        how: "Somme(CA HT journalier) du 1er du mois à aujourd'hui.",
        example: "Si vous vendez pour 1 000 000 F chaque jour, le 15 du mois, ce compteur affichera 15 000 000 F.",
        analysis: "C'est votre boussole pour atteindre vos objectifs mensuels. Si au 15 du mois vous n'êtes pas à 50% de votre objectif, il est temps de lancer une action promotionnelle pour rattraper le retard.",
        color: 'emerald'
      },
      {
        id: 'panier_moyen_dash',
        title: "Panier Moyen",
        icon: ShoppingCart,
        what: "C'est le montant moyen dépensé par chaque client lors d'un passage en caisse. Il indique l'efficacité de vos vendeurs à proposer des articles complémentaires.",
        how: "Total CA / Nombre total de transactions (Factures).",
        example: "Si 10 clients ont généré 200 000 F de CA, votre panier moyen est de 20 000 F par client.",
        analysis: "Pour augmenter votre rentabilité sans chercher de nouveaux clients, travaillez à augmenter ce panier moyen (ventes croisées, promotions sur le 2ème article, etc.).",
        color: 'blue'
      },
      {
        id: 'cap_immobilise',
        title: "Valeur Stock (Achat PAMP)",
        icon: Wallet,
        what: "C'est la valeur monétaire totale de vos marchandises en stock, calculée au prix de revient (PAMP). Elle représente le capital net que vous avez investi.",
        how: "Somme(Quantité en Stock x Prix d'Achat Moyen Pondéré).",
        example: "Si vous avez 500 articles en moyenne à 2 000 F l'unité, votre valeur stock est de 1 000 000 F.",
        analysis: "C'est de l'argent 'gelé' dans votre entrepôt. Un bon gestionnaire cherche à optimiser ce chiffre en accélérant la rotation des stocks pour libérer de la trésorerie utile.",
        color: 'emerald'
      },
      {
        id: 'taux_rupture_dash',
        title: "Taux de Rupture",
        icon: AlertTriangle,
        what: "Le pourcentage d'articles dans votre catalogue dont le stock est tombé sous le seuil minimum de sécurité défini dans la fiche produit.",
        how: "(Nombre de produits en alerte / Nombre total de produits actifs) x 100.",
        example: "Sur 100 produits, 5 sont en rupture ou alerte. Votre taux de rupture est de 5%.",
        analysis: "Un taux supérieur à 10% indique un problème de réapprovisionnement imminent. C'est du chiffre d'affaires potentiellement perdu car le client ne trouve pas son produit.",
        color: 'red'
      },
      {
        id: 'transactions_jour',
        title: "Transactions Jour",
        icon: ClipboardList,
        what: "Le nombre total de tickets de caisse ou de factures de vente émis durant la journée. Cela mesure l'affluence physique ou digitale.",
        how: "Compte du nombre total de ventes validées aujourd'hui.",
        example: "Si 50 clients sont passés en caisse aujourd'hui, vous avez 50 transactions enregistrées.",
        analysis: "Un nombre élevé de transactions avec un petit panier moyen signifie beaucoup de travail logistique pour peu de profit. L'objectif est de maximiser la valeur de chaque transaction.",
        color: 'orange'
      },
      {
        id: 'catalogue_total',
        title: "Produits (Catalogue)",
        icon: Package,
        what: "Le nombre total de références d'articles différents créés dans votre base de données. C'est l'étendue théorique de votre offre commerciale.",
        how: "Compte total des fiches dans la table 'Produits' de votre base.",
        example: "Si vous gérez 1 500 références différentes (Sacs, Chaussures, etc.), votre catalogue affiche 1 500 produits.",
        analysis: "Un catalogue trop large peut disperser vos efforts. Un catalogue trop étroit peut lasser le client. Trouvez le juste milieu adapté à votre segment de marché.",
        color: 'purple'
      },
      {
        id: 'dispo_stock',
        title: "Produits en Stock",
        icon: ShoppingBag,
        what: "Le nombre de références dont vous possédez au moins une unité physiquement disponible pour la vente immédiate.",
        how: "Compte des produits ayant une quantité strictement supérieure à zéro en magasin.",
        example: "Sur un catalogue de 200 produits, si 180 sont disponibles immédiatement, votre score est de 180.",
        analysis: "C'est votre 'taux de service' réel. Si ce chiffre est trop bas par rapport au Catalogue total, vos clients seront frustrés de voir des rayons vides ou des indisponibilités.",
        color: 'blue'
      },
      {
        id: 'mouvements_flux',
        title: "Mouvements Jour",
        icon: RefreshCw,
        what: "Reflet de l'activité physique de votre entrepôt : chaque entrée, sortie ou transfert de marchandise généré durant la journée.",
        how: "Somme des lignes créées aujourd'hui dans le journal des mouvements de stock.",
        example: "10 réceptions fournisseurs + 40 ventes = 50 mouvements physiques enregistrés.",
        analysis: "Une forte agitation logistique doit être corrélée au CA. Si les mouvements sont élevés sans ventes réelles (ex: transferts), vous consommez de l'énergie sans profit immédiat.",
        color: 'indigo'
      },
      {
        id: 'clients_actifs_pedago',
        title: "Clients Actifs",
        icon: Users,
        what: "Le nombre total de clients (individus ou entreprises) enregistrés dans votre base avec qui vous entretenez une relation commerciale suivie.",
        how: "Compte total des fiches dans votre annuaire Clients.",
        example: "Si vous avez une base de 1 200 clients identifiés pour vos programmes de fidélité ou vos factures.",
        analysis: "Votre base client est votre plus grand actif. Il coûte 5 fois plus cher d'acquérir un nouveau client que de fidéliser un existant. Exploitez vos fiches clients pour de la relance !",
        color: 'cyan'
      }
    ]
  },
  {
    id: 'commerce_ventes',
    label: '🛒 Commerce : Toutes les ventes',
    icon: ShoppingCart,
    description: 'Analyse en temps réel de votre activité commerciale et de vos encaissements.',
    counters: [
      {
        id: 'ca_aujourdhui_pedago',
        title: "C.A AUJOURD'HUI",
        icon: Target,
        what: "Volume d'affaires brut réalisé sur la journée d'exploitation en cours.",
        how: "Somme des montants des factures de vente validées aujourd'hui.",
        example: "Si vous vendez pour 50 000 F ce matin, le compteur affiche 50 000 F.",
        analysis: "Indique la forme de votre commerce au quotidien. Une baisse soudaine peut nécessiter une action corrective immédiate.",
        color: 'emerald'
      },
      {
        id: 'ca_mois_pedago',
        title: "C.A DU MOIS",
        icon: Calendar,
        what: "Cumul de votre performance commerciale depuis le début du mois actuel.",
        how: "Total des factures validées du 1er au jour J du mois en cours.",
        example: "Au 15 du mois, vous avez atteint 1 200 000 F de chiffre d'affaires.",
        analysis: "Permet de mesurer votre progression par rapport à vos objectifs mensuels.",
        color: 'blue'
      },
      {
        id: 'total_encaisse_ventes_pedago',
        title: "TOTAL ENCAISSÉ",
        icon: Wallet,
        what: "Argent réel perçu suite à vos ventes (Cash, Banque, Mobile Money).",
        how: "Total des règlements clients liés aux ventes de la période.",
        example: "Sur 300 000 F de CA, vous avez effectivement reçu 250 000 F.",
        analysis: "Le nerf de la guerre. Un CA sans encaissement n'est qu'un chiffre théorique qui fragilise votre cash-flow.",
        color: 'orange'
      },
      {
        id: 'nb_ventes_pedago',
        title: "NOMBRE DE VENTES",
        icon: ShoppingBag,
        what: "Nombre total de transactions commerciales (actes d'achat) effectuées.",
        how: "Compte du nombre de factures de vente enregistrées.",
        example: "Vous avez servi 45 clients différents cette semaine.",
        analysis: "Indique la fréquentation et la capacité de votre force de vente à conclure des transactions.",
        color: 'indigo'
      }
    ]
  },
  {
    id: 'commerce_achats',
    label: '🛒 Commerce : Achats',
    icon: ShoppingBag,
    description: 'Suivi de vos engagements financiers immédiats auprès de vos fournisseurs.',
    counters: [
      {
        id: 'total_facture_achats_pedago',
        title: "Total Facturé",
        icon: FileText,
        what: "Montant total des marchandises facturées par vos fournisseurs sur la période.",
        how: "Somme des montants TTC des factures d'achat validées.",
        example: "Vous avez reçu pour 2 000 000 F de nouvelles marchandises cette semaine.",
        analysis: "Mesure l'intensité de votre réapprovisionnement et votre investissement stock.",
        color: 'orange'
      },
      {
        id: 'total_decaisse_achats_pedago',
        title: "Total Décaissé",
        icon: Briefcase,
        what: "Somme totale d'argent versée à vos fournisseurs pour payer vos achats.",
        how: "Total des paiements effectués sur les factures fournisseur.",
        example: "Vous avez déjà payé 1 200 000 F sur vos factures de la semaine.",
        analysis: "Représente votre flux de trésorerie sortant lié à l'exploitation marchande.",
        color: 'blue'
      },
      {
        id: 'reste_a_payer_achats_pedago',
        title: "Reste à Payer",
        icon: Scale,
        what: "Montant des dettes fournisseurs générées ou restant à liquider sur vos achats.",
        how: "Total Facturé - Total Décaissé.",
        example: "Il vous reste 800 000 F à payer à vos partenaires logistiques.",
        analysis: "Un reste à payer élevé peut freiner vos prochaines livraisons. Restez vigilant sur vos délais de paiement.",
        color: 'red'
      }
    ]
  },
  {
    id: 'commerce_tous_achats',
    label: '🛒 Commerce : Tous les achats',
    icon: ClipboardList,
    description: 'Synthèse historique et globale de vos relations financières fournisseurs.',
    counters: [
      {
        id: 'volume_achats_global_pedago',
        title: "VOLUME ACHATS",
        icon: ShoppingCart,
        what: "Mesure globale de votre engagement financier historique auprès des tiers.",
        how: "Cumul de tous les achats enregistrés depuis le début de l'exercice.",
        example: "Votre volume d'achat global s'élève à 15 000 000 F.",
        analysis: "Indique votre poids commercial et votre importance stratégique pour vos fournisseurs.",
        color: 'indigo'
      },
      {
        id: 'total_paye_global_pedago',
        title: "TOTAL PAYÉ",
        icon: Wallet,
        what: "Total cumulé de tous les règlements fournisseurs effectués.",
        how: "Somme de tous les paiements fournisseur enregistrés.",
        example: "12 500 000 F ont déjà été versés à l'ensemble de vos fournisseurs.",
        analysis: "Reflet de votre solvabilité et de votre respect des engagements contractuels.",
        color: 'emerald'
      },
      {
        id: 'reste_a_payer_global_pedago',
        title: "RESTE À PAYER",
        icon: Scale,
        what: "Montant total de votre dette globale envers l'ensemble des fournisseurs.",
        how: "VOLUME ACHATS - TOTAL PAYÉ.",
        example: "Votre encours fournisseur global est de 2 500 000 F.",
        analysis: "Indicateur critique pour la stabilité de votre bilan et de vos relations tiers.",
        color: 'red'
      },
      {
        id: 'nb_operations_achats_pedago',
        title: "NB OPÉRATIONS",
        icon: History,
        what: "Volume total de transactions d'achat traitées par le système.",
        how: "Compte du nombre total de factures fournisseur enregistrées.",
        example: "Vous avez effectué 85 opérations de réapprovisionnement.",
        analysis: "Indique la fréquence et la complexité administrative de votre chaîne d'approvisionnement.",
        color: 'slate'
      }
    ]
  },
  {
    id: 'logistique',
    label: '📦 Logistique',
    icon: Package,
    description: 'Suivi des stocks, des entrées et des sorties.',
    counters: [
      {
        id: 'valeur_pamp',
        title: "Valeur au PAMP",
        icon: Calculator,
        what: "C'est la valeur comptable officielle de votre stock. Elle utilise le Prix d'Achat Moyen Pondéré pour lisser les variations de prix de vos fournisseurs.",
        how: "Quantité en Stock x Prix de revient moyen.",
        example: "Si vous avez acheté 10 articles à 500 F, puis 10 articles à 600 F, votre PAMP est de 550 F. Valeur = 20 x 550 F = 11 000 F.",
        analysis: "C'est la valeur réelle de votre patrimoine marchandise. En cas d'inventaire de fin d'année, c'est ce chiffre qui est retenu pour le bilan.",
        color: 'indigo'
      },
      {
        id: 'valeur_vente_pot',
        title: "Valeur Vente Potentielle",
        icon: TrendingUp,
        what: "C'est le chiffre d'affaires maximum que vous pourriez réaliser si vous vendiez tout votre stock actuel au prix de vente affiché aujourd'hui.",
        how: "Somme(Quantité en Stock x Prix de Vente Actuel).",
        example: "100 articles en stock, vendus à 1 000 F l'unité. Valeur de vente = 100 000 F.",
        analysis: "Cet indicateur vous donne une idée de la richesse 'dormante' qui peut se transformer en cash rapidement.",
        color: 'emerald'
      },
      {
        id: 'marge_latente',
        title: "Marge Latente",
        icon: PieChart,
        what: "C'est le bénéfice théorique que vous réaliserez une fois que tout votre stock actuel sera vendu.",
        how: "Valeur Vente Potentielle - Valeur au PAMP.",
        example: "Stock acheté 1M F, vendable à 1,5M F. Marge latente = 500 000 F.",
        analysis: "Si ce chiffre est trop bas, vos prix de vente sont peut-être trop proches de vos prix d'achat. Vérifiez vos marges bénéficiaires !",
        color: 'purple'
      }
    ]
  },
  {
    id: 'finances_caisse',
    label: '💰 Finances : Caisse',
    icon: Wallet,
    description: 'Gestion des flux de trésorerie liquide et suivi du tiroir-caisse.',
    counters: [
      {
        id: 'caisse_entrees',
        title: "Caisse : Total entrées",
        icon: TrendingUp,
        what: "Cumul de toutes les liquidités encaissées physiquement durant la période.",
        how: "Somme des mouvements d'entrée dans le journal de caisse.",
        example: "Si vous encaissez 500 000 F de ventes en espèces, le compteur affiche 500 000 F.",
        analysis: "Représente votre capacité à générer du cash immédiat.",
        color: 'emerald'
      },
      {
        id: 'caisse_sorties',
        title: "Caisse : Total sorties",
        icon: TrendingDown,
        what: "Cumul de toutes les liquidités décaissées physiquement.",
        how: "Somme des mouvements de sortie dans le journal de caisse.",
        example: "Paiement d'une facture EDF de 25 000 F en espèces.",
        analysis: "À surveiller pour éviter les sorties non justifiées.",
        color: 'orange'
      },
      {
        id: 'caisse_solde_flux',
        title: "Caisse : Solde Flux (E-S)",
        icon: Scale,
        what: "Différence nette entre les entrées et les sorties de cash sur la période.",
        how: "Total entrées - Total sorties.",
        example: "1M entré - 800k sorti = 200k de flux net positif.",
        analysis: "Indique si l'activité de caisse est excédentaire ou déficitaire.",
        color: 'blue'
      },
      {
        id: 'caisse_credits_at_percevoir',
        title: "Crédits Clients (À Percevoir)",
        icon: Users,
        what: "Montant total que vos clients vous doivent actuellement.",
        how: "Somme des restes à percevoir sur les factures clients.",
        example: "1 500 000 F d'impayés clients en attente de recouvrement.",
        analysis: "C'est votre principal levier de trésorerie court terme.",
        color: 'red'
      },
      {
        id: 'caisse_factures_at_percevoir',
        title: "Factures Clients (À Percevoir)",
        icon: FileText,
        what: "Nombre total de factures de vente non encore soldées.",
        how: "Compte des factures ayant un solde positif.",
        example: "12 factures clients en attente de paiement.",
        analysis: "Mesure l'éparpillement de vos créances clients.",
        color: 'slate'
      },
      {
        id: 'caisse_dettes_at_regler',
        title: "Dettes Fournisseurs (À Régler)",
        icon: Briefcase,
        what: "Montant total que vous devez à vos fournisseurs.",
        how: "Somme des restes à régler sur les factures d'achat.",
        example: "Vous devez 800 000 F à vos différents partenaires.",
        analysis: "Votre passif exigible à court terme.",
        color: 'orange'
      },
      {
        id: 'caisse_factures_at_regler',
        title: "Factures Fourn. (À Régler)",
        icon: ClipboardList,
        what: "Nombre total de factures d'achat en attente de paiement.",
        how: "Compte des factures fournisseur non soldées.",
        example: "5 factures fournisseurs en attente de règlement.",
        analysis: "Mesure la complexité de votre gestion de passif.",
        color: 'purple'
      },
      {
        id: 'caisse_report',
        title: "Caisse : Report (Début)",
        icon: History,
        what: "L'argent présent en caisse au premier jour de la période.",
        how: "Solde final de la veille de la date de début.",
        example: "Au 1er du mois, il y avait 50 000 F en caisse.",
        analysis: "Point de départ de votre trésorerie mensuelle.",
        color: 'slate'
      },
      {
        id: 'caisse_flux_net',
        title: "Caisse : Flux Net",
        icon: RefreshCw,
        what: "Solde des mouvements de la période seule (Entrées - Sorties).",
        how: "Total Entrées - Total Sorties.",
        example: "+200 000 F signifie que vous avez plus encaissé que dépensé.",
        analysis: "Performance de liquidité pure sur la fenêtre choisie.",
        color: 'emerald'
      },
      {
        id: 'caisse_solde_cash_actuel',
        title: "Solde Cash Actuel",
        icon: Banknote,
        what: "Le montant qui doit se trouver physiquement dans le tiroir-caisse.",
        how: "Report + Entrées - Sorties.",
        example: "250 000 F présents réellement au comptoir.",
        analysis: "C'est le chiffre de référence pour votre arrêté de caisse.",
        color: 'red'
      }
    ]
  },
  {
    id: 'finances_banque',
    label: '🏦 Finances : Banque',
    icon: CreditCard,
    description: 'Suivi des comptes bancaires et des flux via Mobile Money.',
    counters: [
      {
        id: 'banque_mobile_money',
        title: "Mobile Money",
        icon: Zap,
        what: "Fonds stockés sur vos comptes marchands (Wave, Orange, etc.).",
        how: "Somme des soldes des comptes de type 'Mobile Money'.",
        example: "150 000 F disponibles sur votre terminal Wave.",
        analysis: "Trésorerie digitale rapide et sécurisée.",
        color: 'blue'
      },
      {
        id: 'banque_virements',
        title: "Virements Bancaires",
        icon: RefreshCw,
        what: "Transferts de fonds par voie bancaire classique.",
        how: "Cumul des transactions de type 'Virement'.",
        example: "Un client a payé 2 000 000 F par virement BOA.",
        analysis: "Idéal pour les transactions B2B de gros volumes.",
        color: 'indigo'
      },
      {
        id: 'banque_cheques',
        title: "Chèques",
        icon: FileText,
        what: "Valeur des chèques reçus et en attente d'encaissement réel.",
        how: "Somme des montants des chèques non encore 'Rapprochés'.",
        example: "Deux chèques de 250k déposés mais pas encore au crédit.",
        analysis: "Trésorerie 'latente' : l'argent n'est pas encore utilisable.",
        color: 'slate'
      },
      {
        id: 'banque_total_comptes',
        title: "Total comptes",
        icon: Landmark,
        what: "Nombre de comptes bancaires et marchands actifs.",
        how: "Nombre de comptes créés dans le paramétrage Finances.",
        example: "Vous gérez 3 comptes différents (BOA, NSIA, Wave).",
        analysis: "Une multiplicité de comptes complexifie le suivi.",
        color: 'purple'
      },
      {
        id: 'banque_total_depots',
        title: "Total dépôts (tous comptes)",
        icon: TrendingUp,
        what: "Cumul des fonds injectés en banque sur la période.",
        how: "Somme de tous les dépôts/encaissements bancaires.",
        example: "10 000 000 F déposés sur vos comptes ce mois.",
        analysis: "Volume de sécurisation de vos revenus.",
        color: 'emerald'
      },
      {
        id: 'banque_total_retraits',
        title: "Total retraits (tous comptes)",
        icon: TrendingDown,
        what: "Cumul des fonds sortants de vos comptes (virements, chèques émis).",
        how: "Somme de tous les retraits/paiements bancaires.",
        example: "8 000 000 F payés depuis la banque.",
        analysis: "Mesure votre recours au circuit financier pro pour vos dettes.",
        color: 'orange'
      },
      {
        id: 'banque_solde_total',
        title: "Solde total",
        icon: Calculator,
        what: "Position nette de l'ensemble de vos avoirs bancaires.",
        how: "Total Dépôts - Total Retraits + Solde Initial.",
        example: "Votre richesse 'en ligne' s'élève à 15 000 000 F.",
        analysis: "Indique votre solvabilité globale.",
        color: 'blue'
      }
    ]
  },
  {
    id: 'finances_depenses',
    label: '💸 Finances : Dépenses',
    icon: DollarSign,
    description: 'Suivi des petits frais et achats de fonctionnement courant.',
    counters: [
      {
        id: 'depenses_total',
        title: "Total dépenses",
        icon: Banknote,
        what: "Cumul des frais de fonctionnement courant (Transport, fournitures).",
        how: "Somme des lignes du module Dépenses.",
        example: "120 000 F de frais de bureau ce mois.",
        analysis: "Sorties de fonds qui 'grignotent' votre marge.",
        color: 'orange'
      },
      {
        id: 'depenses_nombre',
        title: "Nombre de dépenses",
        icon: ClipboardList,
        what: "Fréquence des actes de dépenses durant la période.",
        how: "Nombre de tickets de dépenses enregistrés.",
        example: "25 petits achats effectués ce mois.",
        analysis: "Un nombre élevé indique un besoin de structurer les achats.",
        color: 'slate'
      },
      {
        id: 'depenses_moyenne',
        title: "Moyenne",
        icon: PieChart,
        what: "Montant moyen d'un ticket de dépense typique.",
        how: "Total Dépenses / Nombre Dépenses.",
        example: "Environ 4 800 F par acte d'achat.",
        analysis: "Permet de surveiller l'inflation de vos coûts internes.",
        color: 'blue'
      }
    ]
  },
  {
    id: 'finances_charges',
    label: '📊 Finances : Charges',
    icon: TrendingUp,
    description: 'Analyse des coûts structurels et d\'exploitation de l\'entreprise.',
    counters: [
      {
        id: 'charges_total',
        title: "Total charges",
        icon: Scale,
        what: "Poids total de l'exploitation sur vos revenus.",
        how: "Somme de toutes les catégories de charges.",
        example: "Vos charges s'élèvent à 1 500 000 F par mois.",
        analysis: "C'est le coût incompressible du maintien de votre activité.",
        color: 'red'
      },
      {
        id: 'charges_fixes',
        title: "Charges fixes",
        icon: ShieldCheck,
        what: "Coûts qui ne varient pas selon vos ventes (Loyer, Salaire de base).",
        how: "Somme des charges identifiées comme 'Fixes'.",
        example: "Loyer : 400 000 F (à payer même à 0 vente).",
        analysis: "Représente votre risque financier structurel.",
        color: 'blue'
      },
      {
        id: 'charges_variables',
        title: "Charges variables",
        icon: Zap,
        what: "Coûts liés au volume d'activité (Commissions, Emballages).",
        how: "Somme des charges identifiées comme 'Variables'.",
        example: "Cartons d'emballage : proportionnels aux ventes.",
        analysis: "Charges moins risquées car liées aux revenus.",
        color: 'orange'
      }
    ]
  },
  {
    id: 'finances_ecritures',
    label: '🔍 Finances : Écritures',
    icon: Calculator,
    description: 'Audit et synthèse comptable de toutes les opérations du logiciel.',
    counters: [
      {
        id: 'audit_ventes',
        title: "Ventes (validées)",
        icon: ShoppingCart,
        what: "Chiffre d'affaires validé au journal comptable.",
        how: "Somme HT des factures ayant généré une écriture.",
        example: "5 000 000 F de CA validé comptablement.",
        analysis: "La colonne vertébrale de vos revenus.",
        color: 'emerald'
      },
      {
        id: 'audit_achats',
        title: "Achats",
        icon: ShoppingBag,
        what: "Inscription comptable de vos réapprovisionnements.",
        how: "Somme HT des factures fournisseur comptabilisées.",
        example: "3 000 000 F d'achats inscrits au grand livre.",
        analysis: "Mesure votre investissement marchand.",
        color: 'indigo'
      },
      {
        id: 'audit_depenses',
        title: "Dépenses",
        icon: DollarSign,
        what: "Reflet comptable des petits frais de fonctionnement.",
        how: "Total des écritures liées aux comptes de dépenses.",
        example: "150 000 F de frais généraux enregistrés.",
        analysis: "Indique la complétude de votre saisie comptable.",
        color: 'orange'
      },
      {
        id: 'audit_charges',
        title: "Charges",
        icon: TrendingDown,
        what: "Poids définitif des charges dans votre bilan de période.",
        how: "Total des écritures au débit des comptes de charges.",
        example: "1 200 000 F de charges salariales et autres.",
        analysis: "Base de calcul de votre résultat net imposable.",
        color: 'red'
      },
      {
        id: 'audit_ecritures_count',
        title: "Écritures",
        icon: ClipboardList,
        what: "Le volume total de lignes d'écritures générées par le système.",
        how: "Compte des enregistrements au journal général.",
        example: "1 500 écritures générées pour la période.",
        analysis: "Témoigne de l'activité intense et du suivi exhaustif.",
        color: 'slate'
      }
    ]
  },
  {
    id: 'tiers_releves',
    label: '📋 Tiers : Relevés',
    icon: FileText,
    description: 'Analyse détaillée des transactions par partenaire sur une période donnée.',
    counters: [
      {
        id: 'tiers_facture_periode',
        title: "Facturé (Période)",
        icon: Target,
        what: "C'est la somme totale des factures validées sur la plage de dates sélectionnée. Elle représente le volume d'affaires brut généré avec le tiers.",
        how: "Somme(Montant TTC de toutes les factures de vente du client sur la période).",
        example: "Si vous avez fait 3 ventes de 100 000 F chacune ce mois, le compteur affiche 300 000 F.",
        analysis: "C'est votre base de calcul pour le recouvrement. Un montant facturé élevé est une performance commerciale, mais il doit être suivi d'un encaissement réel.",
        color: 'orange'
      },
      {
        id: 'tiers_paye_periode',
        title: "Payé (Période)",
        icon: Wallet,
        what: "Le total des règlements effectivement encaissés durant la période sélectionnée pour ce tiers spécifique.",
        how: "Somme(Tous les paiements reçus et liés à des factures sur la période).",
        example: "Sur les 300 000 F facturés ce mois, le client n'a versé que 200 000 F. Le compteur affiche 200 000 F.",
        analysis: "Le nerf de la guerre. Un CA sans encaissement met en péril votre trésorerie. Ce compteur doit être le plus proche possible du 'Facturé'.",
        color: 'emerald'
      },
      {
        id: 'tiers_solde_periode',
        title: "Solde Période",
        icon: Scale,
        what: "L'écart net entre les factures émises et les paiements reçus exclusivement sur la période choisie.",
        how: "Facturé (Période) - Payé (Période).",
        example: "300k facturés - 200k payés = 100k de dette client générée spécifiquement ce mois.",
        analysis: "Si ce chiffre est positif, la dette du client augmente sur cette période. S'il est négatif, le client est en train d'apurer ses dettes anciennes en payant plus qu'il n'achète.",
        color: 'blue'
      },
      {
        id: 'tiers_solde_global_client',
        title: "Solde Global Client",
        icon: ShieldCheck,
        what: "La situation financière totale et historique du client vis-à-vis de votre entreprise, incluant les dettes passées.",
        how: "(Somme Ventes Historiques + Solde Initial) - Somme Paiements Historiques.",
        example: "Le client devait 50k avant. Avec le solde de 100k de ce mois, son Solde Global est de 150k.",
        analysis: "C'est le montant total que vous pourriez perdre si le tiers disparaissait. C'est l'indicateur ultime pour décider de bloquer ou non une nouvelle livraison.",
        color: 'red'
      }
    ]
  },
  {
    id: 'tiers_soldes_clients',
    label: '👥 Tiers : Soldes Clients',
    icon: FileText,
    description: 'Suivi de l\'endettement global et historique de votre portefeuille client.',
    counters: [
      {
        id: 'tiers_total_factures',
        title: "Total Factures",
        icon: ClipboardList,
        what: "Le cumul historique de toutes les ventes TTC réalisées pour ce client depuis sa création dans votre base.",
        how: "Somme(Montant TTC de toutes les factures depuis l'origine).",
        example: "Un client fidèle qui a acheté pour un montant total de 2 000 000 F en 2 ans.",
        analysis: "Mesure l'importance stratégique du client. Plus ce chiffre est élevé, plus le tiers est un 'gros' client pour votre entreprise.",
        color: 'indigo'
      },
      {
        id: 'tiers_total_paiements',
        title: "Total Paiements",
        icon: UserCheck,
        what: "Le cumul historique de tous les fonds versés par le client pour régler ses achats.",
        how: "Somme(Tous les règlements reçus historiquement du client).",
        example: "Le client a versé 1 800 000 F au total sur ses 2 000 000 F de factures historiques.",
        analysis: "Indique la fiabilité et la moralité du client. Un client avec un gros Total Factures et un faible Total Paiements est un partenaire à risque.",
        color: 'emerald'
      },
      {
        id: 'tiers_variation_periode',
        title: "Variation Période",
        icon: RefreshCw,
        what: "Reflète l'évolution de la créance client durant la fenêtre de temps sélectionnée.",
        how: "(Ventes de la Période) - (Paiements de la Période).",
        example: "Ce mois-ci, le client a payé 50k mais n'a rien acheté. Variation = -50 000 F (sa dette baisse).",
        analysis: "Permet de voir si vos actions de recouvrement sur la période sont efficaces pour réduire l'endettement.",
        color: 'orange'
      },
      {
        id: 'tiers_solde_net_global',
        title: "Solde Net Global",
        icon: Calculator,
        what: "Le reste à payer définitif et immédiat du client, toutes périodes confondues.",
        how: "Total Factures - Total Paiements + Report de Solde Initial.",
        example: "Le client vous doit encore précisément 200 000 F après déduction de tous ses versements.",
        analysis: "C'est l'argent 'dehors' qui vous manque pour boucler votre trésorerie. C'est ce chiffre qui doit être relancé prioritairement.",
        color: 'red'
      }
    ]
  },
  {
    id: 'tiers_paiements_clients',
    label: '💳 Tiers : Paiements',
    icon: Wallet,
    description: 'Analyse des modes d\'encaissement et des flux financiers entrants.',
    counters: [
      {
        id: 'tiers_total_encaisse',
        title: "Total Encaissé (Période)",
        icon: Wallet,
        what: "La somme globale de tous les encaissements clients reçus, tous modes de paiement confondus.",
        how: "Somme(Espèces + Mobile Money + Chèques + Multi) sur la période.",
        example: "Vous avez encaissé 1 500 000 F ce mois-ci via vos différents canaux.",
        analysis: "C'est le flux entrant principal. Il doit couvrir vos charges (loyer, salaires, achats) pour que l'entreprise soit autonome.",
        color: 'emerald'
      },
      {
        id: 'tiers_paye_multi',
        title: "MULTI",
        icon: PieChart,
        what: "Paiements effectués par le client en mélangeant plusieurs modes de règlement pour une même transaction.",
        how: "Somme des transactions marquées comme 'MULTI' dans le journal des ventes.",
        example: "Un client paie une facture de 50k en versant 10k en espèces et 40k par Wave.",
        analysis: "Indique la flexibilité que vous offrez. C'est utile pour les transactions importantes où le client n'a pas tout son argent sur un seul support.",
        color: 'purple'
      },
      {
        id: 'tiers_paye_especes',
        title: "ESPECES",
        icon: Banknote,
        what: "Argent liquide déposé directement par vos clients dans votre caisse physique.",
        how: "Somme des encaissements enregistrés en mode 'ESPECES'.",
        example: "1 000 000 F encaissés en billets et pièces directement au comptoir.",
        analysis: "Trésorerie la plus liquide mais aussi la plus risquée. Nécessite un contrôle rigoureux du 'fond de caisse' chaque soir.",
        color: 'orange'
      },
      {
        id: 'tiers_paye_mobile',
        title: "MOBILE MONEY",
        icon: Zap,
        what: "Paiements reçus via les services de transfert mobile (Wave, Orange Money, Moov, etc.).",
        how: "Somme des encaissements en mode 'MOBILE_MONEY'.",
        example: "300 000 F reçus sur votre compte marchand mobile ce mois-ci.",
        analysis: "Canal moderne, sécurisé et rapide. Il facilite les paiements à distance et réduit les manipulations d'espèces.",
        color: 'blue'
      },
      {
        id: 'tiers_paye_cheque',
        title: "CHEQUE",
        icon: History,
        what: "Règlements effectués par les clients via des chèques bancaires.",
        how: "Somme des montants des chèques reçus sur la période.",
        example: "Deux chèques de 250k chacun déposés pour encaissement bancaire.",
        analysis: "Attention au risque d'impayés (chèques sans provision) et au délai de traitement de la banque qui retarde la disponibilité réelle des fonds.",
        color: 'slate'
      }
    ]
  },
  {
    id: 'tiers_soldes_fournisseurs',
    label: '🚚 Tiers : Achats',
    icon: FileText,
    description: 'Suivi de vos engagements financiers vis-à-vis de vos fournisseurs.',
    counters: [
      {
        id: 'tiers_fourn_achats',
        title: "Achats (Période)",
        icon: ShoppingBag,
        what: "Valeur totale des marchandises et services que vous avez reçus de vos fournisseurs sur la période.",
        how: "Somme(Montant TTC des factures d'achat ou réceptions validées).",
        example: "Vous avez commandé et réceptionné pour 4 000 000 F de stock pour remplir vos rayons.",
        analysis: "Mesure votre effort de réapprovisionnement. Un chiffre élevé signifie un investissement massif dans votre futur stock.",
        color: 'indigo'
      },
      {
        id: 'tiers_fourn_paye',
        title: "Payé (Période)",
        icon: CreditCard,
        what: "La somme totale que vous avez effectivement décaissée pour régler vos dettes envers vos fournisseurs.",
        how: "Somme(Tous les règlements fournisseurs effectués sur la période).",
        example: "Vous avez payé 3 000 000 F sur les 4 000 000 F d'achats effectués ce mois.",
        analysis: "Indique la ponctualité de vos règlements. Bien gérer ce chiffre permet de garder de bonnes relations et d'obtenir de meilleurs délais de paiement.",
        color: 'emerald'
      },
      {
        id: 'tiers_fourn_variation',
        title: "Variation Dette",
        icon: TrendingUp,
        what: "L'écart entre vos nouveaux achats et vos paiements réels durant la période.",
        how: "Achats (Période) - Payé (Période).",
        example: "4M achats - 3M payés = 1 000 000 F de dette supplémentaire créée ce mois.",
        analysis: "Si positif, vous augmentez votre levier fournisseur. Si trop élevé, vous risquez un blocage de livraison pour cause d'impayés.",
        color: 'orange'
      },
      {
        id: 'tiers_fourn_dette_totale',
        title: "Dette Totale Net",
        icon: AlertTriangle,
        what: "Le montant total que vous devez encore à l'ensemble de vos fournisseurs, toutes périodes confondues.",
        how: "(Total Achats Historiques + Solde Initial) - Total Paiements Fournisseurs.",
        example: "Globalement, vous avez une dette en attente de 2 500 000 F vers vos partenaires.",
        analysis: "C'est votre passif fournisseur. Il doit être équilibré par rapport à votre stock et vos créances clients pour éviter la rupture de cash.",
        color: 'red'
      }
    ]
  },
  {
    id: 'tiers_paiements_fournisseurs',
    label: '💸 Tiers : Décaissements',
    icon: Wallet,
    description: 'Analyse des sorties de fonds pour le règlement des dettes d\'exploitation.',
    counters: [
      {
        id: 'tiers_fourn_total_decaisse',
        title: "Total Décaissé (Période)",
        icon: Briefcase,
        what: "Le volume financier global sorti de votre trésorerie pour payer vos fournisseurs.",
        how: "Somme de tous les règlements fournisseurs (Caisse + Banque).",
        example: "5 000 000 F sont sortis de vos comptes ce mois-ci pour apurer vos dettes d'achat.",
        analysis: "C'est votre flux de trésorerie sortant. Il doit être inférieur à vos encaissements clients pour que votre cash reste positif.",
        color: 'blue'
      },
      {
        id: 'tiers_fourn_decaisse_especes',
        title: "ESPECES",
        icon: Banknote,
        what: "Part des paiements fournisseurs effectués directement en espèces (billets/pièces).",
        how: "Somme des décaissements fournisseurs en mode 'ESPECES'.",
        example: "500 000 F payés cash à un fournisseur local lors d'une livraison urgente.",
        analysis: "Pratique pour les petits achats ou les livraisons spot, mais doit être rigoureusement justifié par un reçu pour la comptabilité.",
        color: 'orange'
      }
    ]
  },
  {
    id: 'analytique',
    label: '📊 Analytique : Performance',
    icon: TrendingUp,
    description: 'Analyse fine des performances commerciales et de la rentabilité.',
    counters: [
      {
        id: 'top_ventes_analytique',
        title: "Performance Top Produits",
        icon: Target,
        what: "Identifie les 20% de vos produits qui génèrent généralement 80% de votre chiffre d'affaires (Loi de Pareto).",
        how: "Classement décroissant des produits par CA généré sur la période.",
        example: "Le 'Produit A' génère 40% de vos ventes totales : c'est votre produit phare.",
        analysis: "Si un produit phare tombe en rupture, c'est une catastrophe pour votre CA. Sécurisez prioritairement le stock de vos Top Ventes.",
        color: 'emerald'
      },
      {
        id: 'rotation_stock_pedago',
        title: "Vitesse de Rotation",
        icon: RefreshCw,
        what: "Indique combien de fois votre stock est 'vendu et remplacé' sur une période donnée. Reflet de la vitalité de votre commerce.",
        how: "CA Total / Valeur moyenne du stock.",
        example: "Une rotation de 12 signifie que vous renouvelez votre stock complet chaque mois.",
        analysis: "Rotation élevée = Argent qui travaille vite. Rotation faible = Poussière sur les étagères et capital qui dort.",
        color: 'purple'
      },
      {
        id: 'repartition_cat_pedago',
        title: "Répartition par Catégorie",
        icon: PieChart,
        what: "Analyse l'équilibre de votre catalogue. Permet de voir sur quelle famille de produits repose votre rentabilité.",
        how: "% de CA ou de Marge par Catégorie de produits.",
        example: "La catégorie 'Accessoires' représente 15% du CA mais 40% de la marge nette.",
        analysis: "Parfois, une catégorie à faible volume peut être plus rentable qu'une catégorie à gros volume. C'est l'essence de l'analyse stratégique.",
        color: 'indigo'
      }
    ]
  },
  {
    id: 'analytique_rapports',
    label: '📊 Analytique : Rapports Généraux',
    icon: FileBarChart,
    description: 'Lecture et interprétation des indicateurs clés de performance (KPI).',
    counters: [
      {
        id: 'ca_facture_global',
        title: "Chiffre d'Affaires Facturé",
        icon: Target,
        what: "Total des ventes validées (Factures émises) durant la période sélectionnée.",
        how: "Somme des montants TTC de toutes les factures validées.",
        example: "Si vous émettez 10 factures de 1M chacune, votre CA Facturé est de 10M.",
        analysis: "Mesure la puissance commerciale brute. Attention : ce n'est pas encore de l'argent en banque !",
        color: 'blue'
      },
      {
        id: 'tresorerie_encaissee',
        title: "Trésorerie Encaissée",
        icon: Wallet,
        what: "Argent réellement perçu en caisse ou en banque sur la période.",
        how: "Somme de tous les règlements clients encaissés sur la période.",
        example: "Sur les 10M facturés, 8M ont été effectivement payés.",
        analysis: "La réalité de votre cash-flow. Indispensable pour payer vos charges et vos fournisseurs.",
        color: 'emerald'
      },
      {
        id: 'performance_recouvrement',
        title: "Performance Recouvrement",
        icon: ShieldCheck,
        what: "Taux d'efficacité de collecte des créances clients.",
        how: "(Trésorerie Encaissée / CA Facturé) x 100.",
        example: "8M encaissés / 10M facturés = 80% de taux de recouvrement.",
        analysis: "En dessous de 70%, votre entreprise court un risque de crise de liquidité.",
        color: 'orange'
      },
      {
        id: 'valeur_inventaire_globale',
        title: "Valeur Inventaire Globale",
        icon: Package,
        what: "Richesse monétaire immobilisée dans votre entrepôt.",
        how: "Somme(Quantité en Stock x Prix d'Achat Moyen Pondéré).",
        example: "Votre stock actuel vaut 25M FCFA au prix de revient.",
        analysis: "C'est de l'argent 'endormi'. Optimisez vos commandes pour libérer du cash.",
        color: 'purple'
      },
      {
        id: 'alertes_rupture_pedago',
        title: "Alertes Rupture",
        icon: AlertTriangle,
        what: "Nombre de références critiques ayant atteint le seuil minimum de sécurité.",
        how: "Compte des produits dont le stock <= seuil d'alerte défini.",
        example: "15 produits sont en rupture ou alerte imminente.",
        analysis: "Chaque jour de rupture est une vente perdue que vous ne rattraperez jamais.",
        color: 'red'
      },
      {
        id: 'flux_periode_pedago',
        title: "Flux Période",
        icon: RefreshCw,
        what: "Intensité des entrées et sorties de marchandises sur la période.",
        how: "Somme totale des quantités mouvementées (Entrées + Sorties).",
        example: "1 500 articles ont transité par vos magasins ce mois-ci.",
        analysis: "Témoigne de la vitalité logistique. Un flux élevé sans CA élevé signifie des manipulations coûteuses.",
        color: 'indigo'
      }
    ]
  }
]

export default function PedagogiePage() {
  const [activeCategory, setActiveCategory] = useState('dashboard')
  const [currentIndex, setCurrentIndex] = useState(0)

  const currentCategory = PEDAGOGIE_DATA.find(c => c.id === activeCategory) || PEDAGOGIE_DATA[0]
  const currentCounter = currentCategory.counters[currentIndex] || currentCategory.counters[0]

  const handleNext = () => {
    if (currentIndex < currentCategory.counters.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setCurrentIndex(0) // Loop back
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    } else {
      setCurrentIndex(currentCategory.counters.length - 1) // Loop back
    }
  }

  const changeCategory = (id: string) => {
    setActiveCategory(id)
    setCurrentIndex(0)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans selection:bg-orange-500 selection:text-white">
      {/* HERO SECTION DYNAMIQUE PREMIUM */}
      <div className="bg-slate-950 px-6 py-24 text-white text-center relative overflow-hidden">
         <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-600/10 blur-[180px] rounded-full -translate-y-1/2 translate-x-1/2 animate-pulse" />
         <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/5 blur-[180px] rounded-full translate-y-1/2 -translate-x-1/2" />
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
         
         <div className="relative z-10 max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.3em] text-orange-400 mb-8 backdrop-blur-2xl shadow-2xl">
                <Lightbulb className="h-4 w-4 animate-pulse text-orange-500" /> Académie Expertise GestiCom Pro
            </div>
            <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter uppercase mb-6 leading-[0.9] drop-shadow-2xl">
              GUIDE <span className="text-orange-500 underline decoration-[10px] underline-offset-[15px] decoration-orange-600/30">PÉDAGOGIQUE</span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl font-bold max-w-2xl mx-auto uppercase tracking-tighter italic opacity-95 leading-tight">
               Maîtrisez les indicateurs de votre réussite. Pour chaque page, un expert métier vous explique l'essentiel.
            </p>
         </div>
      </div>

      {/* TABS NAVIGATION XXL - Version Horizontale Scrollable sur Mobile */}
      <div className="max-w-7xl mx-auto px-6 -mt-12 relative z-20">
          <div className="flex flex-wrap justify-center gap-4">
              {PEDAGOGIE_DATA.map((cat) => (
                  <button
                      key={cat.id}
                      onClick={() => changeCategory(cat.id)}
                      className={`flex items-center gap-4 px-8 py-6 rounded-[35px] transition-all duration-500 border-2 ${
                          activeCategory === cat.id 
                          ? 'bg-white border-orange-500 shadow-[0_35px_70px_-20px_rgba(249,115,22,0.3)] scale-105 -translate-y-2' 
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                  >
                      <cat.icon className={`h-6 w-6 ${activeCategory === cat.id ? 'text-orange-600' : 'text-slate-600'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${activeCategory === cat.id ? 'text-slate-950' : 'text-slate-500'}`}>
                          {cat.label}
                      </span>
                  </button>
              ))}
          </div>
      </div>

      {/* MAIN CONTENT AREA - PAGINATION PAR COMPTEUR */}
      <div className="max-w-6xl mx-auto px-6 mt-24">
          <div className="mb-16 text-center">
              <h2 className="text-4xl font-black text-slate-950 uppercase tracking-tighter italic">{currentCategory.label}</h2>
              <p className="mt-4 text-slate-500 font-bold uppercase tracking-widest opacity-60 text-sm">
                "{currentCategory.description}"
              </p>
          </div>

          <div className="relative">
              {/* NAVIGATION BUTTONS XXL */}
              <div className="absolute top-1/2 -left-12 -right-12 -translate-y-1/2 flex justify-between pointer-events-none z-30 invisible md:visible">
                  <button 
                    onClick={handlePrev}
                    className="pointer-events-auto h-20 w-20 rounded-full bg-white border-2 border-slate-200 shadow-2xl flex items-center justify-center text-slate-400 hover:text-orange-600 hover:border-orange-500 transition-all active:scale-90"
                  >
                    <ArrowLeft className="h-10 w-10" />
                  </button>
                  <button 
                    onClick={handleNext}
                    className="pointer-events-auto h-20 w-20 rounded-full bg-white border-2 border-slate-200 shadow-2xl flex items-center justify-center text-slate-400 hover:text-orange-600 hover:border-orange-500 transition-all active:scale-90"
                  >
                    <ArrowRight className="h-10 w-10" />
                  </button>
              </div>

              {/* SLIDE CONTENT */}
              <div className="bg-white rounded-[60px] shadow-[0_80px_150px_-40px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
                  {/* Header Dynamique du Compteur */}
                  <div className={`p-12 md:p-20 bg-gradient-to-br ${
                      currentCounter.color === 'orange' ? 'from-orange-500 to-orange-700' :
                      currentCounter.color === 'emerald' ? 'from-emerald-600 to-emerald-800' :
                      currentCounter.color === 'blue' ? 'from-blue-600 to-blue-800' :
                      currentCounter.color === 'purple' ? 'from-purple-600 to-purple-800' :
                      currentCounter.color === 'red' ? 'from-red-600 to-red-800' :
                      currentCounter.color === 'indigo' ? 'from-indigo-600 to-indigo-800' :
                      'from-slate-700 to-slate-900'
                  } text-white relative overflow-hidden flex items-center justify-between`}>
                      <div className="relative z-10 space-y-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/60">Analyse de Compteur : {currentIndex + 1} / {currentCategory.counters.length}</p>
                          <h3 className="text-4xl md:text-7xl font-black italic tracking-tighter uppercase leading-none drop-shadow-2xl">
                             {currentCounter.title}
                          </h3>
                      </div>
                      <div className="relative z-10 shrink-0 opacity-20">
                          <currentCounter.icon className="h-32 w-32 md:h-56 md:w-56 text-white" />
                      </div>
                  </div>

                  {/* Quatre Sections de l'Expert */}
                  <div className="p-8 md:p-16 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 flex-1 bg-white">
                      {/* Section 1 : Ce que c'est */}
                      <div className="space-y-6">
                          <div className="flex items-center gap-4 text-orange-600 font-black uppercase text-xs tracking-widest">
                            <span className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">1</span>
                            Ce que c'est :
                          </div>
                          <p className="text-xl md:text-2xl text-slate-800 font-bold leading-tight italic pl-10 border-l-[6px] border-orange-500/30">
                            {currentCounter.what}
                          </p>
                      </div>

                      {/* Section 2 : Comment on l'obtient */}
                      <div className="space-y-6">
                          <div className="flex items-center gap-4 text-blue-600 font-black uppercase text-xs tracking-widest">
                            <span className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">2</span>
                            Comment on l'obtient :
                          </div>
                          <div className="p-8 rounded-3xl bg-slate-950 text-slate-100 font-mono text-lg shadow-inner border border-white/5 relative overflow-hidden">
                              <Calculator className="absolute right-4 bottom-4 h-12 w-12 text-blue-500/20" />
                              <p className="relative z-10 italic leading-snug">
                                {currentCounter.how}
                              </p>
                          </div>
                      </div>

                      {/* Section 3 : Exemples concrets */}
                      <div className="space-y-6">
                          <div className="flex items-center gap-4 text-emerald-600 font-black uppercase text-xs tracking-widest">
                            <span className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">3</span>
                            Des exemples concrets :
                          </div>
                          <div className="p-8 rounded-3xl bg-emerald-50 text-emerald-950 border border-emerald-100 italic font-bold text-lg leading-relaxed">
                             "{currentCounter.example}"
                          </div>
                      </div>

                      {/* Section 4 : Analyse Financière */}
                      <div className="space-y-6">
                          <div className="flex items-center gap-4 text-rose-600 font-black uppercase text-xs tracking-widest">
                            <span className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center">4</span>
                            Analyse Financière du compteur :
                          </div>
                          <div className="flex gap-4">
                              <div className="shrink-0 h-14 w-14 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg transform rotate-6">
                                  <TrendingUp className="h-6 w-6" />
                              </div>
                              <p className="text-lg text-slate-600 font-bold leading-tight italic">
                                {currentCounter.analysis}
                              </p>
                          </div>
                      </div>
                  </div>

                  {/* Barre de Navigation Mobile / Pagination Bas */}
                  <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex gap-2">
                        {currentCategory.counters.map((_, i) => (
                           <button 
                             key={i} 
                             onClick={() => setCurrentIndex(i)}
                             className={`h-2 transition-all duration-300 rounded-full ${currentIndex === i ? 'w-12 bg-orange-600' : 'w-2 bg-slate-300 hover:bg-slate-400'}`} 
                           />
                        ))}
                      </div>
                      <div className="flex gap-4 md:hidden">
                        <button onClick={handlePrev} className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-md active:scale-90"><ChevronLeft className="h-6 w-6 text-slate-600" /></button>
                        <button onClick={handleNext} className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-md active:scale-90"><ChevronRight className="h-6 w-6 text-slate-600" /></button>
                      </div>
                      <p className="hidden md:block text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Maîtrise Professionnelle GestiCom Pro v24</p>
                  </div>
              </div>
          </div>
      </div>

      {/* FOOTER ACTION */}
      <div className="max-w-7xl mx-auto px-6 mt-40">
          <div className="bg-slate-950 rounded-[80px] p-16 md:p-24 text-white relative overflow-hidden flex flex-col items-center text-center gap-10 group shadow-[0_60px_100px_-30px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-25" />
              <div className="absolute -top-60 -right-60 w-[600px] h-[600px] bg-orange-600 blur-[250px] opacity-10" />
              
              <div className="relative z-10 max-w-3xl">
                  <h2 className="text-5xl md:text-8xl font-black italic tracking-tighter uppercase mb-8 leading-[0.8] transition-transform duration-1000 group-hover:scale-105">
                     Le Succès <span className="text-orange-500">S'Analyse.</span>
                  </h2>
                  <p className="text-slate-400 font-bold text-xl mb-12 uppercase tracking-tighter opacity-80 leading-none">
                    "Ne soyez pas un spectateur de vos tableaux de bord. Soyez le pilote qui comprend sa machine."
                  </p>
                  <button 
                    onClick={() => window.location.href = '/dashboard'}
                    className="inline-flex items-center gap-6 bg-white text-slate-950 px-12 py-6 rounded-[35px] font-black uppercase text-sm tracking-[0.3em] hover:bg-orange-600 hover:text-white transition-all shadow-2xl hover:scale-110 active:scale-95 group/btn"
                  >
                      Retourner au Cockpit
                      <ArrowRight className="h-6 w-6 group-hover/btn:translate-x-2 transition-transform" />
                  </button>
              </div>
          </div>
      </div>
    </div>
  )
}



import { TemplateData } from '@/lib/print-templates'

export type Magasin = { id: number; code: string; nom: string }
export type Client = { id: number; nom: string; type: string; code?: string }
export type Produit = { 
  id: number; 
  code: string; 
  designation: string; 
  categorie?: string; 
  prixVente: number | null;
  prixAchat?: number | null;
  prixMinimum?: number | null;
  stocks: Array<{ magasinId: number; quantite: number }>;
}
export type Ligne = { 
  produitId: number; 
  designation: string; 
  code?: string; 
  quantite: number; 
  prixUnitaire: number; 
  tvaPerc?: number; 
  remise?: number 
}

export type Vente = {
  id: number
  numero: string
  date: string
  montantTotal: number
  montantPaye?: number
  statutPaiement?: string
  modePaiement: string
  statut: string
  magasin: { id: number; code: string; nom: string }
  client?: { id: number; code?: string; nom: string }
  clientLibre?: string
  lignes: Array<{ quantite: number; prixUnitaire: number; designation: string; tvaPerc?: number }>
}

export type VenteDetail = Vente & {
  remiseGlobale: number
  observation: string | null
  numeroBon: string | null
  magasinId: number
  clientId: number | null
  client: { id: number; code?: string; nom: string; telephone?: string | null; adresse?: string | null; ncc?: string | null } | null
  lignes: Array<{ 
    produitId: number; 
    designation: string; 
    quantite: number; 
    prixUnitaire: number; 
    tvaPerc?: number; 
    remise?: number | string; 
    montant: number 
  }>
  reglements: Array<{ mode: string; montant: number; date?: string; reference?: string | null }>
}

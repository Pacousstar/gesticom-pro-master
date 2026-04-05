/**
 * Système d'import/export de données pour GestiCom
 * Permet d'importer et exporter des données depuis/vers Excel/CSV
 */

export type ImportEntity = 'PRODUITS' | 'CLIENTS' | 'FOURNISSEURS' | 'STOCK' | 'VENTES' | 'ACHATS'

export interface ImportResult {
  success: number
  failed: number
  errors: Array<{ row: number; error: string }>
  warnings: Array<{ row: number; warning: string }>
}

export interface ExportOptions {
  entity: ImportEntity
  filters?: Record<string, any>
  format: 'EXCEL' | 'CSV' | 'JSON'
}

/**
 * Valider les données d'import
 */
export function validateImportData(entity: ImportEntity, data: any[]): { valid: any[]; errors: Array<{ row: number; error: string }> } {
  const valid: any[] = []
  const errors: Array<{ row: number; error: string }> = []

  data.forEach((row, index) => {
    try {
      switch (entity) {
        case 'PRODUITS':
          if (!row.code || !row.designation) {
            errors.push({ row: index + 1, error: 'Code et désignation requis' })
            return
          }
          valid.push({
            code: String(row.code).trim().toUpperCase(),
            designation: String(row.designation).trim(),
            categorie: String(row.categorie || 'DIVERS').trim(),
            prixAchat: row.prixAchat ? Number(row.prixAchat) : null,
            prixVente: row.prixVente ? Number(row.prixVente) : null,
            seuilMin: row.seuilMin ? Number(row.seuilMin) : 5,
          })
          break

        case 'CLIENTS':
          if (!row.nom) {
            errors.push({ row: index + 1, error: 'Nom requis' })
            return
          }
          valid.push({
            nom: String(row.nom).trim(),
            telephone: row.telephone ? String(row.telephone).trim() : null,
            type: row.type === 'CREDIT' ? 'CREDIT' : 'CASH',
            plafondCredit: row.plafondCredit ? Number(row.plafondCredit) : null,
            ncc: row.ncc ? String(row.ncc).trim() : null,
          })
          break

        case 'FOURNISSEURS':
          if (!row.nom) {
            errors.push({ row: index + 1, error: 'Nom requis' })
            return
          }
          valid.push({
            nom: String(row.nom).trim(),
            telephone: row.telephone ? String(row.telephone).trim() : null,
            email: row.email ? String(row.email).trim() : null,
            ncc: row.ncc ? String(row.ncc).trim() : null,
          })
          break

        default:
          errors.push({ row: index + 1, error: `Type d'entité non supporté : ${entity}` })
      }
    } catch (error) {
      errors.push({ row: index + 1, error: error instanceof Error ? error.message : 'Erreur de validation' })
    }
  })

  return { valid, errors }
}

/**
 * Mapper les colonnes Excel vers les champs de l'entité
 */
export function mapColumns(entity: ImportEntity, headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  
  // Mapping par défaut (peut être personnalisé)
  const defaultMappings: Record<ImportEntity, Record<string, string[]>> = {
    PRODUITS: {
      code: ['code', 'référence', 'ref'],
      designation: ['désignation', 'designation', 'libellé', 'libelle', 'nom'],
      categorie: ['catégorie', 'categorie', 'category'],
      prixAchat: ['prix achat', 'prix_achat', 'prixachat', 'coût', 'cout'],
      prixVente: ['prix vente', 'prix_vente', 'prixvente'],
      seuilMin: ['seuil min', 'seuil_min', 'seuilmin', 'stock min', 'stock_min'],
    },
    CLIENTS: {
      nom: ['nom', 'name', 'client'],
      telephone: ['téléphone', 'telephone', 'tel', 'phone'],
      type: ['type', 'catégorie', 'categorie'],
      plafondCredit: ['plafond crédit', 'plafond_credit', 'plafondcredit', 'plafond'],
      ncc: ['ncc', 'numéro compte', 'numero compte'],
    },
    FOURNISSEURS: {
      nom: ['nom', 'name', 'fournisseur'],
      telephone: ['téléphone', 'telephone', 'tel', 'phone'],
      email: ['email', 'e-mail', 'mail'],
      ncc: ['ncc', 'numéro compte', 'numero compte'],
    },
    STOCK: {},
    VENTES: {},
    ACHATS: {},
  }

  const entityMapping = defaultMappings[entity]
  
  headers.forEach((header, index) => {
    const headerLower = header.toLowerCase().trim()
    for (const [field, aliases] of Object.entries(entityMapping)) {
      if (aliases.includes(headerLower)) {
        mapping[field] = header
        break
      }
    }
  })

  return mapping
}

/**
 * Préparer les données pour l'export
 */
export function prepareExportData(entity: ImportEntity, data: any[]): any[] {
  switch (entity) {
    case 'PRODUITS':
      return data.map((p) => ({
        Code: p.code,
        Désignation: p.designation,
        Catégorie: p.categorie,
        'Prix achat': p.prixAchat,
        'Prix vente': p.prixVente,
        'Seuil min': p.seuilMin,
      }))

    case 'CLIENTS':
      return data.map((c) => ({
        Nom: c.nom,
        Téléphone: c.telephone,
        Type: c.type,
        'Plafond crédit': c.plafondCredit,
        NCC: c.ncc,
      }))

    case 'FOURNISSEURS':
      return data.map((f) => ({
        Nom: f.nom,
        Téléphone: f.telephone,
        Email: f.email,
        NCC: f.ncc,
      }))

    default:
      return data
  }
}

/**
 * Système de templates d'impression personnalisables pour GestiCom
 * Permet de personnaliser les modèles d'impression (tickets, bons, etc.)
 */

export type TemplateData = {
  // Données entreprise
  ENTREPRISE_NOM?: string
  ENTREPRISE_CONTACT?: string
  ENTREPRISE_LOCALISATION?: string
  ENTREPRISE_LOGO?: string
  ENTREPRISE_NCC?: string
  ENTREPRISE_RC?: string
  ENTREPRISE_PIED_DE_PAGE?: string
  ENTREPRISE_MENTION_SPECIALE?: string

  // Données document
  NUMERO?: string
  DATE?: string
  HEURE?: string
  MAGASIN_CODE?: string
  MAGASIN_NOM?: string

  // Données client/fournisseur
  CLIENT_NOM?: string
  CLIENT_CONTACT?: string
  CLIENT_LOCALISATION?: string
  CLIENT_CODE?: string
  CLIENT_NCC?: string
  FOURNISSEUR_NOM?: string
  FOURNISSEUR_TELEPHONE?: string
  NUMERO_CAMION?: string

  // Données lignes
  LIGNES?: string // HTML des lignes de produits
  TOTAL_HT?: string
  TOTAL_TVA?: string
  TOTAL_REMISE?: string
  TOTAL_HT_NET?: string
  REMISE_GLOBALE?: string
  TOTAL?: string
  MONTANT_PAYE?: string
  RESTE?: string
  MODE_PAIEMENT?: string
  NUMERO_BON?: string
  OBSERVATION?: string
}

/**
 * Remplacer les variables dans un template
 * Ordre : d'abord les conditionnels {VAR ? 'a' : 'b'}, puis les variables {VAR}
 */
export function replaceTemplateVariables(template: string, data: TemplateData): string {
  let result = template

  // 1. Remplacer les conditions {VAR ? 'oui' : 'non'} AVANT les variables
  try {
    // Regex améliorée pour capturer les contenus même s'ils contiennent des quotes
    // On cherche {VAR ? '...' : '...'} où le contenu entre quotes peut être n'importe quoi tant que la quote n'est pas suivie de ' : ' ou '}'
    result = result.replace(/\{(\w+)\s*\?\s*'((?:[^']|'(?!\s*[:}] ))*)'\s*:\s*'((?:[^']|'(?!\s*\}))*)'\}/g, (_match, varName, ifTrue, ifFalse) => {
      const key = varName.trim() as keyof TemplateData
      const value = data[key]
      const hasValue = value != null && String(value).trim() !== '' && String(value).trim() !== 'undefined'
      return hasValue ? ifTrue : ifFalse
    })
  } catch (e) {
    console.error("Erreur replacement conditions:", e)
  }

  // 2. Remplacer toutes les variables simples transmises dans data
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    result = result.replace(regex, value != null && value !== 'undefined' ? String(value) : '')
  })

  // 3. Nettoyage final : supprimer toutes les variables {NOM_VAR} restantes non remplies
  result = result.replace(/\{[A-Z0-9_]+\}/g, '')

  return result
}

/**
 * Génère le HTML du tableau de toutes les lignes (articles) pour une facture/ticket.
 * Tous les articles achetés par le client sont affichés sur une même facture.
 */
export function generateLignesHTML(lignes: Array<{
  designation: string
  quantite: number
  prixUnitaire: number
  montant: number
}>): string {
  if (!lignes?.length) {
    return '<p style="margin: 12px 0; font-size: 12px; color: #6b7280;">Aucune ligne.</p>'
  }
  return `
    <table class="print-lignes" style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <thead>
        <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
          <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: bold;">Produit</th>
          <th style="padding: 8px; text-align: center; font-size: 12px; font-weight: bold;">Qté</th>
          <th style="padding: 8px; text-align: right; font-size: 12px; font-weight: bold;">Prix U.</th>
          <th style="padding: 8px; text-align: right; font-size: 12px; font-weight: bold; color: #ef4444;">Remise</th>
          <th style="padding: 8px; text-align: right; font-size: 12px; font-weight: bold;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lignes.map((l) => `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px; font-size: 12px;">${escapeHtml(l.designation)}</td>
            <td style="padding: 8px; text-align: center; font-size: 12px;">${l.quantite}</td>
            <td style="padding: 8px; text-align: right; font-size: 12px;">${l.prixUnitaire.toLocaleString('fr-FR')} F</td>
            <td style="padding: 8px; text-align: right; font-size: 12px; color: #ef4444;">${(l as any).remise ? `-${(l as any).remise}` : '-'}</td>
            <td style="padding: 8px; text-align: right; font-size: 12px; font-weight: bold;">${l.montant.toLocaleString('fr-FR')} F</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

function escapeHtml(s: string): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Feuille de styles complète pour l'impression (aperçu écran + impression).
 * @param format 'TICKET' | 'A4'
 */
export function getPrintStyles(format: 'TICKET' | 'A4' = 'TICKET'): string {
    const isA4 = format === 'A4'
    return `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page {
      size: ${isA4 ? 'A4 portrait' : '80mm auto'};
      margin: ${isA4 ? '10mm' : '2mm'};
    }
    body {
      margin: 0;
      padding: ${isA4 ? '0' : '5px'};
      font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: ${isA4 ? '12px' : '11px'};
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    .print-document {
      width: 100%;
      margin: 0 auto;
      padding: ${isA4 ? '15mm' : '5mm'};
      display: flex;
      flex-direction: column;
      min-height: ${isA4 ? '277mm' : 'auto'};
    }
    .print-content {
      flex: 1;
    }
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #000;
    }
    .print-header-logo img {
      max-width: 180px;
      max-height: 80px;
      object-fit: contain;
    }
    .print-header-text h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .print-header-text p {
      margin: 2px 0;
      font-size: 10px;
      font-weight: 600;
      color: #4b5563;
    }
    .print-title-box {
      text-align: right;
    }
    .print-title-box h2 {
      margin: 0;
      font-size: 28px;
      font-weight: 900;
      color: #111827;
      font-style: italic;
      text-transform: uppercase;
    }
    .print-title-box .doc-number {
      font-size: 14px;
      font-weight: 800;
      color: #dc2626;
      margin-top: 5px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    .info-block {
      padding: 15px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
    }
    .info-block h3 {
      margin: 0 0 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #6b7280;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 4px;
    }
    .info-block p {
      margin: 3px 0;
      font-weight: 700;
    }
    table.print-lignes {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    table.print-lignes thead th {
      background: #000 !important;
      color: #fff !important;
      padding: 10px 8px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 900;
    }
    table.print-lignes tbody td {
      padding: 8px;
      border-bottom: 1px solid #ccc;
      font-size: 11px;
    }
    table.print-lignes tbody tr:nth-child(even) { background: #f9fafb; }
    .print-totals-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
    .print-totals {
      width: 250px;
      background: #f3f4f6;
      padding: 15px;
      border-radius: 8px;
    }
    .print-totals p {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-size: 12px;
    }
    .print-totals .grand-total {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 2px solid #000;
      font-size: 16px;
      font-weight: 900;
      color: #000;
    }
    .print-visas {
      margin-top: 50px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .visa-box {
      border: 1px solid #000;
      height: 120px;
      padding: 10px;
      text-align: center;
      border-radius: 4px;
    }
    .visa-box h4 {
      margin: 0;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 900;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    .print-footer {
      margin-top: auto;
      padding-top: 30px;
      text-align: center;
      font-size: 9px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    @media print {
      .no-print { display: none !important; }
    }
  `
}

/**
 * Imprimer un document avec un template
 */
export async function printDocument(templateId: number | null, type: 'VENTE' | 'ACHAT' | 'BON_COMMANDE', data: TemplateData, format: 'TICKET' | 'A4' = 'TICKET'): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    // Récupérer les paramètres de l'entreprise
    const paramsRes = await fetch('/api/parametres')
    let entrepriseData: any = {}
    if (paramsRes.ok) {
      entrepriseData = await paramsRes.json()
    }

    // Récupérer le template
    let templateContent = ''
    let logo = ''

    if (templateId) {
      const res = await fetch(`/api/print-templates/${templateId}`)
      if (res.ok) {
        const template = await res.json()
        templateContent = template.enTete || ''
        logo = template.logo || ''
      }
    }

    // Si pas de template, utiliser le template par défaut approprié
    if (!templateContent) {
      templateContent = format === 'A4' ? getDefaultA4Template(type) : getDefaultTemplate(type)
    }

    // Ajouter les données de l'entreprise aux données du template
    data.ENTREPRISE_NOM = entrepriseData.nomEntreprise || data.ENTREPRISE_NOM || 'GESTICOM PRO'
    data.ENTREPRISE_CONTACT = entrepriseData.contact || data.ENTREPRISE_CONTACT || ''
    data.ENTREPRISE_LOCALISATION = entrepriseData.localisation || data.ENTREPRISE_LOCALISATION || ''
    data.ENTREPRISE_NCC = entrepriseData.numNCC || ''
    data.ENTREPRISE_RC = entrepriseData.registreCommerce || ''
    data.ENTREPRISE_PIED_DE_PAGE = entrepriseData.piedDePage || data.ENTREPRISE_PIED_DE_PAGE || ''
    data.ENTREPRISE_MENTION_SPECIALE = entrepriseData.mentionSpeciale || 'Les produits sortis ne sont plus repris. Veuillez exiger votre facture.'

    // Traitement du Logo (Respect de la règle : logo uniquement si présent ou paramètres)
    let logoUrl = logo || entrepriseData.logoLocal || entrepriseData.logo
    if (logoUrl) {
       data.ENTREPRISE_LOGO = `<img src="${logoUrl}" alt="Logo" />`
    } else {
       data.ENTREPRISE_LOGO = ''
    }

    // Remplacer les variables
    const html = replaceTemplateVariables(templateContent, data)
    
    // Fenêtre d'impression
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popups bloqués.')
      return
    }

    const printStyles = getPrintStyles(format)
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${data.NUMERO || 'Document'}</title>
          <style>${printStyles}</style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 500)
    }
  } catch (error) {
    console.error('Erreur:', error)
  }
}

/**
 * Template par défaut (HTML structuré pour le style d'impression)
 */
export function getDefaultTemplate(type: 'VENTE' | 'ACHAT' | 'BON_COMMANDE'): string {
  const isVente = type === 'VENTE'
  const title = isVente ? 'TICKET DE VENTE' : 'BON D\'ACHAT'
  return `
<div class="print-document">
  <div class="print-header">
    <div class="print-header-logo">{ENTREPRISE_LOGO}</div>
    <div class="print-header-text">
      <h1>{ENTREPRISE_NOM}</h1>
      <p>{ENTREPRISE_LOCALISATION}</p>
      <p>{ENTREPRISE_CONTACT}</p>
    </div>
  </div>
  
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-decoration: underline;">${title}</h2>
    <p class="doc-number" style="font-weight: 1000; color: #f97316;">N° {NUMERO}</p>
    {NUMERO_BON ? '<p style="font-size: 11px; font-weight: 900; color: #f97316; margin: 0;">BON N° {NUMERO_BON}</p>' : ''}
    <p style="font-size: 10px;">Le {DATE} à {HEURE}</p>
  </div>

  <div class="info-block" style="margin-bottom: 10px;">
    <h3>${isVente ? 'Client' : 'Fournisseur'}</h3>
    <p>${isVente ? '{CLIENT_NOM}' : '{FOURNISSEUR_NOM}'}</p>
  </div>

  <div class="print-content">
    {LIGNES}
    
    <div class="print-totals-wrapper">
      <div class="print-totals">
        {TOTAL_HT ? '<p><span>TOTAL HT BRUT :</span> {TOTAL_HT}</p>' : ''}
        {TOTAL_REMISE ? '<p style="color: red;"><span>REMISE :</span> -{TOTAL_REMISE}</p>' : ''}
        {REMISE_GLOBALE ? '<p style="color: red;"><span>REMISE FINALE :</span> -{REMISE_GLOBALE}</p>' : ''}
        {TOTAL_HT_NET ? '<p><span>TOTAL HT NET :</span> {TOTAL_HT_NET}</p>' : ''}
        {TOTAL_TVA ? '<p><span>TVA :</span> {TOTAL_TVA}</p>' : ''}
        <p class="grand-total"><span>A PAYER :</span> {TOTAL}</p>
        <p style="font-size: 10px; margin-top: 10px;">Mode : {MODE_PAIEMENT}</p>
      </div>
    </div>
  </div>

  <div class="print-footer">
    <p style="font-weight: 900; margin-bottom: 5px;">{ENTREPRISE_MENTION_SPECIALE}</p>
    <p>MERCI DE VOTRE CONFIANCE !</p>
    {ENTREPRISE_PIED_DE_PAGE ? '<p style="margin-top: 10px;">{ENTREPRISE_PIED_DE_PAGE}</p>' : ''}
  </div>
</div>
`
}

/**
 * Template Facture A4 Premium
 */
export function getDefaultA4Template(type: 'VENTE' | 'ACHAT' | 'BON_COMMANDE'): string {
    const isVente = type === 'VENTE'
    const docType = isVente ? 'FACTURE' : (type === 'BON_COMMANDE' ? 'BON DE COMMANDE' : 'BON D\'ACHAT')
    
    return `
<div class="print-document">
  <div class="print-header">
    <div class="print-header-logo">{ENTREPRISE_LOGO}</div>
    <div class="print-header-text">
       <h1>{ENTREPRISE_NOM}</h1>
       <p>📍 {ENTREPRISE_LOCALISATION}</p>
       <p>📞 {ENTREPRISE_CONTACT}</p>
       <p>📄 {ENTREPRISE_NCC ? 'NCC: {ENTREPRISE_NCC}' : ''} {ENTREPRISE_RC ? ' | RC: {ENTREPRISE_RC}' : ''}</p>
    </div>
    <div class="print-title-box">
       <h2>${docType}</h2>
       <p class="doc-number">N° {NUMERO}</p>
       {NUMERO_BON ? '<p style="font-size: 12px; font-weight: 900; color: #f97316; margin-top: 2px;">BON COMMANDE N° {NUMERO_BON}</p>' : ''}
       <p style="font-weight: bold; margin-top: 5px;">Date: {DATE}</p>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-block">
       <h3>Émetteur</h3>
       <p>{ENTREPRISE_NOM}</p>
       <p style="font-size: 10px; font-weight: normal; color: #666;">Magasin: {MAGASIN_NOM} ({MAGASIN_CODE})</p>
    </div>
    <div class="info-block">
       <h3>${isVente ? 'Destinataire' : 'Fournisseur'}</h3>
       <p style="font-size: 16px; color: #000;">${isVente ? '{CLIENT_NOM}' : '{FOURNISSEUR_NOM}'}</p>
       ${isVente ? `
       <p style="font-size: 11px; font-weight: normal;">📞 {CLIENT_CONTACT}</p>
       <p style="font-size: 11px; font-weight: normal;">📍 {CLIENT_LOCALISATION}</p>
       ` : `
       <p style="font-size: 11px; font-weight: normal;">📞 {FOURNISSEUR_TELEPHONE}</p>
       {NUMERO_CAMION ? '<p style="font-size: 11px; font-weight: bold;">🚚 Camion N°: {NUMERO_CAMION}</p>' : ''}
       `}
    </div>
  </div>

  <div class="print-content">
    {LIGNES}
    
    <div class="print-totals-wrapper">
       <div class="print-totals">
          {TOTAL_HT ? '<p><span>Total HT Brut :</span> <span>{TOTAL_HT}</span></p>' : ''}
          {TOTAL_REMISE ? '<p style="color: #dc2626;"><span>Remises :</span> <span>-{TOTAL_REMISE}</span></p>' : ''}
          {REMISE_GLOBALE ? '<p style="color: #dc2626;"><span>Remise Finale :</span> <span>-{REMISE_GLOBALE}</span></p>' : ''}
          {TOTAL_HT_NET ? '<p><span>Total HT Net :</span> <span>{TOTAL_HT_NET}</span></p>' : ''}
          {TOTAL_TVA ? '<p><span>TVA :</span> <span>{TOTAL_TVA}</span></p>' : ''}
          <p class="grand-total"><span>TOTAL TTC :</span> <span>{TOTAL}</span></p>
          <div style="margin-top: 15px; font-size: 10px; color: #4b5563; border-top: 1px solid #d1d5db; padding-top: 5px; text-align: center;">
            Mode de Règlement : <strong>{MODE_PAIEMENT}</strong>
          </div>
       </div>
    </div>

    {OBSERVATION ? '<div style="margin-top: 20px; padding: 10px; border-left: 4px solid #f59e0b; background: #fffbeb; font-size: 11px;"><strong>Note:</strong> {OBSERVATION}</div>' : ''}

    <div class="print-visas">
       <div class="visa-box">
          <h4>Visa Client</h4>
          <p style="font-size: 8px; color: #999; margin-top: 70px;">(Signature précédée de la mention "Reçu conforme")</p>
       </div>
       <div class="visa-box">
          <h4>La Direction</h4>
          <p style="font-size: 8px; color: #999; margin-top: 70px;">(Cachet et Signature)</p>
       </div>
    </div>
  </div>

  <div class="print-footer">
    <p style="font-weight: 800; font-size: 10px; color: #000; margin-bottom: 5px;">{ENTREPRISE_MENTION_SPECIALE}</p>
    <p>© Gesticom Pro - {ENTREPRISE_NOM} - Tous droits réservés.</p>
    {ENTREPRISE_PIED_DE_PAGE ? '<p style="margin-top: 5px;">{ENTREPRISE_PIED_DE_PAGE}</p>' : ''}
  </div>
</div>
`
}

export type PrintTemplateType = 'VENTE' | 'ACHAT' | 'BON_LIVRAISON' | 'FACTURE' | 'BON_COMMANDE'

export interface PrintTemplate {
  id: number
  type: PrintTemplateType
  nom: string
  logo?: string // URL ou base64
  enTete?: string // HTML ou texte
  piedDePage?: string // HTML ou texte
  variables: Record<string, string> // Variables personnalisées
  actif: boolean
  createdAt: string
  updatedAt: string
}

export interface PrintData {
  numero: string
  date: string
  entreprise?: {
    nom: string
    contact: string
    localisation: string
    logo?: string
  }
  client?: {
    nom: string
    telephone?: string
    adresse?: string
  }
  fournisseur?: {
    nom: string
    telephone?: string
    adresse?: string
  }
  magasin?: {
    code: string
    nom: string
    localisation?: string
  }
  lignes: Array<{
    designation: string
    quantite: number
    prixUnitaire: number
    montant: number
  }>
  total: number
  montantPaye?: number
  reste?: number
  modePaiement?: string
  observation?: string
}

/**
 * Variables disponibles pour les templates
 */
export const PRINT_VARIABLES = {
  // Entreprise
  '{ENTREPRISE_NOM}': 'Nom de l\'entreprise',
  '{ENTREPRISE_CONTACT}': 'Contact de l\'entreprise',
  '{ENTREPRISE_LOCALISATION}': 'Localisation de l\'entreprise',
  '{ENTREPRISE_LOGO}': 'Logo de l\'entreprise',
  '{ENTREPRISE_PIED_DE_PAGE}': 'Pied de page de l\'entreprise',
  '{ENTREPRISE_MENTION_SPECIALE}': 'Mention spéciale légale',

  // Document
  '{NUMERO}': 'Numéro du document',
  '{DATE}': 'Date du document',
  '{HEURE}': 'Heure du document',

  // Client/Fournisseur
  '{CLIENT_NOM}': 'Nom du client',
  '{CLIENT_CONTACT}': 'Contact du client',
  '{CLIENT_LOCALISATION}': 'Localisation du client',
  '{CLIENT_NCC}': 'NCC du client',
  '{FOURNISSEUR_NOM}': 'Nom du fournisseur',
  '{NUMERO_CAMION}': 'Numéro du camion (Fournisseur)',

  // Magasin
  '{MAGASIN_CODE}': 'Code du magasin',
  '{MAGASIN_NOM}': 'Nom du magasin',

  // Totaux
  '{TOTAL}': 'Montant total',
  '{MONTANT_PAYE}': 'Montant payé',
  '{RESTE}': 'Reste à payer',
  '{MODE_PAIEMENT}': 'Mode de paiement',

  // Divers
  '{NUMERO_BON}': 'Numéro de bon de commande',
  '{OBSERVATION}': 'Observation',
  '{LIGNES}': 'Liste des lignes (tableau)',
} as const

/**
 * Template par défaut pour une vente (logo à droite dans la section infos)
 */
export const DEFAULT_VENTE_TEMPLATE = `
<div class="print-header">
  <div class="print-header-logo">{ENTREPRISE_LOGO}</div>
  <div class="print-header-text">
    <h1 class="print-entreprise-nom">{ENTREPRISE_NOM}</h1>
    <p class="print-contact">{ENTREPRISE_CONTACT}</p>
    <p class="print-localisation">{ENTREPRISE_LOCALISATION}</p>
    {ENTREPRISE_NCC ? '<p class="print-contact" style="font-size: 10px;">NCC: {ENTREPRISE_NCC}</p>' : ''}
    {ENTREPRISE_RC ? '<p class="print-contact" style="font-size: 10px;">RC: {ENTREPRISE_RC}</p>' : ''}
  </div>
</div>
<hr>
<div class="print-meta">
  <p><strong>Ticket N°:</strong> {NUMERO}</p>
  <p><strong>Date:</strong> {DATE} {HEURE}</p>
  <p><strong>Magasin:</strong> {MAGASIN_CODE} – {MAGASIN_NOM}</p>
  {CLIENT_NOM ? '<p><strong>Client:</strong> {CLIENT_NOM}</p>' : ''}
  {CLIENT_CONTACT ? '<p><strong>Contact:</strong> {CLIENT_CONTACT}</p>' : ''}
  {CLIENT_LOCALISATION ? '<p><strong>Localisation:</strong> {CLIENT_LOCALISATION}</p>' : ''}
  {CLIENT_NCC ? '<p><strong>NCC:</strong> {CLIENT_NCC}</p>' : ''}
</div>
<hr>
{LIGNES}
<hr>
<div class="print-totals">
  <p class="print-total"><strong>Total:</strong> {TOTAL}</p>
  {MONTANT_PAYE ? '<p><strong>Payé:</strong> {MONTANT_PAYE}</p>' : ''}
  {RESTE ? '<p><strong>Reste:</strong> {RESTE}</p>' : ''}
  <p><strong>Mode:</strong> {MODE_PAIEMENT}</p>
</div>
{OBSERVATION ? '<p class="print-obs">{OBSERVATION}</p>' : ''}
<hr>
<div class="print-footer">
  <p style="font-size: 10px; font-weight: bold; margin-top: 5px;">{ENTREPRISE_MENTION_SPECIALE}</p>
  <p>Merci de votre visite !</p>
  <p><strong>{ENTREPRISE_NOM}</strong></p>
  {ENTREPRISE_PIED_DE_PAGE ? '<p style="margin-top: 8px; font-size: 10px;">{ENTREPRISE_PIED_DE_PAGE}</p>' : ''}
</div>
`

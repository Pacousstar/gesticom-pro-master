/**
 * Formate une date au format Sage (JJMMYY)
 */
function formatDateSage(date: Date): string {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  return `${day}${month}${year}`
}

/**
 * Génère un fichier texte au format Sage standard (Séparateur point-virgule)
 * Structure : Date;CodeJournal;CompteGeneral;CompteTiers;LibelleEcriture;Debit;Credit
 */
export function genererExportSage(ecritures: any[]): string {
  let content = "Date;Journal;CompteGeneral;CompteTiers;Libelle;Debit;Credit\n"

  ecritures.forEach((e) => {
    const date = formatDateSage(e.date)
    const journal = e.journalCode || 'GEN'
    const compte = e.compteGeneral || ''
    const tiers = e.compteTiers || ''
    const libelle = (e.libelle || '').replace(/;/g, ' ') // Éviter de casser le CSV
    const debit = e.debit > 0 ? e.debit.toFixed(2).replace('.', ',') : ''
    const credit = e.credit > 0 ? e.credit.toFixed(2).replace('.', ',') : ''

    content += `${date};${journal};${compte};${tiers};${libelle};${debit};${credit}\n`
  })

  return content
}

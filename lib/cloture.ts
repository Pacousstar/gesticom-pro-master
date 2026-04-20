import { prisma } from './db'

/**
 * Vérifie si une opération à une date donnée est autorisée par rapport à la date de clôture.
 * @param dateOperation Date de l'opération (Vente, Achat, etc.)
 * @param session Session de l'utilisateur (pour vérifier le rôle)
 * @param tx (Optionnel) Instance de transaction Prisma pour une performance maximale
 * @throws Error si la période est clôturée et que l'utilisateur n'est pas Super Admin.
 */
export async function verifierCloture(dateOperation: Date, session: any, tx?: any) {
  // RÈGLE : Seul le SUPER_ADMIN peut modifier des données dans une période clôturée.
  if (session?.role === 'SUPER_ADMIN') return 
  
  const client = tx || prisma
  
  const parametres = await client.parametre.findFirst({
    select: { dateCloture: true }
  })
  
  if (parametres?.dateCloture) {
    const dCloture = new Date(parametres.dateCloture)
    
    // Comparaison stricte : si l'opération est antérieure ou égale à la date de clôture (fin de journée)
    const opDate = new Date(dateOperation)
    
    // On normalise la clôture à la fin de la journée indiquée (23:59:59)
    const limitDate = new Date(dCloture)
    limitDate.setHours(23, 59, 59, 999)
    
    if (opDate <= limitDate) {
      const formattedDate = opDate.toLocaleDateString('fr-FR')
      const formattedCloture = limitDate.toLocaleDateString('fr-FR')
      throw new Error(`VERROU DE CLÔTURE : Cette opération date du ${formattedDate}. Le système est clôturé jusqu'au ${formattedCloture}. Toute modification est interdite pour garantir l'intégrité du bilan financier annuel.`)
    }
  }
}

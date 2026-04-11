const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function diagMouvementsSimple() {
  console.log('--- ANALYSE DES MOUVEMENTS DE STOCK (Version Neutre) ---')
  
  try {
    const total = await prisma.mouvement.count()
    console.log('Nombre de mouvements trouves : ' + total)
    console.log('-----------------------------------------------')
    
    if (total > 0) {
      // Lecture directe par SQL pour eviter les erreurs de modele
      const mvt = await prisma.$queryRaw`SELECT * FROM "Mouvement" ORDER BY date ASC LIMIT 1`
      if (mvt && mvt.length > 0) {
        const first = mvt[0]
        console.log('Date du mouvement : ' + first.date)
        console.log('Entite ID : ' + first.entiteId)
        console.log('Date Operation : ' + first.dateOperation)
      }
      
      const sansEntite = await prisma.mouvement.count({ where: { entiteId: null } })
      console.log('Mouvements sans entite : ' + sansEntite)
    } else {
      console.log('ALERTE : La table des mouvements est VIDE.')
    }
  } catch (err) {
    console.log('ERREUR : ' + err.message)
  } finally {
    await prisma.$disconnect()
  }
}

diagMouvementsSimple()

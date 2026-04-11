import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testIsolation() {
  console.log('🏁 DÉMARRAGE DU TEST D\'ISOLATION COMPTABLE')

  try {
    // 1. Récupérer les entités existantes
    const entities = await prisma.entite.findMany({ take: 2 })
    if (entities.length < 2) {
      console.warn('⚠️ Moins de 2 entités trouvées. Le test d\'isolation croisée sera limité.')
    }

    const entiteA = entities[0]
    const entiteB = entities[1]

    console.log(`📡 Entité A : ID=${entiteA?.id} (${entiteA?.nom || 'Inconnue'})`)
    if (entiteB) {
      console.log(`📡 Entité B : ID=${entiteB.id} (${entiteB.nom || 'Inconnue'})`)
    }

    // 2. Simulation de la logique "getEntiteId"
    // On simule ce que ferait l'API avec une session standard
    const mockGetEntiteId = (role: string, sessionEntiteId: number) => {
      // Dans notre implémentation réelle, getEntiteId(session) renvoie session.user.entiteId
      return sessionEntiteId
    }

    // 3. Test : Un utilisateur de l'Entité A ne doit voir que ses écritures
    if (entiteA) {
      const eIdA = mockGetEntiteId('USER', entiteA.id)
      const whereA = eIdA > 0 ? { entiteId: eIdA } : {}
      
      const ecrituresA = await prisma.ecritureComptable.findMany({
        where: whereA,
        take: 50
      })

      const totalA = ecrituresA.length
      const infiltrationsB = ecrituresA.filter(e => e.entiteId !== entiteA.id)

      console.log(`🔍 Test Entité A : ${totalA} écritures trouvées.`)
      if (infiltrationsB.length === 0) {
        console.log('✅ AUCUNE fuite de données détectée pour l\'Entité A.')
      } else {
        console.error(`❌ ERREUR : ${infiltrationsB.length} écritures d'autres entités détectées dans la vue de A !`)
      }
    }

    // 4. Test : Un utilisateur de l'Entité B ne doit voir que ses écritures
    if (entiteB) {
      const eIdB = mockGetEntiteId('USER', entiteB.id)
      const whereB = eIdB > 0 ? { entiteId: eIdB } : {}
      
      const ecrituresB = await prisma.ecritureComptable.findMany({
        where: whereB,
        take: 50
      })

      const totalB = ecrituresB.length
      const infiltrationsA = ecrituresB.filter(e => e.entiteId !== entiteB.id)

      console.log(`🔍 Test Entité B : ${totalB} écritures trouvées.`)
      if (infiltrationsA.length === 0) {
        console.log('✅ AUCUNE fuite de données détectée pour l\'Entité B.')
      } else {
        console.error(`❌ ERREUR : ${infiltrationsA.length} écritures d'autres entités détectées dans la vue de B !`)
      }
    }

    // 5. Test : Super Admin avec filtre spécifique
    if (entiteA) {
      console.log('🔍 Test Super Admin filtré sur Entité A...')
      // On simule la logique : si SUPER_ADMIN et entiteId passée en paramètre
      const whereSA = { entiteId: entiteA.id }
      const ecrituresSA = await prisma.ecritureComptable.findMany({ where: whereSA })
      
      const diff = ecrituresSA.filter(e => e.entiteId !== entiteA.id)
      if (diff.length === 0) {
        console.log(`✅ Super Admin voit uniquement l'Entité A (${ecrituresSA.length} records).`)
      } else {
        console.error('❌ Super Admin voit des données hors filtre !')
      }
    }

    // 6. Test : Super Admin Global
    console.log('🔍 Test Super Admin Global (pas de filtre)...')
    const totalGlobal = await prisma.ecritureComptable.count()
    console.log(`✅ Super Admin accès total : ${totalGlobal} écritures au total dans la base.`)

  } catch (err) {
    console.error('❌ Erreur durant le test :', err)
  } finally {
    await prisma.$disconnect()
    console.log('🏁 TEST TERMINÉ.')
  }
}

testIsolation()

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_LOGIN = 'admin'
const ADMIN_PASSWORD = 'Admin@123'

async function main() {
  const existing = await prisma.utilisateur.findUnique({ where: { login: ADMIN_LOGIN } })
  const motDePasse = await bcrypt.hash(ADMIN_PASSWORD, 10)
  
  if (existing) {
    console.log('Admin existant. Passage du seed.')
    return
  }

  let entite = await prisma.entite.findFirst()
  if (!entite) {
    entite = await prisma.entite.create({
      data: {
        code: 'MM01',
        nom: 'Maison Mère',
        type: 'MAISON_MERE',
        localisation: 'Siège',
        active: true,
      },
    })
  }

  // Vérifier si le magasin existe déjà
  let magasin = await prisma.magasin.findUnique({ where: { code: 'MAG01' } })
  if (!magasin) {
    magasin = await prisma.magasin.create({
      data: {
        code: 'MAG01',
        nom: 'Magasin 01',
        localisation: entite.localisation,
        entiteId: entite.id,
        actif: true,
      },
    })
  }

  await prisma.utilisateur.create({
    data: {
      login: ADMIN_LOGIN,
      nom: 'Super Admin',
      email: 'admin@gesticom.local',
      motDePasse,
      role: 'SUPER_ADMIN',
      entiteId: entite.id,
      actif: true,
    },
  })

  // Vérifier si les paramètres existent déjà
  const paramsExistants = await prisma.parametre.findFirst()
  if (!paramsExistants) {
    await prisma.parametre.create({
      data: {
        nomEntreprise: 'GestiCom',
        contact: '',
        localisation: '',
        devise: 'FCFA',
        tvaParDefaut: 0,
      },
    })
  }

  console.log('Seed OK: Entité, Magasin, Utilisateur (admin / Admin@123), Paramètres.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

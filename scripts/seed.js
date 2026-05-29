/**
 * scripts/seed.js — Seed autonome pour production (JS pur, sans dépendance tsx)
 * Exécuté par standalone-launcher.js après migration.
 * Crée admin/entité/magasin/paramètres UNIQUEMENT si la base est vierge.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'Admin@123';

async function main() {
  const totalUsers = await prisma.utilisateur.count();
  if (totalUsers > 0) {
    console.log('[Seed] Utilisateurs existants. Seed ignoré.');
    return;
  }

  console.log('[Seed] Base vierge. Création des données initiales...');

  const motDePasse = await bcrypt.hash(ADMIN_PASSWORD, 10);

  let entite = await prisma.entite.findFirst();
  if (!entite) {
    entite = await prisma.entite.create({
      data: {
        code: 'MM01',
        nom: 'Maison Mère',
        type: 'MAISON_MERE',
        localisation: 'Siège',
        active: true,
      },
    });
    console.log('[Seed] Entité MM01 créée.');
  }

  let magasin = await prisma.magasin.findFirst({ where: { code: 'MAG01' } });
  if (!magasin) {
    magasin = await prisma.magasin.create({
      data: {
        code: 'MAG01',
        nom: 'Magasin 01',
        localisation: entite.localisation,
        entiteId: entite.id,
        actif: true,
      },
    });
    console.log('[Seed] Magasin MAG01 créé.');
  }

  const adminExists = await prisma.utilisateur.findUnique({ where: { login: ADMIN_LOGIN } });
  if (!adminExists) {
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
    });
    console.log('[Seed] Admin créé (admin / Admin@123).');
  }

  const paramsExist = await prisma.parametre.findFirst();
  if (!paramsExist) {
    await prisma.parametre.create({
      data: {
        nomEntreprise: 'GestiCom',
        contact: '',
        localisation: '',
        devise: 'FCFA',
        tvaParDefaut: 0,
      },
    });
    console.log('[Seed] Paramètres créés.');
  }

  console.log('[Seed] Terminé.');
}

main()
  .catch((e) => {
    console.error('[Seed] Erreur:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

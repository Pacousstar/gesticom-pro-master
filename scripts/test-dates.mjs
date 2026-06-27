import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const dates = await prisma.mouvement.findMany({ take: 5, orderBy: { date: 'desc' }, select: { id: true, date: true, type: true, quantite: true } });
console.log('Derniers:', JSON.stringify(dates, null, 2));

const first = await prisma.mouvement.findFirst({ orderBy: { date: 'asc' }, select: { id: true, date: true, type: true, quantite: true } });
console.log('Premier:', JSON.stringify(first, null, 2));

const count = await prisma.mouvement.count();
console.log('Total mouvements:', count);

const minMax = await prisma.mouvement.aggregate({ _min: { date: true }, _max: { date: true } });
console.log('Min date:', minMax._min.date, 'Max date:', minMax._max.date);

const test = await prisma.mouvement.findFirst({ where: { date: { gte: new Date('2025-01-01') } }, select: { id: true, date: true } });
console.log('Test date >= 2025-01-01:', test);

await prisma.$disconnect();

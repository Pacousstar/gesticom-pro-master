import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const clients = await prisma.client.findMany({ take: 5, orderBy: { id: 'asc' }, select: { id: true, code: true, nom: true } });
console.log('Premiers clients:', JSON.stringify(clients));
const passage = await prisma.client.findFirst({ where: { code: 'PASSAGE' } });
console.log('PASSAGE:', JSON.stringify(passage));
const anonyme = await prisma.client.findFirst({ where: { code: 'ANONYME' } });
console.log('ANONYME:', JSON.stringify(anonyme));
await prisma.$disconnect();

import { Session } from './auth'
import { prisma } from './db'

let defaultEntiteIdCache: number | null = null

export async function ensureDefaultEntite(): Promise<number> {
  if (defaultEntiteIdCache !== null) return defaultEntiteIdCache
  
  let entite = await prisma.entite.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
  if (entite) {
    defaultEntiteIdCache = entite.id
    return entite.id
  }
  
  entite = await prisma.entite.create({
    data: {
      code: 'ENT001',
      nom: 'Entreprise Principale',
      type: 'PRINCIPALE',
      localisation: '-',
      active: true,
    },
    select: { id: true },
  })
  defaultEntiteIdCache = entite.id
  return entite.id
}

export async function getEntiteId(session: Session | null): Promise<number> {
  if (!session) return await ensureDefaultEntite()
  
  if (session.role !== 'SUPER_ADMIN') {
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { entiteId: true },
    })
    if (user?.entiteId && user.entiteId > 0) {
      return user.entiteId
    }
    
    if (user) {
      await prisma.utilisateur.update({
        where: { id: session.userId },
        data: { entiteId: await ensureDefaultEntite() },
      })
    }
    return await ensureDefaultEntite()
  }

  if (session.entiteId > 0) {
    return session.entiteId
  }

  const user = await prisma.utilisateur.findUnique({
    where: { id: session.userId },
    select: { entiteId: true },
  })
  if (user?.entiteId && user.entiteId > 0) {
    return user.entiteId
  }

  const entiteId = await ensureDefaultEntite()
  
  await prisma.utilisateur.update({
    where: { id: session.userId },
    data: { entiteId },
  })
  
  return entiteId
}

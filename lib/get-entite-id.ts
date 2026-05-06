import { Session } from './auth'
import { prisma } from './db'

/**
 * Récupère l'entiteId à utiliser pour les opérations.
 * Pour SUPER_ADMIN, utilise l'entiteId de la session ou celui de l'utilisateur en base.
 * Pour les autres, utilise l'entiteId de l'utilisateur en base (sécurité).
 * 
 * Retourne 0 si aucune entité valide (les endpoints doivent gérer ce cas)
 */
export async function getEntiteId(session: Session | null): Promise<number> {
  if (!session) return 0
  // Pour les non-SUPER_ADMIN, utiliser uniquement l'entité de l'utilisateur en base
  if (session.role !== 'SUPER_ADMIN') {
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { entiteId: true },
    });

    if (user?.entiteId && user.entiteId > 0) {
      const exists = await prisma.entite.findUnique({ where: { id: user.entiteId }, select: { id: true } });
      if (exists) return user.entiteId;
    }
    
    return 0;
  }

  // Pour SUPER_ADMIN : Priorité à l'entité de la session
  if (session.entiteId > 0) {
    const exists = await prisma.entite.findUnique({ where: { id: session.entiteId }, select: { id: true } });
    if (exists) return session.entiteId;
  }

  // Fallback : récupérer l'entité de l'utilisateur en base
  const user = await prisma.utilisateur.findUnique({
    where: { id: session.userId },
    select: { entiteId: true },
  });

  if (user?.entiteId && user.entiteId > 0) {
    const exists = await prisma.entite.findUnique({ where: { id: user.entiteId }, select: { id: true } });
    if (exists) return user.entiteId;
  }

  // Retourne 1 par défaut pour SUPER_ADMIN (si aucune entité n'existe, on retourne 1)
  // Cela permet de ne pas bloquer l'admin en cas de configuration incomplète
  const firstEntite = await prisma.entite.findFirst({ select: { id: true } })
  if (firstEntite) {
    console.warn('[getEntiteId] SUPER_ADMIN sans entité dans session ou base, utilisation de l\'entité par défaut:', firstEntite.id)
    return firstEntite.id
  }
  
  console.error('[getEntiteId] SUPER_ADMIN sans entité valide - id:', session.userId)
  return 0;
}

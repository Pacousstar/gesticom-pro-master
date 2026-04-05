import { Session } from './auth'
import { prisma } from './db'

/**
 * Récupère l'entiteId à utiliser pour les opérations.
 * Pour SUPER_ADMIN, utilise l'entiteId de la session (qui peut être changé).
 * Pour les autres, utilise l'entiteId de l'utilisateur en base (sécurité).
 */
export async function getEntiteId(session: Session): Promise<number> {
  const potentialId = (session.role === 'SUPER_ADMIN')
    ? (session.entiteId || 0)
    : 0;

  // Si on a un ID de session (pour SUPER_ADMIN), on vérifie son existence
  if (potentialId > 0) {
    const exists = await prisma.entite.findUnique({ where: { id: potentialId }, select: { id: true } });
    if (exists) return potentialId;
  }

  // Pour les autres rôles ou si l'ID de session est invalide, on cherche l'ID de l'utilisateur en base
  const user = await prisma.utilisateur.findUnique({
    where: { id: session.userId },
    select: { entiteId: true },
  });

  if (user?.entiteId) {
    const exists = await prisma.entite.findUnique({ where: { id: user.entiteId }, select: { id: true } });
    if (exists) return user.entiteId;
  }

  // Fallback ultime : première entité trouvée
  const firstEntite = await prisma.entite.findFirst({ select: { id: true } });
  if (firstEntite) return firstEntite.id;

  return 0; // Aucune entité en base
}

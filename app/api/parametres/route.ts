import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ROLES_ADMIN } from '@/lib/require-role'
import { parametresPatchSchema } from '@/lib/validations'
import { prisma } from '@/lib/db'
import { logModification, getIpAddress } from '@/lib/audit'

async function canAccessParametres(session: any) {
  if (!session) return false
  if (ROLES_ADMIN.includes(session.role as 'SUPER_ADMIN' | 'ADMIN')) return true
  const user = await prisma.utilisateur.findUnique({
    where: { id: session.userId },
    select: { permissionsPersonnalisees: true },
  })
  if (!user?.permissionsPersonnalisees) return false
  try {
    const perms = JSON.parse(user.permissionsPersonnalisees) as string[]
    return Array.isArray(perms) && perms.includes('parametres:view')
  } catch {
    return false
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  if (!(await canAccessParametres(session))) {
    return NextResponse.json({ error: 'Droits insuffisants pour accéder aux paramètres.' }, { status: 403 })
  }

  let p = await prisma.parametre.findFirst({ orderBy: { id: 'asc' } })
  if (!p) {
    // Création automatique au premier appel si vide
    p = await prisma.parametre.create({
      data: {
        nomEntreprise: 'GestiCom Pro',
        devise: 'FCFA',
        typeCommerce: 'GENERAL',
        tvaParDefaut: 18,
        localisation: 'Côte d\'Ivoire',
        contact: '+225 ...',
      }
    })
  }
  return NextResponse.json(p)
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const canEdit = ROLES_ADMIN.includes(session.role as 'SUPER_ADMIN' | 'ADMIN') || await (async () => {
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { permissionsPersonnalisees: true },
    })
    if (!user?.permissionsPersonnalisees) return false
    try {
      const perms = JSON.parse(user.permissionsPersonnalisees) as string[]
      return Array.isArray(perms) && perms.includes('parametres:edit')
    } catch { return false }
  })()
  if (!canEdit) {
    return NextResponse.json({ error: 'Droits insuffisants pour modifier les paramètres.' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = parametresPatchSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Données invalides.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const data = parsed.data

    let p = await prisma.parametre.findFirst({ orderBy: { id: 'asc' } })
    if (!p) {
      p = await prisma.parametre.create({
        data: {
          nomEntreprise: data.nomEntreprise ?? '',
          slogan: data.slogan ?? null,
          contact: data.contact ?? '',
          email: data.email ?? null,
          siteWeb: data.siteWeb ?? null,
          localisation: data.localisation ?? '',
          numNCC: data.numNCC ?? null,
          registreCommerce: data.registreCommerce ?? null,
          devise: data.devise ?? 'FCFA',
          tvaParDefaut: data.tvaParDefaut ?? 0,
          typeCommerce: data.typeCommerce ?? 'GENERAL',
          logo: data.logo ?? null,
          piedDePage: data.piedDePage ?? null,
          smtpHost: data.smtpHost ?? null,
          smtpPort: data.smtpPort ?? null,
          smtpUser: data.smtpUser ?? null,
          smtpPass: data.smtpPass ?? null,
          backupAuto: data.backupAuto ?? false,
          backupFrequence: data.backupFrequence ?? 'QUOTIDIEN',
          backupDestination: data.backupDestination ?? 'LOCAL',
          backupEmailDest: data.backupEmailDest ?? null,
          mentionSpeciale: data.mentionSpeciale ?? null,
          dateCloture: data.dateCloture ? new Date(data.dateCloture) : null,
        },
      })
    } else {
      const update: Record<string, any> = {}
      if (data.nomEntreprise !== undefined) update.nomEntreprise = data.nomEntreprise
      if (data.slogan !== undefined) update.slogan = data.slogan || null
      if (data.contact !== undefined) update.contact = data.contact
      if (data.email !== undefined) update.email = data.email || null
      if (data.siteWeb !== undefined) update.siteWeb = data.siteWeb || null
      if (data.localisation !== undefined) update.localisation = data.localisation
      if (data.devise !== undefined) update.devise = data.devise
      if (data.tvaParDefaut !== undefined) update.tvaParDefaut = data.tvaParDefaut
      if (data.typeCommerce !== undefined) update.typeCommerce = data.typeCommerce
      if (data.logo !== undefined) update.logo = data.logo || null
      if (data.piedDePage !== undefined) update.piedDePage = data.piedDePage || null
      if (data.numNCC !== undefined) update.numNCC = data.numNCC || null
      if (data.registreCommerce !== undefined) update.registreCommerce = data.registreCommerce || null

      if (data.smtpHost !== undefined) update.smtpHost = data.smtpHost || null
      if (data.smtpPort !== undefined) update.smtpPort = data.smtpPort || null
      if (data.smtpUser !== undefined) update.smtpUser = data.smtpUser || null
      if (data.smtpPass !== undefined) update.smtpPass = data.smtpPass || null

      if (data.backupAuto !== undefined) update.backupAuto = data.backupAuto
      if (data.backupFrequence !== undefined) update.backupFrequence = data.backupFrequence
      if (data.backupDestination !== undefined) update.backupDestination = data.backupDestination
      if (data.backupEmailDest !== undefined) update.backupEmailDest = data.backupEmailDest || null

      if (data.fideliteActive !== undefined) update.fideliteActive = data.fideliteActive
      if (data.fideliteSeuilPoints !== undefined) update.fideliteSeuilPoints = data.fideliteSeuilPoints
      if (data.fideliteTauxRemise !== undefined) update.fideliteTauxRemise = data.fideliteTauxRemise
      if (data.mentionSpeciale !== undefined) update.mentionSpeciale = data.mentionSpeciale || null

      // SÉCURITÉ : Seul le Super Admin peut changer la date de clôture
      if (data.dateCloture !== undefined && session.role === 'SUPER_ADMIN') {
        update.dateCloture = data.dateCloture ? new Date(data.dateCloture) : null
      }

      if (Object.keys(update).length > 0) {
        p = await prisma.parametre.update({ where: { id: p.id }, data: update })
        
        // Log Audit
        await logModification(
          session,
          'PARAMETRE',
          p.id,
          `Configuration du système mise à jour (${Object.keys(update).join(', ')})`,
          {}, // Valeurs anciennes optionnelles
          update,
          getIpAddress(request)
        )
      }
    }
    return NextResponse.json(p)
  } catch (e) {
    console.error('PATCH /api/parametres:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

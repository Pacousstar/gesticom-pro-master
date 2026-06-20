import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { verifierCloture } from '@/lib/cloture'
import { logModification, logSuppression, getIpAddress } from '@/lib/audit'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { clientSchema } from '@/lib/validations'

// Utilisation directe du client Prisma

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'clients:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const c = await prisma.client.findFirst({
    where: { id, entiteId: session!.entiteId },
  })
  if (!c) return NextResponse.json({ error: 'Client introuvable ou accès refusé.' }, { status: 404 })
  return NextResponse.json(c)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requirePermission(session, 'clients:edit')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    // Vérifier que le client appartient à l'entité
    const existing = await prisma.client.findFirst({
      where: { id, entiteId: session!.entiteId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Client introuvable ou accès refusé.' }, { status: 404 })
    }

    const body = await request.json()
    const result = validateApiRequest(clientSchema.partial(), body)
    if (!result.success) return result.response
    const v = result.data

    const code = body?.code !== undefined ? (String(body.code).trim() || null) : undefined
    const nom = v.nom
    const telephone = v.telephone !== undefined ? v.telephone : undefined
    const type = v.type !== undefined
      ? (String(v.type).toUpperCase() === 'CREDIT' ? 'CREDIT' : 'CASH')
      : undefined
    const plafondCredit = v.plafondCredit !== undefined
      ? (type === 'CREDIT' ? Math.max(0, Number(v.plafondCredit) || 0) : null)
      : undefined
    const ncc = v.ncc !== undefined ? v.ncc : undefined
    const localisation = v.localisation !== undefined ? v.localisation : undefined
    const soldeInitial = v.soldeInitial !== undefined ? v.soldeInitial : undefined
    const avoirInitial = v.avoirInitial !== undefined ? v.avoirInitial : undefined
    const email = v.email !== undefined ? v.email : undefined
    const actif = body?.actif !== undefined ? Boolean(body.actif) : undefined

    // SEC-01: Vérification cloture si modification des soldes initiaux
    const modifieSoldeInitial = v.soldeInitial !== undefined && v.soldeInitial !== existing.soldeInitial
    const modifieAvoirInitial = avoirInitial !== undefined && avoirInitial !== existing.avoirInitial
    
    if (modifieSoldeInitial || modifieAvoirInitial) {
      // Vérifier cloture sur la date du jour (ou date de la dernière vente)
      const lastVente = await prisma.vente.findFirst({
        where: { clientId: id },
        orderBy: { date: 'desc' },
        select: { date: true }
      })
      const dateAVerifier = lastVente?.date || new Date()
      await verifierCloture(dateAVerifier, session)
    }

    const data: Record<string, unknown> = {}
    if (code !== undefined) data.code = code
    if (nom !== undefined) data.nom = nom
    if (telephone !== undefined) data.telephone = telephone
    if (email !== undefined) data.email = email
    if (type !== undefined) data.type = type
    if (plafondCredit !== undefined) data.plafondCredit = plafondCredit
    if (ncc !== undefined) data.ncc = ncc
    if (localisation !== undefined) data.localisation = localisation
    if (soldeInitial !== undefined) data.soldeInitial = soldeInitial
    if (avoirInitial !== undefined) data.avoirInitial = avoirInitial
    if (actif !== undefined) data.actif = actif

    const c = await prisma.client.update({ where: { id }, data: data as any })
    
    await logModification(session!, 'CLIENT', id, `Modification client ${c.nom} (${c.code || 'sans code'})`, existing, c, getIpAddress(request))
    
    return NextResponse.json(c)
  } catch (e) {
    await apiCatch(e, 'api/clients/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'clients:delete')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    // Vérifier si le client a des ventes ou règlements (Restrict au niveau DB)
    const [ventes, reglements, existing] = await Promise.all([
      prisma.vente.count({ where: { clientId: id } }),
      prisma.reglementVente.count({ where: { clientId: id } }),
      prisma.client.findFirst({ where: { id, entiteId: session!.entiteId } }),
    ])

    if (!existing) {
      return NextResponse.json({ error: 'Client introuvable ou accès refusé.' }, { status: 404 })
    }

    if (ventes > 0 || reglements > 0) {
      return NextResponse.json({
        error: `Suppression impossible : ce client a ${ventes} vente(s) et ${reglements} règlement(s) associé(s).`
      }, { status: 409 })
    }

    await prisma.client.delete({ where: { id } })
    
    await logSuppression(session!, 'CLIENT', id, `Suppression client ${existing.nom} (${existing.code || 'sans code'})`, existing, getIpAddress(request))
    
    return NextResponse.json({ ok: true })
  } catch (e) {
    await apiCatch(e, 'api/clients/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

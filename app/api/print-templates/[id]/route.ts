import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { logModification, logSuppression, getIpAddress } from '@/lib/audit'

async function checkPermission(session: any, permission: string) {
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, permission as any)
  if (authError) return authError
  return session
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const checked = await checkPermission(session, 'parametres:view')
  if (checked instanceof NextResponse) return checked

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const where: any = { id }
    if (session!.role !== 'SUPER_ADMIN') {
      where.entiteId = session!.entiteId
    }

    const template = await prisma.printTemplate.findFirst({ where })
    if (!template) {
      return NextResponse.json({ error: 'Template introuvable.' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (e) {
    console.error('GET /api/print-templates/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const checked = await checkPermission(session, 'parametres:edit')
  if (checked instanceof NextResponse) return checked

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const entiteId = session!.role !== 'SUPER_ADMIN' ? session!.entiteId : undefined
    const existing = await prisma.printTemplate.findFirst({
      where: entiteId ? { id, entiteId } : { id }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Template introuvable ou accès refusé.' }, { status: 404 })
    }

    const data = await request.json()
    const updateData: Record<string, any> = {}
    if (data.type !== undefined) updateData.type = data.type
    if (data.nom !== undefined) updateData.nom = data.nom
    if (data.logo !== undefined) updateData.logo = data.logo || null
    if (data.enTete !== undefined) updateData.enTete = data.enTete || null
    if (data.piedDePage !== undefined) updateData.piedDePage = data.piedDePage || null
    if (data.variables !== undefined) updateData.variables = data.variables ? JSON.stringify(data.variables) : null
    if (data.actif !== undefined) updateData.actif = data.actif

    const template = await prisma.printTemplate.update({
      where: { id },
      data: updateData,
    })

    await logModification(checked, 'PRINT_TEMPLATE', id, `Modification modèle impression: ${template.nom}`, existing, template, getIpAddress(request))

    return NextResponse.json(template)
  } catch (e) {
    console.error('PATCH /api/print-templates/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const checked = await checkPermission(session, 'parametres:edit')
  if (checked instanceof NextResponse) return checked

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const entiteId = session!.role !== 'SUPER_ADMIN' ? session!.entiteId : undefined
    const existing = await prisma.printTemplate.findFirst({
      where: entiteId ? { id, entiteId } : { id }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Template introuvable ou accès refusé.' }, { status: 404 })
    }

    await prisma.printTemplate.delete({ where: { id } })
    await logSuppression(checked, 'PRINT_TEMPLATE', id, `Suppression modèle impression: ${existing.nom}`, existing, getIpAddress(_request))

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/print-templates/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

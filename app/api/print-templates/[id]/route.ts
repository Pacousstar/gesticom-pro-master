import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { logModification, logSuppression, getIpAddress } from '@/lib/audit'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { printTemplateSchema } from '@/lib/validations'

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
    await apiCatch(e, 'api/print-templates/[id]')
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

    const body = await request.json()
    const result = validateApiRequest(printTemplateSchema.partial(), body)
    if (!result.success) return result.response
    const validated = result.data
    const updateData: Record<string, any> = {}
    if (validated.type !== undefined) updateData.type = validated.type
    if (validated.nom !== undefined) updateData.nom = validated.nom
    if (body.logo !== undefined) updateData.logo = body.logo || null
    if (body.enTete !== undefined) updateData.enTete = body.enTete || null
    if (body.piedDePage !== undefined) updateData.piedDePage = body.piedDePage || null
    if (body.variables !== undefined) updateData.variables = body.variables ? JSON.stringify(body.variables) : null
    if (body.actif !== undefined) updateData.actif = body.actif

    const template = await prisma.printTemplate.update({
      where: { id },
      data: updateData,
    })

    await logModification(checked, 'PRINT_TEMPLATE', id, `Modification modèle impression: ${template.nom}`, existing, template, getIpAddress(request))

    return NextResponse.json(template)
  } catch (e) {
    await apiCatch(e, 'api/print-templates/[id]')
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
    await apiCatch(e, 'api/print-templates/[id]')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

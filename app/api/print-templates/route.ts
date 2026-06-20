import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { logModification, logSuppression, getIpAddress } from '@/lib/audit'
import { getEntiteId } from '@/lib/get-entite-id'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { printTemplateSchema } from '@/lib/validations'

async function checkPermission(session: any, permission: string) {
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, permission as any)
  if (authError) return authError
  return session as any
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  const checked = await checkPermission(session, 'parametres:view')
  if (checked instanceof NextResponse) return checked

  try {
    const type = request.nextUrl.searchParams.get('type')
    const where: any = type ? { type, actif: true } : { actif: true }
    
    if (session!.role !== 'SUPER_ADMIN') {
      where.entiteId = session!.entiteId
    }
    
    const templates = await prisma.printTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(templates)
  } catch (e) {
    await apiCatch(e, 'api/print-templates')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const checked = await checkPermission(session, 'parametres:edit')
  if (checked instanceof NextResponse) return checked

  try {
    const entiteId = await getEntiteId(session!)
    if (!entiteId) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    const body = await request.json()
    const result = validateApiRequest(printTemplateSchema.omit({ contenu: true }), body)
    if (!result.success) return result.response
    const data = result.data
    const { type, nom, logo, enTete, piedDePage, variables, actif } = body

    const template = await prisma.printTemplate.create({
      data: {
        type: data.type,
        nom: data.nom,
        logo: logo || null,
        enTete: enTete || null,
        piedDePage: piedDePage || null,
        variables: variables ? JSON.stringify(variables) : null,
        actif: actif !== false,
        entiteId,
      },
    })

    await logModification(checked, 'PRINT_TEMPLATE', template.id, `Création modèle impression: ${nom}`, {}, template, getIpAddress(request))

    return NextResponse.json(template)
  } catch (e) {
    await apiCatch(e, 'api/print-templates')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  const checked = await checkPermission(session, 'parametres:edit')
  if (checked instanceof NextResponse) return checked

  try {
    const body = await request.json()
    const { id, ...data } = body
    const result = validateApiRequest(printTemplateSchema.partial(), data)
    if (!result.success) return result.response

    if (!id || !Number.isInteger(id)) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const entiteId = session!.role !== 'SUPER_ADMIN' ? session!.entiteId : undefined
    const existing = await prisma.printTemplate.findFirst({ 
      where: entiteId ? { id, entiteId } : { id } 
    })
    if (!existing) {
      return NextResponse.json({ error: 'Template introuvable ou accès refusé.' }, { status: 404 })
    }

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
    await apiCatch(e, 'api/print-templates')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  const checked = await checkPermission(session, 'parametres:edit')
  if (checked instanceof NextResponse) return checked

  try {
    const { id } = await request.json()
    if (!id || !Number.isInteger(id)) {
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

    await logSuppression(checked, 'PRINT_TEMPLATE', id, `Suppression modèle impression: ${existing.nom}`, existing, getIpAddress(request))

    return NextResponse.json({ ok: true })
  } catch (e) {
    await apiCatch(e, 'api/print-templates')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

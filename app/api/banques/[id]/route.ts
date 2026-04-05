import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const banqueId = Number(id)
    if (!banqueId || !Number.isInteger(banqueId)) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const data = await request.json()
    const { numero, nomBanque, libelle, soldeInitial, compteId } = data

    // Vérifier que la banque existe
    const banqueExistante = await prisma.banque.findUnique({ where: { id: banqueId } })
    if (!banqueExistante) {
      return NextResponse.json({ error: 'Compte bancaire introuvable.' }, { status: 404 })
    }

    // Vérifier les permissions (même entité ou SUPER_ADMIN)
    if (session.role !== 'SUPER_ADMIN' && banqueExistante.entiteId !== session.entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // Si le numéro change, vérifier qu'il n'existe pas déjà
    if (numero && numero !== banqueExistante.numero) {
      const existe = await prisma.banque.findUnique({ where: { numero } })
      if (existe) {
        return NextResponse.json({ error: 'Ce numéro de compte existe déjà.' }, { status: 400 })
      }
    }

    const updateData: any = {}
    if (numero !== undefined) updateData.numero = numero.trim()
    if (nomBanque !== undefined) updateData.nomBanque = nomBanque.trim()
    if (libelle !== undefined) updateData.libelle = libelle.trim()
    if (soldeInitial !== undefined) {
      updateData.soldeInitial = Number(soldeInitial) || 0
      // Recalculer le solde actuel si le solde initial change
      const operations = await prisma.operationBancaire.findMany({ where: { banqueId } })
      let solde = Number(soldeInitial) || 0
      for (const op of operations) {
        if (op.type === 'DEPOT' || op.type === 'VIREMENT_ENTRANT' || op.type === 'INTERETS') {
          solde += op.montant
        } else {
          solde -= op.montant
        }
      }
      updateData.soldeActuel = solde
    }
    if (compteId !== undefined) updateData.compteId = compteId ? Number(compteId) : null

    const banque = await prisma.banque.update({
      where: { id: banqueId },
      data: updateData,
      include: {
        compte: { select: { id: true, numero: true, libelle: true } },
      },
    })

    await logAction(session, 'MODIFICATION', 'BANQUE', `Modification compte bancaire: ${banque.nomBanque}`, banque.entiteId)

    return NextResponse.json(banque)
  } catch (error) {
    console.error('PATCH /api/banques/[id]:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await params
    const banqueId = Number(id)
    if (!banqueId || !Number.isInteger(banqueId)) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const banque = await prisma.banque.findUnique({ where: { id: banqueId } })
    if (!banque) {
      return NextResponse.json({ error: 'Compte bancaire introuvable.' }, { status: 404 })
    }

    // Vérifier les permissions
    if (session.role !== 'SUPER_ADMIN' && banque.entiteId !== session.entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // Vérifier s'il y a des opérations
    const operationsCount = await prisma.operationBancaire.count({ where: { banqueId } })
    if (operationsCount > 0) {
      // Désactiver au lieu de supprimer
      await prisma.banque.update({
        where: { id: banqueId },
        data: { actif: false },
      })
    } else {
      // Supprimer si aucune opération
      await prisma.banque.delete({ where: { id: banqueId } })
    }

    await logAction(session, 'SUPPRESSION', 'BANQUE', `Suppression compte bancaire: ${banque.nomBanque}`, banque.entiteId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/banques/[id]:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/comptabilite/diagnostic — Diagnostic des données comptables
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Compter les comptes
    const nbComptes = await prisma.planCompte.count({ where: { actif: true } })
    const comptesParClasse = await prisma.planCompte.groupBy({
      by: ['classe'],
      where: { actif: true },
      _count: { id: true },
    })

    // Compter les journaux
    const nbJournaux = await prisma.journal.count({ where: { actif: true } })
    const journaux = await prisma.journal.findMany({
      where: { actif: true },
      select: { code: true, libelle: true, type: true },
      orderBy: { code: 'asc' },
    })

    // Compter les opérations (ventes, achats, dépenses, charges)
    const [nbVentes, nbAchats, nbDepenses, nbCharges] = await Promise.all([
      prisma.vente.count({ where: { statut: 'VALIDEE' } }),
      prisma.achat.count(),
      prisma.depense.count(),
      prisma.charge.count(),
    ])

    // Compter les écritures
    const nbEcritures = await prisma.ecritureComptable.count()
    const ecrituresDateRange = await prisma.ecritureComptable.aggregate({
      _min: { date: true },
      _max: { date: true },
    })
    const ecrituresParJournal = await prisma.ecritureComptable.groupBy({
      by: ['journalId'],
      _count: { id: true },
    })
    const ecrituresParType = await prisma.ecritureComptable.groupBy({
      by: ['referenceType'],
      _count: { id: true },
    })

    // Récupérer les dernières écritures
    const dernieresEcritures = await prisma.ecritureComptable.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: {
        journal: { select: { code: true } },
        compte: { select: { numero: true, libelle: true } },
      },
    })

    // Vérifier les comptes essentiels
    const comptesEssentiels = [
      { numero: '101', libelle: 'Capital' },
      { numero: '311', libelle: 'Stocks de marchandises' },
      { numero: '401', libelle: 'Fournisseurs' },
      { numero: '411', libelle: 'Clients' },
      { numero: '521', libelle: 'Banque' },
      { numero: '531', libelle: 'Caisse' },
      { numero: '601', libelle: 'Achats de marchandises' },
      { numero: '603', libelle: 'Variation de stocks' },
      { numero: '701', libelle: 'Ventes de marchandises' },
      { numero: '703', libelle: 'Ventes de produits finis' },
    ]
    const comptesExistants = await prisma.planCompte.findMany({
      where: {
        numero: { in: comptesEssentiels.map(c => c.numero) },
        actif: true,
      },
      select: { numero: true, libelle: true },
    })
    const comptesManquants = comptesEssentiels.filter(
      c => !comptesExistants.find(e => e.numero === c.numero)
    )

    // Vérifier les journaux essentiels
    const journauxEssentiels = ['VE', 'AC', 'CA', 'OD']
    const journauxExistants = journaux.map(j => j.code)
    const journauxManquants = journauxEssentiels.filter(
      j => !journauxExistants.includes(j)
    )

    // Audit de Caisse : Comparaison Règlements Espèces vs Table Caisse
    const [totalRegsEspVente, totalCaisseEntree, totalRegsEspAchat, totalCaisseSortie] = await Promise.all([
      prisma.reglementVente.aggregate({ where: { modePaiement: { in: ['ESPECES', 'CASH'] } }, _sum: { montant: true } }),
      prisma.caisse.aggregate({ where: { type: 'ENTREE' }, _sum: { montant: true } }),
      prisma.reglementAchat.aggregate({ where: { modePaiement: { in: ['ESPECES', 'CASH'] } }, _sum: { montant: true } }),
      prisma.caisse.aggregate({ where: { type: 'SORTIE' }, _sum: { montant: true } }),
    ])

    const totalDepensesEsp = await prisma.depense.aggregate({ where: { modePaiement: { in: ['ESPECES', 'CASH'] } }, _sum: { montantPaye: true } })
    const totalChargesEsp = await prisma.charge.aggregate({ _sum: { montant: true } })

    return NextResponse.json({
      operations: {
        ventes: nbVentes,
        achats: nbAchats,
        depenses: nbDepenses,
        charges: nbCharges,
      },
      auditCaisse: {
        entrees: {
          reglementsVentes: totalRegsEspVente._sum.montant || 0,
          caisseFlux: totalCaisseEntree._sum.montant || 0,
          ecart: (totalCaisseEntree._sum.montant || 0) - (totalRegsEspVente._sum.montant || 0),
        },
        sorties: {
          reglementsAchats: totalRegsEspAchat._sum.montant || 0,
          depenses: totalDepensesEsp._sum.montantPaye || 0,
          charges: totalChargesEsp._sum.montant || 0,
          caisseFlux: totalCaisseSortie._sum.montant || 0,
          ecart: (totalCaisseSortie._sum.montant || 0) - ((totalRegsEspAchat._sum.montant || 0) + (totalDepensesEsp._sum.montantPaye || 0) + (totalChargesEsp._sum.montant || 0)),
        }
      },
      ecrituresDateMin: ecrituresDateRange._min.date?.toISOString().split('T')[0] ?? null,
      ecrituresDateMax: ecrituresDateRange._max.date?.toISOString().split('T')[0] ?? null,
      planComptes: {
        total: nbComptes,
        parClasse: comptesParClasse.map(c => ({
          classe: c.classe,
          nombre: c._count.id,
        })),
        comptesEssentiels: {
          existants: comptesExistants,
          manquants: comptesManquants,
        },
      },
      journaux: {
        total: nbJournaux,
        liste: journaux,
        journauxEssentiels: {
          existants: journauxExistants,
          manquants: journauxManquants,
        },
      },
      ecritures: {
        total: nbEcritures,
        parJournal: await Promise.all(
          ecrituresParJournal.map(async (e) => {
            const journal = await prisma.journal.findUnique({
              where: { id: e.journalId },
              select: { code: true, libelle: true },
            })
            return {
              journal: journal?.code || '?',
              libelle: journal?.libelle || '?',
              nombre: e._count.id,
            }
          })
        ),
        parType: ecrituresParType.map(e => ({
          type: e.referenceType || 'MANUEL',
          nombre: e._count.id,
        })),
        dernieres: dernieresEcritures.map(e => ({
          date: e.date.toISOString().split('T')[0],
          journal: e.journal.code,
          compte: `${e.compte.numero} - ${e.compte.libelle}`,
          libelle: e.libelle,
          debit: e.debit,
          credit: e.credit,
        })),
      },
      etat: {
        initialise: nbComptes > 0 && nbJournaux > 0,
        pret: nbComptes > 0 && nbJournaux > 0 && comptesManquants.length === 0 && journauxManquants.length === 0,
        aDesEcritures: nbEcritures > 0,
        caisseSynchronisee: Math.abs((totalCaisseEntree._sum.montant || 0) - (totalRegsEspVente._sum.montant || 0)) < 10,
      },
    })
  } catch (e) {
    console.error('GET /api/comptabilite/diagnostic:', e)
    const errorMsg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: 'Erreur lors du diagnostic.', details: errorMsg },
      { status: 500 }
    )
  }
}

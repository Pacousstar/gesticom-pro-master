import { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import {
  Banknote,
  ShoppingCart,
  Users,
  ArrowUp,
  ArrowDown,
  ArrowDownCircle,
  TrendingUp,
  FileText,
  DollarSign,
  Download,
  Share2,
  FileSpreadsheet,
  Clock,
  ShoppingBag,
  Receipt
} from 'lucide-react'
import InitButton from './InitButton'
import DiagnosticButton from './DiagnosticButton'

function formatFcfa(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} FCFA`
}

const MOIS: { v: number; l: string }[] = [
  { v: 1, l: 'Janvier' }, { v: 2, l: 'Février' }, { v: 3, l: 'Mars' }, { v: 4, l: 'Avril' },
  { v: 5, l: 'Mai' }, { v: 6, l: 'Juin' }, { v: 7, l: 'Juillet' }, { v: 8, l: 'Août' },
  { v: 9, l: 'Septembre' }, { v: 10, l: 'Octobre' }, { v: 11, l: 'Novembre' }, { v: 12, l: 'Décembre' },
]

export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string; annee?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const canAccess = session.role === 'SUPER_ADMIN' || session.role === 'COMPTABLE'
  if (!canAccess) {
    redirect('/dashboard?error=compta_denied')
  }

  const sp = await searchParams
  const now = new Date()
  const annee = Math.min(2030, Math.max(2020, parseInt(sp.annee || '', 10) || now.getFullYear()))
  const mois = Math.min(12, Math.max(1, parseInt(sp.mois || '', 10) || now.getMonth() + 1))

  const debMois = new Date(annee, mois - 1, 1)
  const finMois = new Date(annee, mois, 0, 23, 59, 59)
  const debMoisPrec = new Date(annee, mois - 2, 1)
  const finMoisPrec = new Date(annee, mois - 1, 0, 23, 59, 59)

  // Utiliser l'entité de la session
  const entiteId = session.entiteId || 1
  const entiteFilter = { entiteId }
  const catchZero = { _sum: { montantTotal: 0, montant: 0 }, _count: { id: 0 } }

  // CA du mois (ventes validées), achats — Client: $queryRaw car conflit de nom prisma.client
  const [
    caMois, caMoisPrec, nbVentesMois, nbVentesMoisPrec, rClient, rClientPrec,
    totalAchatsMois, totalAchatsMoisPrec, ventesMois, achatsMois,
  ] = await Promise.all([
    prisma.vente.aggregate({
      where: { date: { gte: debMois, lte: finMois }, statut: 'VALIDEE', ...entiteFilter },
      _sum: { montantTotal: true },
    }).catch(() => catchZero),
    prisma.vente.aggregate({
      where: { date: { gte: debMoisPrec, lte: finMoisPrec }, statut: 'VALIDEE', ...entiteFilter },
      _sum: { montantTotal: true },
    }).catch(() => catchZero),
    prisma.vente.count({ where: { date: { gte: debMois, lte: finMois }, statut: 'VALIDEE', ...entiteFilter } }).catch(() => 0),
    prisma.vente.count({ where: { date: { gte: debMoisPrec, lte: finMoisPrec }, statut: 'VALIDEE', ...entiteFilter } }).catch(() => 0),
    prisma.$queryRaw<[{ n: number }]>`SELECT COUNT(*) as n FROM "Client"`.catch(() => [{ n: 0 }]),
    prisma.$queryRaw<[{ n: number }]>(Prisma.sql`SELECT COUNT(*) as n FROM "Client" WHERE "createdAt" <= ${finMoisPrec}`).catch(() => [{ n: 0 }]),
    prisma.achat.aggregate({
      where: { date: { gte: debMois, lte: finMois }, statut: 'VALIDEE', ...entiteFilter },
      _sum: { montantTotal: true },
    }).catch(() => catchZero),
    prisma.achat.aggregate({
      where: { date: { gte: debMoisPrec, lte: finMoisPrec }, statut: 'VALIDEE', ...entiteFilter },
      _sum: { montantTotal: true },
    }).catch(() => catchZero),
    prisma.vente.findMany({
      where: { date: { gte: debMois, lte: finMois }, statut: 'VALIDEE', ...entiteFilter },
      take: 15,
      orderBy: { date: 'desc' },
      select: { id: true, numero: true, date: true, montantTotal: true, magasin: { select: { code: true } } },
    }).catch(() => []),
    prisma.achat.findMany({
      where: { date: { gte: debMois, lte: finMois }, statut: 'VALIDEE', ...entiteFilter },
      take: 15,
      orderBy: { date: 'desc' },
      select: { id: true, numero: true, date: true, montantTotal: true, magasin: { select: { code: true } } },
    }).catch(() => []),
  ]) as any

  // Dépenses : tolérant si la table n'existe pas
  let totalDepensesMois = { _sum: { montant: null as number | null } }
  let depensesMois: Array<{ id: number; date: Date; libelle: string; montant: number; categorie: string; magasin: { code: string } | null }> = []
  try {
    const [agg, list] = await Promise.all([
      prisma.depense.aggregate({
        where: { date: { gte: debMois, lte: finMois } },
        _sum: { montant: true },
      }),
      prisma.depense.findMany({
        where: { date: { gte: debMois, lte: finMois } },
        take: 15,
        orderBy: { date: 'desc' },
        select: { id: true, date: true, libelle: true, montant: true, categorie: true, magasin: { select: { code: true } } },
      }),
    ])
    totalDepensesMois = agg
    depensesMois = list
  } catch {
    // Table Depense absente : on garde 0 et []
  }

  // Charges : tolérant si la table n'existe pas
  let totalChargesMois = { _sum: { montant: null as number | null } }
  let chargesMois: Array<{ id: number; date: Date; rubrique: string; montant: number; type: string; observation: string | null }> = []
  try {
    const [agg, list] = await Promise.all([
      prisma.charge.aggregate({
        where: { date: { gte: debMois, lte: finMois } },
        _sum: { montant: true },
      }),
      prisma.charge.findMany({
        where: { date: { gte: debMois, lte: finMois } },
        take: 15,
        orderBy: { date: 'desc' },
        select: { id: true, date: true, rubrique: true, montant: true, type: true, observation: true },
      }),
    ])
    totalChargesMois = agg
    chargesMois = list
  } catch {
    // Table Charge absente : on garde 0 et []
  }

  const totalClients = Number(rClient[0]?.n ?? 0)
  const nbClientsMoisPrec = Number(rClientPrec[0]?.n ?? 0)

  const ca = caMois._sum?.montantTotal ?? 0
  const caPrec = caMoisPrec._sum?.montantTotal ?? 0
  const totalAchats = totalAchatsMois._sum?.montantTotal ?? 0
  const totalAchatsPrec = totalAchatsMoisPrec._sum?.montantTotal ?? 0
  const totalDepenses = totalDepensesMois._sum?.montant ?? 0
  const totalCharges = totalChargesMois._sum?.montant ?? 0
  const evolCa = caPrec > 0 ? ((ca - caPrec) / caPrec) * 100 : (ca > 0 ? 100 : 0)
  const evolVentes =
    nbVentesMoisPrec > 0
      ? ((nbVentesMois - nbVentesMoisPrec) / nbVentesMoisPrec) * 100
      : (nbVentesMois > 0 ? 100 : 0)
  const evolClients =
    nbClientsMoisPrec > 0
      ? ((totalClients - nbClientsMoisPrec) / nbClientsMoisPrec) * 100
      : (totalClients > 0 ? 100 : 0)
  const evolAchats =
    totalAchatsPrec > 0
      ? ((totalAchats - totalAchatsPrec) / totalAchatsPrec) * 100
      : (totalAchats > 0 ? 100 : 0)

  const cards = [
    {
      title: "Chiffre d'affaires",
      value: formatFcfa(ca),
      sub: 'Ce mois',
      change: evolCa,
      icon: Banknote,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      iconBg: 'bg-emerald-100/50',
    },
    {
      title: 'Transactions',
      value: String(nbVentesMois),
      sub: 'Ventes ce mois',
      change: evolVentes,
      icon: ShoppingCart,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      iconBg: 'bg-blue-100/50',
    },
    {
      title: 'Clients Actifs',
      value: String(totalClients),
      sub: 'Base clients',
      change: evolClients,
      icon: Users,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      iconBg: 'bg-indigo-100/50',
    },
    {
      title: 'Achats Fournisseurs',
      value: formatFcfa(totalAchats),
      sub: 'Total ce mois',
      change: evolAchats,
      icon: ShoppingBag,
      color: 'bg-orange-50 text-orange-600 border-orange-100',
      iconBg: 'bg-orange-100/50',
    },
  ]

  const moisLabel = debMois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 pb-12">
      {/* --- BANDEAU SUPÉRIEUR ORANGE --- */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-orange-700 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-orange-400/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Comptabilité</h1>
            <p className="mt-2 text-white/90 font-medium max-w-2xl">
              Chiffres de GestiCom — CA, ventes, clients et évolution. <br />
              <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full backdrop-blur-md">
                Accès réservé au Super Administrateur et au Comptable.
              </span>
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <InitButton />
            <DiagnosticButton />
            <a href="/dashboard/comptabilite/plan-comptes" className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white hover:bg-blue-500 shadow-lg shadow-blue-900/40 transition-all uppercase tracking-tighter">Plan de Comptes</a>
            <a href="/dashboard/comptabilite/journaux" className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-black text-white hover:bg-purple-500 shadow-lg shadow-purple-900/40 transition-all uppercase tracking-tighter">Journaux</a>
            <a href="/dashboard/comptabilite/ecritures" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/40 transition-all uppercase tracking-tighter">Écritures</a>
            <a href="/dashboard/comptabilite/grand-livre" className="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-black text-white hover:bg-teal-500 shadow-lg shadow-teal-900/40 transition-all uppercase tracking-tighter">Grand Livre</a>
            <a href="/dashboard/comptabilite/balance" className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/40 transition-all uppercase tracking-tighter">Balance</a>
          </div>
        </div>
      </div>

      {/* --- SÉLECTEUR DE PÉRIODE --- */}
      <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex flex-wrap items-end gap-6">
        <form action="/dashboard/comptabilite" method="GET" className="flex flex-wrap items-end gap-4 w-full sm:w-auto">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mois</label>
            <select name="mois" defaultValue={mois} className="block w-40 rounded-xl border-gray-200 bg-gray-50 text-gray-900 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all">
              {MOIS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Année</label>
            <select name="annee" defaultValue={annee} className="block w-32 rounded-xl border-gray-200 bg-gray-50 text-gray-900 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all">
              {Array.from({ length: 11 }, (_, i) => 2020 + i).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button type="submit" className="rounded-xl bg-orange-600 px-8 py-2.5 text-sm font-black text-white hover:bg-orange-500 transition-all shadow-lg shadow-orange-900/20 uppercase tracking-widest">
            Appliquer
          </button>
        </form>
      </div>

      {/* --- SECTION EXPORTS --- */}
      <div className="rounded-[2.5rem] bg-slate-50 border border-slate-200 p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10 text-center md:text-left">
           <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Exports Experts (GestiCom Pro)</h3>
           <p className="text-sm text-slate-500 font-medium">Générez vos fichiers pour votre expert-comptable (Format Sage SAS ou Excel).</p>
        </div>
        <div className="flex gap-4 relative z-10 w-full md:w-auto">
          <a
            href={`/api/comptabilite/export-pro?type=SAGE&mois=${mois}&annee=${annee}`}
            className="flex-1 md:flex-none flex items-center justify-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 font-black text-white hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all uppercase text-xs tracking-widest"
          >
            <Share2 className="h-5 w-5" />
            Export Sage (.txt)
          </a>
          <a
            href={`/api/comptabilite/export-pro?type=EXCEL&mois=${mois}&annee=${annee}`}
            className="flex-1 md:flex-none flex items-center justify-center gap-3 rounded-2xl border-2 border-emerald-500 bg-white px-8 py-4 font-black text-emerald-600 hover:bg-emerald-50 shadow-xl shadow-emerald-500/10 transition-all uppercase text-xs tracking-widest"
          >
            <FileSpreadsheet className="h-5 w-5" />
            Synthèse Excel
          </a>
        </div>
      </div>

      {/* --- RÉSUMÉ DU MOIS --- */}
      <div className="py-2 px-6 bg-orange-50 border-l-4 border-orange-500 rounded-r-2xl">
        <p className="text-xs font-bold text-orange-800 uppercase tracking-widest">
          Résumé du mois de <span className="font-black underline decoration-2 underline-offset-4">{moisLabel}</span>
        </p>
      </div>

      {/* --- GRILLE 4 COMPTEURS TÊTE --- */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Chiffre d'affaires", val: formatFcfa(ca), sub: "Ce mois", icon: Banknote, color: "bg-emerald-500" },
          { label: "Ventes", val: String(nbVentesMois), sub: "Transactions ce mois", icon: ShoppingCart, color: "bg-blue-500" },
          { label: "Clients", val: String(totalClients), sub: `${evolClients.toFixed(1)}% vs mois dernier`, icon: Users, color: "bg-indigo-500" },
          { label: "Achats", val: formatFcfa(totalAchats), sub: "Total ce mois", icon: ShoppingBag, color: "bg-orange-500" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-[2rem] ${c.color} p-8 shadow-xl transition-all hover:scale-[1.02] hover:shadow-2xl`}>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10">
              <c.icon className="h-32 w-32 text-white" />
            </div>
            <div className="relative z-10 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{c.label}</p>
              <h3 className="mt-2 text-3xl font-black tracking-tighter">{c.val}</h3>
              <p className="mt-1 text-xs font-medium opacity-60 uppercase">{c.sub}</p>
            </div>
            <div className="absolute bottom-6 right-8 rounded-2xl bg-white/20 p-3 backdrop-blur-md">
              <c.icon className="h-6 w-6 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* --- SECTION SYNTHÈSE DU MOIS (8 WIDGETS) --- */}
      <div className="space-y-4 pt-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-white animate-pulse" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Synthèse du mois</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'CA', val: formatFcfa(ca), sub: 'Ventes validées', icon: Banknote, color: 'bg-emerald-500' },
            { label: 'Achats', val: formatFcfa(totalAchats), sub: 'Total des achats', icon: ShoppingCart, color: 'bg-teal-600' },
            { label: 'Dépenses', val: formatFcfa(totalDepenses), sub: 'Total des dépenses', icon: DollarSign, color: 'bg-rose-500' },
            { label: 'Marge brute', val: formatFcfa(Math.max(0, ca - totalAchats)), sub: 'CA - Achats', icon: TrendingUp, color: 'bg-indigo-600' },
            { label: 'Résultat net', val: formatFcfa(ca - totalAchats - totalDepenses - totalCharges), sub: 'CA - Achats - Dépenses - Charges', icon: FileText, color: 'bg-orange-500' },
            { label: 'Nombre de ventes', val: String(nbVentesMois), sub: 'Ventes ce mois', icon: ShoppingBag, color: 'bg-emerald-600' },
            { label: 'Clients actifs', val: String(totalClients), sub: 'Clients ayant acheté', icon: Users, color: 'bg-rose-600' },
            { label: 'Évolution CA', val: `${evolCa.toFixed(1)}%`, sub: 'Vs mois dernier', icon: ArrowUp, color: 'bg-blue-600' },
          ].map((item, idx) => (
            <div key={idx} className={`group relative overflow-hidden rounded-[1.5rem] ${item.color} p-6 shadow-lg transition-all hover:-translate-y-1`}>
              <div className="relative z-10 text-white">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{item.label}</p>
                <p className="mt-1 text-2xl font-black tracking-tighter">{item.val}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase opacity-50 italic">{item.sub}</p>
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 right-6 opacity-20 transition-transform group-hover:scale-110">
                <item.icon className="h-8 w-8 text-white" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- GRILLE DES LISTES DE FLUX --- */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4 pt-8">
        {[
          { title: "Ventes du mois", data: ventesMois, color: "emerald", icon: ShoppingCart, path: "/dashboard/ventes" },
          { title: "Achats du mois", data: achatsMois, color: "blue", icon: FileText, path: "/dashboard/achats" },
          { title: "Dépenses du mois", data: depensesMois, color: "rose", icon: DollarSign, path: "/dashboard/depenses" },
          { title: "Charges du mois", data: chargesMois, color: "purple", icon: Receipt, path: "/dashboard/charges" },
        ].map((bloc, bIdx) => (
          <div key={bIdx} className="overflow-hidden rounded-[2rem] bg-white shadow-xl border border-gray-100 flex flex-col h-[450px]">
            <div className={`p-6 bg-${bloc.color}-500 text-white flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <bloc.icon className="h-5 w-5" />
                <h3 className="font-black uppercase tracking-tighter text-sm italic">{bloc.title}</h3>
              </div>
              <a href={bloc.path} className="text-[10px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4 hover:opacity-80 transition-opacity">Voir tout</a>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
              {bloc.data.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 gap-2">
                  <bloc.icon className="h-8 w-8" />
                  <p className="text-[10px] font-black uppercase italic">Aucune donnée</p>
                </div>
              ) : (
                <table className="w-full">
                  <tbody className="divide-y divide-gray-100">
                    {bloc.data.map((item: any, i: number) => (
                      <tr key={i} className="group">
                        <td className="py-3 pr-2">
                          <p className={`text-xs font-black text-${bloc.color}-600 uppercase tracking-tighter truncate max-w-[120px]`}>
                            {'numero' in item ? item.numero : ('libelle' in item ? item.libelle : item.rubrique)}
                          </p>
                          <p className="text-[9px] font-bold text-gray-400 mt-0.5">{new Date(item.date).toLocaleDateString('fr-FR', {day: '2-digit', month: 'short'})}</p>
                        </td>
                        <td className="py-3 text-right">
                          <p className="text-xs font-black text-gray-800 tracking-tighter">
                            {formatFcfa(Number('montantTotal' in item ? item.montantTotal : item.montant))}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, Scale, Printer, FileSpreadsheet } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  libelle: string
  montant: number
  type: string
  montantSigne: number
}

interface Detail {
  id: number
  code: string
  nom: string
  ncc: string | null
  client: { id: number; nom: string; code: string | null; telephone: string | null } | null
  fournisseur: { id: number; nom: string; code: string | null; telephone: string | null } | null
  transactions: Transaction[]
  solde: number
}

export default function CompteCourantDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)

  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/comptes-courants/${params.id}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDetail() }, [params.id])

  const handleCompenser = async () => {
    if (!data) return
    const res = await fetch('/api/comptes-courants/compenser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: data.id }),
    })
    const result = await res.json()
    alert(result.message || JSON.stringify(result))
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
  }

  if (!data) {
    return <div className="p-6 text-center text-gray-500">Compte courant introuvable.</div>
  }

  let runningBalance = 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/comptes-courants')} className="inline-flex items-center px-3 py-2 border rounded-md text-sm hover:bg-gray-50">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </button>
        <div>
          <h1 className="text-2xl font-bold">{data.nom}</h1>
          <p className="text-sm text-gray-500">{data.code}{data.ncc ? ` · NCC: ${data.ncc}` : ''}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-6 bg-white">
          <p className="text-sm font-medium text-gray-500 mb-2">Solde net</p>
          <p className={`text-3xl font-bold ${data.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(Math.abs(data.solde))}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {data.solde >= 0 ? `${data.nom} vous doit` : `Vous devez à ${data.nom}`}
          </p>
        </div>

        <div className="border rounded-lg p-6 bg-white">
          <p className="text-sm font-medium text-gray-500 mb-2">Client lié</p>
          {data.client ? (
            <div>
              <p className="font-medium">{data.client.nom}</p>
              <p className="text-xs text-gray-500">{data.client.code} · {data.client.telephone}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucun</p>
          )}
        </div>

        <div className="border rounded-lg p-6 bg-white">
          <p className="text-sm font-medium text-gray-500 mb-2">Fournisseur lié</p>
          {data.fournisseur ? (
            <div>
              <p className="font-medium">{data.fournisseur.nom}</p>
              <p className="text-xs text-gray-500">{data.fournisseur.code} · {data.fournisseur.telephone}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucun</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleCompenser} disabled={Math.abs(data.solde) < 1}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          <Scale className="mr-2 h-4 w-4" />
          Compenser (écriture comptable)
        </button>
        <button onClick={() => window.print()}
          className="inline-flex items-center px-4 py-2 border rounded-md text-sm hover:bg-gray-50">
          <Printer className="mr-2 h-4 w-4" />
          Imprimer
        </button>
        <button onClick={() => {
          const csv = [
            ['Date', 'Libellé', 'Montant', 'Débit (il doit)', 'Crédit (on doit)', 'Solde'].join(','),
            ...data.transactions.map(t => [
              new Date(t.date).toLocaleDateString('fr-FR'),
              `"${t.libelle}"`,
              t.montant,
              t.montantSigne > 0 ? t.montant : '',
              t.montantSigne < 0 ? t.montant : '',
              ''
            ].join(','))
          ].join('\n')
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `CompteCourant_${data.nom}_${new Date().toISOString().slice(0, 10)}.csv`
          a.click()
          URL.revokeObjectURL(url)
        }}
          className="inline-flex items-center px-4 py-2 border rounded-md text-sm hover:bg-gray-50">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exporter CSV
        </button>
      </div>

      <div className="border rounded-lg bg-white">
        <div className="p-4 border-b">
          <h3 className="text-sm font-medium">Historique des transactions</h3>
        </div>
        <div className="p-4">
          {data.transactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucune transaction.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Libellé</th>
                    <th className="text-right py-2 px-2">Montant</th>
                    <th className="text-right py-2 px-2">Débit (il doit)</th>
                    <th className="text-right py-2 px-2">Crédit (on doit)</th>
                    <th className="text-right py-2 px-2">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map(t => {
                    runningBalance += t.montantSigne
                    return (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 whitespace-nowrap">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                        <td className="py-2 px-2">{t.libelle}</td>
                        <td className="py-2 px-2 text-right">{fmt(t.montant)}</td>
                        <td className="py-2 px-2 text-right text-green-600">
                          {t.montantSigne > 0 ? fmt(t.montant) : '-'}
                        </td>
                        <td className="py-2 px-2 text-right text-red-600">
                          {t.montantSigne < 0 ? fmt(t.montant) : '-'}
                        </td>
                        <td className={`py-2 px-2 text-right font-medium ${runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmt(Math.abs(runningBalance))}
                          <span className="text-xs ml-1">{runningBalance >= 0 ? 'C' : 'D'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

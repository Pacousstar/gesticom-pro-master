'use client'

import { useState, useEffect } from 'react'
import { X, Bell, Mail, MessageSquare, Download, Loader2, Send, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

interface RelanceModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: number
  tierNom: string
}

export default function RelanceModal({ isOpen, onClose, clientId, tierNom }: RelanceModalProps) {
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [data, setData] = useState<any>(null)
  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    if (isOpen && clientId) {
      setLoading(true)
      fetch(`/api/clients/${clientId}/relance`)
        .then(r => r.ok ? r.json() : null)
        .then(res => {
          if (res) setData(res)
          else showError('Impossible de charger les données de relance.')
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, clientId])

  if (!isOpen) return null

  const handleSendAutoEmail = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/relance`, { method: 'POST' })
      const resData = await res.json()
      if (res.ok) {
        showSuccess('Relance automatique envoyée avec succès.')
      } else {
        showError(resData.error || 'Erreur lors de l\'envoi.')
      }
    } catch (e) {
      showError('Erreur de connexion au serveur.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-300 rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Header Premium */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-all">
            <X className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
              <Bell className="h-8 w-8 text-white animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter italic">Relance Client</h2>
              <p className="text-white/80 font-bold text-sm">{tierNom}</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <p className="text-gray-500 font-medium italic animate-pulse">Analyse des créances en cours...</p>
            </div>
          ) : data ? (
            <>
              {/* Résumé de la Dette */}
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 shadow-inner">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Solde Actuel</span>
                  <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">Dû</span>
                </div>
                <p className="text-4xl font-black text-gray-900 tabular-nums tracking-tighter italic">
                  {data.solde.toLocaleString()} <span className="text-lg">F</span>
                </p>
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between text-xs font-bold">
                  <span className="text-gray-500">{data.factures.length} Factures Impayées</span>
                  <button 
                    onClick={() => window.open(`/api/clients/${clientId}/relance/pdf`, '_blank')}
                    className="text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" /> Télécharger Relevé
                  </button>
                </div>
              </div>

              {/* Options de Relance */}
              <div className="grid grid-cols-2 gap-4">
                {/* WhatsApp */}
                <button
                  disabled={!data.whatsappUrl}
                  onClick={() => window.open(data.whatsappUrl, '_blank')}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-emerald-50 bg-emerald-50/30 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 transition-all group disabled:opacity-50 disabled:grayscale"
                >
                  <div className="bg-emerald-500 text-white p-3 rounded-xl group-hover:scale-110 transition-transform shadow-lg">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-center">Relancer par WhatsApp</span>
                </button>

                {/* Gmail Personal */}
                <button
                  disabled={!data.gmailUrl}
                  onClick={() => window.open(data.gmailUrl, '_blank')}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-red-50 bg-red-50/30 text-red-700 hover:border-red-500 hover:bg-red-50 transition-all group disabled:opacity-50 disabled:grayscale"
                >
                  <div className="bg-red-500 text-white p-3 rounded-xl group-hover:scale-110 transition-transform shadow-lg">
                    <Mail className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-center">Ouvrir dans Gmail</span>
                </button>
              </div>

              {/* Automatic Email (SMTP) */}
              <button
                disabled={sending || !data.email}
                onClick={handleSendAutoEmail}
                className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xl disabled:opacity-50 group font-black uppercase tracking-widest text-sm"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    Envoi Automatique (SMTP)
                  </>
                )}
              </button>

              {!data.email && (
                <p className="text-[10px] text-red-500 text-center font-bold uppercase italic mt-2">
                  ⚠️ Email non configuré pour ce client
                </p>
              )}
            </>
          ) : (
             <div className="text-center py-8 text-gray-500 italic">Erreur lors de la récupération des données.</div>
          )}
        </div>

        {/* Footer Info */}
        <div className="bg-gray-50 p-4 border-t text-center">
           <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest flex items-center justify-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              GentiCom Pro Intelligent Recovery System
           </p>
        </div>
      </div>
    </div>
  )
}

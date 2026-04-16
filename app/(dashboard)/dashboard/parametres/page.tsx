'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, Loader2, Store, Plus, Trash2, Camera, Mail, Info, Clock, Shield, Globe, MapPin, Phone, CreditCard, User, Upload, Download, RotateCcw, X, Printer, Edit2, Building2, Zap, Database, ImagePlus } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Image from 'next/image'
import Link from 'next/link'

type Magasin = {
  id: number
  code: string
  nom: string
  localisation: string
  actif: boolean
  creeLe: string
  misAjourLe: string
}

type Backup = {
  name: string
  size: number
  mtime: string
}

export default function ParametresPage() {
  const { success, error: showError } = useToast()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [err, setErr] = useState('')

  const [form, setForm] = useState({
    nomEntreprise: '',
    slogan: '',
    contact: '',
    email: '',
    siteWeb: '',
    localisation: '',
    numNCC: '',
    registreCommerce: '',
    devise: 'FCFA',
    tvaParDefaut: '0',
    typeCommerce: 'GENERAL',
    logo: '',
    piedDePage: '',
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    backupAuto: false,
    backupFrequence: 'QUOTIDIEN',
    backupDestination: 'LOCAL',
    backupEmailDest: '',
    fideliteActive: false,
    fideliteSeuilPoints: '100',
    fideliteTauxRemise: '5',
    mentionSpeciale: '',
  })

  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [magasinsLoading, setMagasinsLoading] = useState(true)
  const [magasinsErr, setMagasinsErr] = useState('')
  const [magasinSaving, setMagasinSaving] = useState(false)
  const [magasinForm, setMagasinForm] = useState({ code: '', nom: '', localisation: '' })
  const [magasinEdit, setMagasinEdit] = useState<number | null>(null)
  const [magasinEditForm, setMagasinEditForm] = useState({ code: '', nom: '', localisation: '', actif: true })

  const [backups, setBackups] = useState<Backup[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [sauvegardeErr, setSauvegardeErr] = useState('')
  const [restoreLoading, setRestoreLoading] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [manualBackupLoading, setManualBackupLoading] = useState(false)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)

  useEffect(() => {
    fetchData()
    fetchMagasins()
    fetchBackups()
  }, [])

  const fetchData = async () => {
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/parametres'),
        fetch('/api/auth/check')
      ])
      const p = await pRes.json()
      const a = await aRes.json()
      
      setUserRole(a.role)
      setUserPermissions(a.permissions || [])
      setData(p)
      if (p) {
        setForm({
          nomEntreprise: p.nomEntreprise ?? '',
          slogan: p.slogan ?? '',
          contact: p.contact ?? '',
          email: p.email ?? '',
          siteWeb: p.siteWeb ?? '',
          localisation: p.localisation ?? '',
          numNCC: p.numNCC ?? '',
          registreCommerce: p.registreCommerce ?? '',
          devise: p.devise ?? 'FCFA',
          tvaParDefaut: String(p.tvaParDefaut ?? 0),
          typeCommerce: p.typeCommerce ?? 'GENERAL',
          logo: p.logo ?? '',
          piedDePage: p.piedDePage ?? '',
          smtpHost: p.smtpHost ?? '',
          smtpPort: p.smtpPort !== null ? String(p.smtpPort) : '',
          smtpUser: p.smtpUser ?? '',
          smtpPass: p.smtpPass ?? '',
          backupAuto: p.backupAuto ?? false,
          backupFrequence: p.backupFrequence ?? 'QUOTIDIEN',
          backupDestination: p.backupDestination ?? 'LOCAL',
          backupEmailDest: p.backupEmailDest ?? '',
          fideliteActive: p.fideliteActive ?? false,
          fideliteSeuilPoints: String(p.fideliteSeuilPoints ?? 100),
          fideliteTauxRemise: String(p.fideliteTauxRemise ?? 5),
          mentionSpeciale: p.mentionSpeciale ?? '',
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchMagasins = async () => {
    setMagasinsLoading(true)
    try {
      const res = await fetch('/api/magasins')
      if (res.ok) setMagasins(await res.json())
    } catch (e) {
      setMagasinsErr('Erreur lors du chargement des magasins.')
    } finally {
      setMagasinsLoading(false)
    }
  }

  const fetchBackups = async () => {
    setBackupsLoading(true)
    try {
      const res = await fetch('/api/sauvegarde')
      if (res.ok) setBackups(await res.json())
    } catch (e) {
      setSauvegardeErr('Erreur lors du chargement des sauvegardes.')
    } finally {
      setBackupsLoading(false)
    }
  }

  const handleMaintenance = async () => {
    if (!confirm('Lancer la procédure de fiabilisation des données ?\n\nCette opération va :\n1. Supprimer les écritures comptables en double\n2. Nettoyer les doublons de caisse\n3. Synchroniser les montants payés des factures\n4. Générer les écritures manquantes de manière sécurisée.')) return
    
    setMaintenanceLoading(true)
    try {
      const res = await fetch('/api/maintenance/fiabilisation', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        let msg = 'Maintenance terminée avec succès.'
        if (d.results) {
          msg += `\n- Doublons comptables : ${d.results.doublonsComptablesSupprimes}\n- Doublons caisse : ${d.results.doublonsCaisseSupprimes}\n- Ventes synchronisées : ${d.results.ventesSynchronisees}\n- Écritures générées : ${d.results.ecrituresGenerees}`
        }
        alert(msg)
        fetchData()
      } else {
        showError(d.error || 'Erreur lors de la maintenance.')
      }
    } catch (e) {
      showError('Erreur réseau lors de la maintenance.')
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const handleManualBackup = async () => {
    setManualBackupLoading(true)
    try {
      const res = await fetch('/api/sauvegarde/manuelle', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        success(d.message || `Sauvegarde effectuée avec succès dans : ${d.name}`)
        fetchBackups()
      } else {
        showError(d.error || 'Erreur lors de la sauvegarde.')
      }
    } catch (e) {
      showError('Erreur réseau lors de la sauvegarde.')
    } finally {
      setManualBackupLoading(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showError("Logo trop lourd (max 2 Mo)")
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setForm({ ...form, logo: event.target?.result as string })
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setSaving(true)
    try {
      const res = await fetch('/api/parametres', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tvaParDefaut: Number(form.tvaParDefaut),
          smtpPort: form.smtpPort ? Number(form.smtpPort) : null,
          fideliteSeuilPoints: Number(form.fideliteSeuilPoints),
          fideliteTauxRemise: Number(form.fideliteTauxRemise),
        }),
      })
      if (res.ok) {
        success('Paramètres enregistrés.')
        fetchData()
      } else {
        const d = await res.json()
        setErr(d.error || 'Erreur')
      }
    } catch (e) {
      setErr('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const handleMagasinAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setMagasinsErr('')
    if (!magasinForm.code || !magasinForm.nom) return
    setMagasinSaving(true)
    try {
      const res = await fetch('/api/magasins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(magasinForm),
      })
      if (res.ok) {
        setMagasinForm({ code: '', nom: '', localisation: '' })
        fetchMagasins()
      } else {
        const d = await res.json()
        setMagasinsErr(d.error || 'Erreur')
      }
    } catch (e) {
      setMagasinsErr('Erreur réseau')
    } finally {
      setMagasinSaving(false)
    }
  }

  const handleMagasinEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!magasinEdit) return
    setMagasinSaving(true)
    try {
      const res = await fetch(`/api/magasins/${magasinEdit}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(magasinEditForm),
      })
      if (res.ok) {
        success('Magasin modifié avec succès.')
        setMagasinEdit(null)
        fetchMagasins()
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de la modification')
      }
    } finally {
      setMagasinSaving(false)
    }
  }

  const handleMagasinDelete = async (id: number, nom: string) => {
    if (!confirm(`Souhaitez-vous vraiment désactiver le magasin "${nom}" ?\nIl ne pourra plus être utilisé pour de nouvelles ventes.`)) return
    setMagasinSaving(true)
    try {
      const res = await fetch(`/api/magasins/${id}`, { method: 'DELETE' })
      if (res.ok) {
        success('Magasin désactivé.')
        fetchMagasins()
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de la suppression')
      }
    } finally {
      setMagasinSaving(false)
    }
  }

  const handleRestore = async (name: string) => {
    if (!confirm('Restaurer cette sauvegarde ? Les données actuelles seront remplacées.')) return
    setRestoreLoading(name)
    try {
      const res = await fetch(`/api/sauvegarde/restore?name=${encodeURIComponent(name)}`, { method: 'POST' })
      if (res.ok) {
        alert('Restauration réussie ! Rechargement de la page...')
        window.location.reload()
      }
    } finally {
      setRestoreLoading(null)
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm('Supprimer cette sauvegarde ?')) return
    setDeleteLoading(name)
    try {
      const res = await fetch(`/api/sauvegarde/delete?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (res.ok) fetchBackups()
    } finally {
      setDeleteLoading(null)
    }
  }

  if (loading) return (
    <div className="flex flex-col h-64 items-center justify-center text-slate-900 gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Initialisation du centre de configuration...</p>
    </div>
  )

  const role = userRole?.toUpperCase() || ''
  const canAccess = role === 'SUPER_ADMIN' || role === 'ADMIN' || userPermissions.includes('parametres:view')

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xl">
        <Shield className="mx-auto h-16 w-16 text-orange-600 animate-pulse" />
        <h2 className="mt-6 text-2xl font-black text-slate-900 uppercase tracking-tighter">Accès restreint</h2>
        <p className="mt-2 text-sm text-slate-500 font-medium italic">Cette section est réservée à la direction générale et aux administrateurs système.</p>
        <div className="mt-8">
            <Link href="/dashboard" className="px-6 py-2 rounded-xl bg-orange-600 text-white font-black text-xs uppercase hover:bg-orange-700 transition-all">Retour au Tableau de Bord</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic drop-shadow-md">Paramètres Système</h1>
          <p className="mt-1 text-white/90 font-bold uppercase text-[10px] tracking-widest opacity-90 drop-shadow-sm">Configuration structurelle et identité de l'entreprise</p>
        </div>
        <Link href="/dashboard/parametres/impression" className="flex items-center gap-2 rounded-xl bg-orange-50 border-2 border-orange-200 px-5 py-2.5 text-xs font-black text-orange-700 hover:bg-orange-100 transition-all uppercase tracking-tighter">
          <Printer className="h-4 w-4" /> Modèles d'Impression
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* IDENTITE */}
        <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 shadow-xl">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3 mb-8 italic">
            <div className="p-2 bg-white rounded-xl text-orange-600 shadow-sm border border-slate-100"><Building2 className="h-6 w-6" /></div>
            Identité de l'Entreprise
          </h2>
          <div className="grid gap-8 md:grid-cols-2 text-left">
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-2 ml-1">Nom commercial</label>
                <input
                  type="text"
                  value={form.nomEntreprise}
                  onChange={(e) => setForm({ ...form, nomEntreprise: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  placeholder="Nom de votre structure..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-2 ml-1">Slogan / Devise</label>
                <input
                  type="text"
                  value={form.slogan || ''}
                  onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all placeholder:text-slate-400 shadow-sm"
                  placeholder="Votre slogan..."
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-2 ml-1">Logo officiel (En-tête)</label>
                <div className="flex flex-col gap-4">
                  <div className="relative group overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 transition-all hover:border-indigo-500/50 hover:bg-indigo-50/10">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="absolute inset-0 z-10 cursor-pointer opacity-0"
                    />
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400 group-hover:text-indigo-600">
                      <ImagePlus className="h-10 w-10" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-center">
                        {form.logo ? 'Remplacer le logo' : 'Charger un logo'}
                      </span>
                    </div>
                  </div>
                  
                  {form.logo && (
                    <div className="relative group mx-auto">
                      <div className="p-4 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center overflow-hidden min-h-[120px] w-48 shadow-lg">
                        <img src={form.logo} alt="Logo preview" className="max-h-24 w-full object-contain" />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setForm({ ...form, logo: '' })}
                        className="absolute -top-3 -right-3 p-2 rounded-full bg-rose-600 text-white shadow-xl hover:scale-110 transition-transform"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-2 pt-10 border-t-2 border-slate-200 text-left">
            <div className="space-y-5">
              <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Coordonnées de l'entreprise</h3>
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-2 ml-1">Contact Téléphonique</label>
                <input
                  type="text"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-2 ml-1">Adresse Email</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-2 ml-1">Siége Social / Ville</label>
                <input
                  type="text"
                  value={form.localisation || ''}
                  onChange={(e) => setForm({ ...form, localisation: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Fiscalité & Registres</h3>
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-2 ml-1">N° NCC (IFU)</label>
                <input
                  type="text"
                  value={form.numNCC || ''}
                  onChange={(e) => setForm({ ...form, numNCC: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-2 ml-1">Registre de Commerce (RC)</label>
                <input
                  type="text"
                  value={form.registreCommerce || ''}
                  onChange={(e) => setForm({ ...form, registreCommerce: e.target.value })}
                  className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                />
              </div>
              <div className="pt-2">
                 <div className="rounded-2xl bg-indigo-50 border-2 border-indigo-100 p-5">
                    <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-2">Devise Système</label>
                    <span className="text-2xl font-black text-indigo-900 uppercase italic tracking-tighter shadow-sm">{form.devise}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* FIDELITE */}
        <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 shadow-xl">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3 mb-8 italic">
            <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm border border-slate-100"><Zap className="h-6 w-6" /></div>
            Programme de Fidélité Clients
          </h2>
          <div className="rounded-2xl border-2 border-indigo-100 bg-white p-8 shadow-sm">
            <label className="flex items-center gap-5 font-black text-indigo-900 uppercase text-xs tracking-[0.1em] cursor-pointer group">
              <input 
                type="checkbox" 
                checked={form.fideliteActive} 
                onChange={(e) => setForm({ ...form, fideliteActive: e.target.checked })} 
                className="h-8 w-8 rounded-xl border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer shadow-sm" 
              />
              <span className="group-hover:translate-x-1 transition-transform">Activer le cumul de points GestiCom</span>
            </label>
            {form.fideliteActive && (
              <div className="mt-10 grid gap-8 sm:grid-cols-2 animate-in fade-in slide-in-from-top-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-widest ml-1">Seuil de points (Déclencheur)</label>
                  <input 
                    type="number" 
                    value={form.fideliteSeuilPoints} 
                    onChange={(e) => setForm({ ...form, fideliteSeuilPoints: e.target.value })} 
                    className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-lg font-black text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-widest ml-1">Taux de remise accordé (%)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.1" 
                      value={form.fideliteTauxRemise} 
                      onChange={(e) => setForm({ ...form, fideliteTauxRemise: e.target.value })} 
                      className="w-full rounded-2xl border-2 border-slate-300 bg-white px-5 py-4 text-lg font-black text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm" 
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xl font-black text-indigo-300">%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DOCUMENTS */}
        <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 shadow-xl">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3 mb-8 italic">
            <div className="p-2 bg-white rounded-xl text-rose-600 shadow-sm border border-slate-100"><Printer className="h-6 w-6" /></div>
            Documents & Mentions Légales
          </h2>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2 ml-1">Mention Spéciale (Bas de Facture / BL / BC)</label>
            <textarea
              value={form.mentionSpeciale}
              onChange={(e) => setForm({ ...form, mentionSpeciale: e.target.value })}
              rows={4}
              placeholder="Ex. Les marchandises vendues ne sont ni reprises ni échangées après sortie..."
              className="w-full rounded-2xl border-2 border-slate-300 bg-white px-6 py-5 text-sm font-bold text-slate-900 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all shadow-sm"
            />
            <p className="mt-3 text-[10px] text-slate-500 italic font-medium px-1 flex items-center gap-2">
               <Info className="h-3 w-3" /> Cette mention apparaîtra en petits caractères en bas de tous vos documents imprimables.
            </p>
          </div>
        </div>

        {/* SAUVEGARDE PC CLIENT */}
        <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 shadow-xl">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3 mb-8 italic">
            <div className="p-2 bg-white rounded-xl text-orange-600 shadow-sm border border-slate-100"><Database className="h-6 w-6" /></div>
            Sûreté des Données (Sauvegardes)
          </h2>
          
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-center gap-6 p-6 rounded-2xl bg-white border-2 border-slate-200 shadow-sm">
                <div className="flex-1">
                   <h3 className="font-black text-slate-900 uppercase text-sm tracking-tight mb-1">Sauvegarde Manuelle Immédiate</h3>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider opacity-80 leading-relaxed italic">
                      Stockage prioritaire sur ce PC (Dossier GestiCom Pro).<br/>Recommandé avant toute mise à jour ou opération critique.
                   </p>
                </div>
                <button
                  type="button"
                  onClick={handleManualBackup}
                  disabled={manualBackupLoading}
                  className="flex items-center gap-3 rounded-2xl bg-orange-600 px-8 py-4 font-black text-white hover:bg-orange-700 shadow-xl shadow-orange-600/20 transition-all active:scale-95 disabled:opacity-50 uppercase text-[11px] tracking-widest whitespace-nowrap"
                >
                  {manualBackupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  💾 Sauvegarder sur ce PC maintenant
                </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 pt-4 border-t-2 border-slate-200">
              <label className="flex items-center gap-4 font-black text-slate-800 uppercase text-[11px] tracking-widest cursor-pointer bg-white p-5 rounded-2xl border-2 border-slate-200 hover:border-orange-200 transition-all shadow-sm">
                <input 
                  type="checkbox" 
                  checked={form.backupAuto} 
                  onChange={(e) => setForm({ ...form, backupAuto: e.target.checked })} 
                  className="h-6 w-6 rounded-lg border-slate-300 bg-white text-orange-600 focus:ring-orange-500 transition-all cursor-pointer shadow-sm" 
                />
                Automatiser les rapports système
              </label>
              
              {form.backupAuto && (
                <div className="flex gap-4 animate-in fade-in slide-in-from-right-4">
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-slate-900 uppercase tracking-widest mb-2 px-1">Périodicité</label>
                    <select 
                      value={form.backupFrequence} 
                      onChange={(e) => setForm({ ...form, backupFrequence: e.target.value })} 
                      className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-[10px] font-black text-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                    >
                      <option value="QUOTIDIEN">Quotidienne</option>
                      <option value="HEBDOMADAIRE">Hebdomadaire</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-slate-900 uppercase tracking-widest mb-2 px-1">Destination</label>
                    <select 
                      value={form.backupDestination} 
                      onChange={(e) => setForm({ ...form, backupDestination: e.target.value })} 
                      className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-[10px] font-black text-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                    >
                      <option value="LOCAL">Stockage PC Local</option>
                      <option value="EMAIL">Cloud / Email</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MAINTENANCE (SELF-HEALING) */}
        <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 shadow-xl">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3 mb-8 italic">
            <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm border border-slate-100"><Zap className="h-6 w-6" /></div>
            Maintenance & Fiabilisation
          </h2>
          
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white border-2 border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1">
                   <h3 className="font-black text-slate-900 uppercase text-sm tracking-tight mb-1 italic">Audit & Réparation Automatique</h3>
                   <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider opacity-90 leading-relaxed italic">
                      Corrige les doublons d'écritures et de caisse détectés en production.<br/>
                      Recalcule les soldes des factures basés sur les règlements réels.
                   </p>
                </div>
                <button
                  type="button"
                  onClick={handleMaintenance}
                  disabled={maintenanceLoading}
                  className="flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 font-black text-white hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 uppercase text-[11px] tracking-widest whitespace-nowrap"
                >
                  {maintenanceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Lancer la Fiabilisation
                </button>
            </div>
            <div className="px-2">
               <p className="text-[9px] text-indigo-400 font-black uppercase tracking-[0.2em] italic">
                  Note : Cette procédure est 100% sécurisée et peut être lancée sans risque de perte de données.
               </p>
            </div>
          </div>
        </div>

        {err && <div className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-100 text-rose-600 text-xs font-black uppercase tracking-widest text-center shadow-md">{err}</div>}
        
        <div className="flex justify-end pt-10">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-6 rounded-3xl bg-slate-900 px-16 py-6 font-black text-white hover:bg-slate-800 shadow-2xl transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 uppercase tracking-[0.3em] text-sm italic group"
          >
            {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6 group-hover:scale-110 transition-transform" />}
            Sceller les configurations
          </button>
        </div>
      </form>

      <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 shadow-xl">
        <h2 className="flex items-center gap-3 text-xl font-black text-slate-900 uppercase tracking-tight mb-8 text-left italic">
            <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm border border-slate-100"><Store className="h-6 w-6" /></div>
            Gestion des Magasins & Entrepôts
        </h2>
        
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 px-1 italic">Ajouter un nouveau point de stockage</h3>
            <form onSubmit={handleMagasinAdd} className="flex gap-4">
              <input 
                value={magasinForm.code} 
                onChange={(e) => setMagasinForm({ ...magasinForm, code: e.target.value.toUpperCase() })} 
                placeholder="PRO-01" 
                className="w-32 rounded-xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-black text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none shadow-sm placeholder:text-slate-300" 
              />
              <input 
                value={magasinForm.nom} 
                onChange={(e) => setMagasinForm({ ...magasinForm, nom: e.target.value })} 
                placeholder="Désignation (ex: Dépôt Principal Abidjan)..." 
                className="flex-1 rounded-xl border-2 border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none shadow-sm" 
              />
              <button 
                type="submit" 
                disabled={magasinSaving} 
                className="rounded-xl bg-blue-600 px-10 py-4 font-black text-white hover:bg-blue-700 transition-all uppercase text-[11px] tracking-widest disabled:opacity-50 shadow-xl shadow-blue-500/20"
              >
                {magasinSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enregistrer'}
              </button>
            </form>
        </div>

        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 shadow-sm bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] border-b-2 border-slate-200 bg-slate-100/50">
                <th className="px-8 py-5">Code ID</th>
                <th className="px-8 py-5">Désignation Magasin</th>
                <th className="px-8 py-5">Statut Opérationnel</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
              {magasins.map(m => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                  {magasinEdit === m.id ? (
                    <>
                      <td className="px-8 py-6">
                        <input 
                          value={magasinEditForm.code} 
                          onChange={(e) => setMagasinEditForm({ ...magasinEditForm, code: e.target.value.toUpperCase() })} 
                          className="w-24 rounded-lg border-2 border-orange-500 bg-white px-3 py-2 text-sm font-black text-slate-900 outline-none shadow-md"
                        />
                      </td>
                      <td className="px-8 py-6">
                        <input 
                          value={magasinEditForm.nom} 
                          onChange={(e) => setMagasinEditForm({ ...magasinEditForm, nom: e.target.value })} 
                          className="w-full rounded-lg border-2 border-orange-500 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none shadow-md"
                        />
                      </td>
                      <td className="px-8 py-6">
                        <select 
                          value={String(magasinEditForm.actif)} 
                          onChange={(e) => setMagasinEditForm({ ...magasinEditForm, actif: e.target.value === 'true' })}
                          className="rounded-lg border-2 border-orange-500 bg-white px-3 py-2 text-[10px] font-black text-slate-900 outline-none shadow-md"
                        >
                          <option value="true">EN SERVICE</option>
                          <option value="false">HORS SERVICE</option>
                        </select>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-3">
                          <button onClick={handleMagasinEditSave} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700">Valider</button>
                          <button onClick={() => setMagasinEdit(null)} className="px-4 py-2 rounded-lg border-2 border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50">Annuler</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-8 py-6 font-mono font-black text-blue-600">{m.code}</td>
                      <td className="px-8 py-6 font-bold text-slate-900 uppercase text-xs tracking-tight">{m.nom}</td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] ${m.actif ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                          {m.actif ? 'Opérationnel' : 'Désactivé'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-6">
                          <button 
                              onClick={() => { setMagasinEdit(m.id); setMagasinEditForm({ code: m.code, nom: m.nom, localisation: m.localisation, actif: m.actif }); }} 
                              className="text-slate-400 hover:text-indigo-600 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all"
                          >
                            <Edit2 className="h-3.5 w-3.5" /> Modifier
                          </button>
                          <button 
                              onClick={() => handleMagasinDelete(m.id, m.nom)} 
                              className="text-slate-300 hover:text-rose-600 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {magasins.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-600 font-medium italic">Aucun magasin configuré pour le moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

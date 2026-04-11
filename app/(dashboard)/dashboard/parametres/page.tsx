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
    <div className="flex flex-col h-64 items-center justify-center text-white gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Initialisation de la navigation sécurisée...</p>
    </div>
  )

  const role = userRole?.toUpperCase() || ''
  const canAccess = role === 'SUPER_ADMIN' || role === 'ADMIN' || userPermissions.includes('parametres:view')

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-12 text-center backdrop-blur-xl shadow-2xl">
        <Shield className="mx-auto h-16 w-16 text-orange-500 animate-pulse" />
        <h2 className="mt-6 text-2xl font-black text-white uppercase tracking-tighter">Accès restreint</h2>
        <p className="mt-2 text-sm text-gray-400 font-medium italic">Cette section est réservée à la direction générale et aux administrateurs système.</p>
        <div className="mt-8">
            <Link href="/dashboard" className="px-6 py-2 rounded-xl bg-orange-500 text-white font-black text-xs uppercase hover:bg-orange-600 transition-all">Retour au Tableau de Bord</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter drop-shadow-md">Paramètres du Système</h1>
          <p className="mt-2 text-white/70 font-medium italic">Personnalisez l'identité de votre entreprise, configurez vos emails et gérez les sauvegardes.</p>
        </div>
        <Link href="/dashboard/parametres/impression" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50">
          <Printer className="h-4 w-4" /> Modèles d'Impression
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-gray-900/40 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3 mb-8">
            <div className="p-2 bg-orange-500/20 rounded-lg"><Building2 className="h-5 w-5 text-orange-500" /></div>
            Identité de l'Entreprise
          </h2>
          <div className="grid gap-6 md:grid-cols-2 text-left">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-1.5 ml-1">Nom commercial</label>
                <input
                  type="text"
                  value={form.nomEntreprise}
                  onChange={(e) => setForm({ ...form, nomEntreprise: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white focus:border-orange-500 outline-none transition-all placeholder:text-white/20"
                  placeholder="Nom de votre structure..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-1.5 ml-1">Slogan / Devise</label>
                <input
                  type="text"
                  value={form.slogan || ''}
                  onChange={(e) => setForm({ ...form, slogan: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white focus:border-orange-500 outline-none transition-all placeholder:text-white/20"
                  placeholder="Votre slogan..."
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1.5 ml-1">Logo de l'entreprise</label>
                <div className="flex flex-col gap-4">
                  <div className="relative group overflow-hidden rounded-xl border-2 border-dashed border-white/20 bg-gray-900/50 p-4 transition-all hover:border-indigo-500/50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="absolute inset-0 z-10 cursor-pointer opacity-0"
                    />
                    <div className="flex flex-col items-center justify-center gap-2 text-white/40 group-hover:text-indigo-400">
                      <ImagePlus className="h-8 w-8" />
                      <span className="text-xs font-black uppercase tracking-widest text-center">
                        {form.logo ? 'Changer le logo' : 'Charger un logo'}
                      </span>
                      <span className="text-[10px] italic">PNG, JPG ou SVG (Max 2Mo)</span>
                    </div>
                  </div>
                  
                  {form.logo && (
                    <div className="relative group">
                      <div className="p-4 rounded-xl bg-white flex items-center justify-center overflow-hidden min-h-[100px] w-full ring-4 ring-indigo-500/20">
                        <img src={form.logo} alt="Logo preview" className="max-h-32 w-full object-contain" />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setForm({ ...form, logo: '' })}
                        className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2 pt-8 border-t border-white/5 text-left">
            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Coordonnées & Contact</h3>
              <div>
                <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1.5 ml-1">Contact Téléphonique</label>
                <input
                  type="text"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1.5 ml-1">Adresse Email</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1.5 ml-1">Localisation Physique (Siège)</label>
                <input
                  type="text"
                  value={form.localisation || ''}
                  onChange={(e) => setForm({ ...form, localisation: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Identifiants Légaux</h3>
              <div>
                <label className="block text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-1.5 ml-1">N° NCC (Compte Contribuable)</label>
                <input
                  type="text"
                  value={form.numNCC || ''}
                  onChange={(e) => setForm({ ...form, numNCC: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white focus:border-orange-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-1.5 ml-1">Registre de Commerce (RC)</label>
                <input
                  type="text"
                  value={form.registreCommerce || ''}
                  onChange={(e) => setForm({ ...form, registreCommerce: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white focus:border-orange-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-900/40 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/20 rounded-lg"><Zap className="h-5 w-5 text-purple-400" /></div>
            Fidélisation Client (PRO)
          </h2>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6 backdrop-blur-md">
            <label className="flex items-center gap-4 font-black text-white uppercase text-xs tracking-widest cursor-pointer group">
              <input 
                type="checkbox" 
                checked={form.fideliteActive} 
                onChange={(e) => setForm({ ...form, fideliteActive: e.target.checked })} 
                className="h-6 w-6 rounded-lg border-white/20 bg-gray-900 text-purple-600 focus:ring-purple-500 transition-all cursor-pointer" 
              />
              Activer le programme de fidélité GestiCom
            </label>
            {form.fideliteActive && (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1.5 ml-1">Seuil de points (pour déclencher remise)</label>
                  <input 
                    type="number" 
                    value={form.fideliteSeuilPoints} 
                    onChange={(e) => setForm({ ...form, fideliteSeuilPoints: e.target.value })} 
                    className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-white focus:border-purple-500 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1.5 ml-1">Taux de remise (%)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={form.fideliteTauxRemise} 
                    onChange={(e) => setForm({ ...form, fideliteTauxRemise: e.target.value })} 
                    className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-white focus:border-purple-500 outline-none transition-all" 
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-900/40 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3 mb-6">
            <div className="p-2 bg-pink-500/20 rounded-lg"><Printer className="h-5 w-5 text-pink-400" /></div>
            Documents & Impressions
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1.5 ml-1">Mention Spéciale (Bas de Facture)</label>
              <textarea
                value={form.mentionSpeciale}
                onChange={(e) => setForm({ ...form, mentionSpeciale: e.target.value })}
                rows={3}
                placeholder="Ex. Les produits sortis du magasin ne seront plus repris..."
                className="w-full rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white focus:border-pink-500 outline-none transition-all ml-0"
              />
              <p className="mt-2 text-[10px] text-white/40 italic">Cette mention apparaîtra en bas de toutes vos factures clients et bordereaux.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-900/40 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-500/20 rounded-lg"><Database className="h-5 w-5 text-orange-400" /></div>
            Sauvegardes & Sûreté
          </h2>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-6">
            <label className="flex items-center gap-4 font-black text-white uppercase text-xs tracking-widest cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.backupAuto} 
                onChange={(e) => setForm({ ...form, backupAuto: e.target.checked })} 
                className="h-6 w-6 rounded-lg border-white/20 bg-gray-900 text-orange-600 focus:ring-orange-500 transition-all cursor-pointer" 
              />
              Automatiser les sauvegardes système
            </label>
            {form.backupAuto && (
               <div className="mt-8 grid gap-6 sm:grid-cols-2 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1.5 ml-1">Fréquence de sauvegarde</label>
                    <select 
                      value={form.backupFrequence} 
                      onChange={(e) => setForm({ ...form, backupFrequence: e.target.value })} 
                      className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-white font-bold focus:border-orange-500 outline-none transition-all"
                    >
                      <option value="QUOTIDIEN">Quotidienne (Chaque jour)</option>
                      <option value="HEBDOMADAIRE">Hebdomadaire (Chaque semaine)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1.5 ml-1">Base de stockage</label>
                    <select 
                      value={form.backupDestination} 
                      onChange={(e) => setForm({ ...form, backupDestination: e.target.value })} 
                      className="w-full rounded-xl border border-white/10 bg-gray-900 px-4 py-3 text-sm text-white font-bold focus:border-orange-500 outline-none transition-all"
                    >
                      <option value="LOCAL">Disque Local (C:\gesticom\backups)</option>
                      <option value="EMAIL">Cloud Externe / Email</option>
                    </select>
                  </div>
               </div>
            )}
          </div>
        </div>

        {err && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-widest text-center">{err}</div>}
        
        <div className="flex justify-end pt-8">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-4 rounded-2xl bg-orange-600 px-12 py-5 font-black text-white hover:bg-orange-500 shadow-[0_15px_40px_rgba(249,115,22,0.4)] transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em] text-sm"
          >
            {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
            Enregistrer les modifications
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-gray-900/40 p-8 shadow-2xl backdrop-blur-xl">
        <h2 className="flex items-center gap-3 text-xl font-black text-white uppercase tracking-tight mb-6 text-left">
            <div className="p-2 bg-blue-500/20 rounded-lg"><Store className="h-5 w-5 text-blue-400" /></div>
            Gestion des Magasins & Entrepôts
        </h2>
        <form onSubmit={handleMagasinAdd} className="flex gap-3 mb-8">
          <input 
            value={magasinForm.code} 
            onChange={(e) => setMagasinForm({ ...magasinForm, code: e.target.value.toUpperCase() })} 
            placeholder="CODE" 
            className="w-24 rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white font-bold focus:border-blue-500 outline-none transition-all" 
          />
          <input 
            value={magasinForm.nom} 
            onChange={(e) => setMagasinForm({ ...magasinForm, nom: e.target.value })} 
            placeholder="Nom du magasin ou dépôt..." 
            className="flex-1 rounded-xl border border-white/10 bg-gray-900/50 px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all" 
          />
          <button 
            type="submit" 
            disabled={magasinSaving} 
            className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white hover:bg-blue-500 transition-all uppercase text-xs tracking-widest disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            {magasinSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ajouter'}
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gray-900/20">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black text-white uppercase tracking-[0.2em] border-b border-white/10 bg-white/5">
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Désignation Magasin</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {magasins.map(m => (
                <tr key={m.id} className="hover:bg-white/5 transition-colors group">
                  {magasinEdit === m.id ? (
                    <>
                      <td className="px-6 py-4">
                        <input 
                          value={magasinEditForm.code} 
                          onChange={(e) => setMagasinEditForm({ ...magasinEditForm, code: e.target.value.toUpperCase() })} 
                          className="w-20 rounded-lg border border-orange-500/30 bg-gray-900 px-2 py-1 text-xs font-black text-white outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          value={magasinEditForm.nom} 
                          onChange={(e) => setMagasinEditForm({ ...magasinEditForm, nom: e.target.value })} 
                          className="w-full rounded-lg border border-orange-500/30 bg-gray-900 px-2 py-1 text-xs font-bold text-white outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={String(magasinEditForm.actif)} 
                          onChange={(e) => setMagasinEditForm({ ...magasinEditForm, actif: e.target.value === 'true' })}
                          className="rounded-lg border border-orange-500/30 bg-gray-900 px-2 py-1 text-[10px] font-black text-white outline-none"
                        >
                          <option value="true">ACTIF</option>
                          <option value="false">INACTIF</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={handleMagasinEditSave} className="text-emerald-400 hover:text-emerald-300 font-black uppercase text-[10px] tracking-widest">Enregistrer</button>
                          <button onClick={() => setMagasinEdit(null)} className="text-white/40 hover:text-white font-black uppercase text-[10px] tracking-widest">Annuler</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 font-mono font-black text-blue-400">{m.code}</td>
                      <td className="px-6 py-4 font-bold text-white uppercase text-xs tracking-tight">{m.nom}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${m.actif ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {m.actif ? 'En Service' : 'Hors Service'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-4">
                          <button 
                              onClick={() => { setMagasinEdit(m.id); setMagasinEditForm({ code: m.code, nom: m.nom, localisation: m.localisation, actif: m.actif }); }} 
                              className="text-white/40 hover:text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 transition-all"
                          >
                            <Edit2 className="h-3 w-3" /> Modifier
                          </button>
                          <button 
                              onClick={() => handleMagasinDelete(m.id, m.nom)} 
                              className="text-red-500/40 hover:text-red-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 transition-all"
                          >
                            <Trash2 className="h-3 w-3" /> Supprimer
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

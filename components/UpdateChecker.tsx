'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Download,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'uptodate'

interface CheckResult {
  hasUpdate: boolean
  currentVersion: string
  remoteVersion?: string
  downloadUrl?: string
  changelog?: string
  releaseDate?: string
  required?: boolean
  error?: string
}

const CHECK_INTERVAL = 6 * 60 * 60 * 1000

export default function UpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const checkUpdate = useCallback(async () => {
    setStatus('checking')
    setErrorMsg('')
    try {
      const res = await fetch('/api/update/check')
      const data: CheckResult = await res.json()
      setResult(data)
      if (data.hasUpdate && data.remoteVersion) {
        setStatus('available')
      } else {
        setStatus('uptodate')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Impossible de vérifier les mises à jour')
    }
  }, [])

  useEffect(() => {
    checkUpdate()
    const interval = setInterval(checkUpdate, CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [checkUpdate])

  const handleDownload = async () => {
    if (!result?.downloadUrl) return
    setStatus('downloading')
    setDownloadProgress(0)

    try {
      const res = await fetch('/api/update/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadUrl: result.downloadUrl }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Échec du téléchargement')
      }

      const data = await res.json()
      setDownloadProgress(100)
      setStatus('downloaded')
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.message || 'Erreur de téléchargement')
    }
  }

  const handleInstall = async () => {
    setStatus('downloading')
    setDownloadProgress(50)
    await new Promise((r) => setTimeout(r, 500))
    setDownloadProgress(100)
    setStatus('downloaded')
    setDismissed(true)
  }

  if (dismissed || status === 'idle' || status === 'uptodate' || status === 'checking') {
    if (status === 'checking') {
      return (
        <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-lg bg-gray-800/80 px-3 py-2 text-xs text-white/60 backdrop-blur-sm">
          <Loader2 className="h-3 w-3 animate-spin" />
          Vérification mises à jour...
        </div>
      )
    }
    return null
  }

  if (status === 'available' && result) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-slide-up">
        <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-2xl ring-1 ring-orange-500/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
              <Download className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">
                Mise à jour disponible
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                v{result.currentVersion} →{' '}
                <span className="font-bold text-orange-600">v{result.remoteVersion}</span>
              </p>
              {result.changelog && (
                <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">
                  {result.changelog}
                </p>
              )}
              {result.required && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  Mise à jour requise
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-orange-600"
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-500 transition-colors hover:bg-gray-100"
                >
                  Plus tard
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-orange-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'downloading') {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-slide-up">
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-4 shadow-2xl ring-1 ring-emerald-500/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">
                Téléchargement...
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                {downloadProgress}%
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'downloaded') {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-slide-up">
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-4 shadow-2xl ring-1 ring-emerald-500/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">
                Téléchargement terminé
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                v{result?.remoteVersion} — prêt à installer
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleInstall}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-600"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Installer
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-gray-500 transition-colors hover:bg-gray-100"
                >
                  Plus tard
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-emerald-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-slide-up">
        <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-4 shadow-2xl ring-1 ring-red-500/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">
                Erreur de mise à jour
              </p>
              <p className="mt-0.5 text-xs text-gray-600">
                {errorMsg || 'Vérification impossible'}
              </p>
              <div className="mt-3">
                <button
                  onClick={checkUpdate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-500 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-gray-600"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Réessayer
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-red-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

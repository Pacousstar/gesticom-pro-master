'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, CheckCircle, AlertCircle } from 'lucide-react'

export default function ContactPage() {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [sujet, setSujet] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, email, sujet, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur inconnue')
      setSuccess(true)
      setNom('')
      setEmail('')
      setSujet('')
      setMessage('')
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-400/50 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-400/50 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/50 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-4000"></div>
      </div>

      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite',
        }}></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl rounded-3xl shadow-2xl flex items-stretch">
        {/* Left: Image */}
        <div className="hidden md:flex bg-gradient-to-br from-orange-600 to-orange-800 rounded-l-3xl overflow-hidden relative flex-shrink-0 items-center justify-center">
          <img
            src="/hero/GestiCom Pro1.png"
            alt="GestiCom Pro"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <h2 className="text-white text-3xl font-bold mb-2">Contactez-nous</h2>
            <p className="text-orange-200 text-sm">Une question ? Un projet ? Nous sommes là pour vous accompagner.</p>
            <div className="mt-4 flex items-center gap-3 text-white/80 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              <span>+225 05 44 81 49 24</span>
            </div>
            <div className="flex items-center gap-3 text-white/80 text-sm mt-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <span>pacous2000@gmail.com</span>
            </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="w-[480px] min-w-[400px] bg-white rounded-r-3xl p-10 md:p-12 flex flex-col">
          <Link href="/" className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-700 text-sm font-medium mb-6 w-fit">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Parlons de votre projet</h1>
            <p className="text-gray-500 text-sm mt-2">Remplissez le formulaire et nous vous répondrons rapidement.</p>
          </div>

          {success && (
            <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 px-5 py-4 text-sm flex items-start gap-3 mb-6">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-0.5">Message envoyé !</strong>
                Merci de nous avoir contactés. Nous vous répondrons dans les plus brefs délais.
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-5 py-4 text-sm flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet *</label>
                <input id="nom" type="text" value={nom} onChange={(e) => setNom(e.target.value)} required
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none transition-all duration-300 text-sm" />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none transition-all duration-300 text-sm" />
              </div>
            </div>

            <div>
              <label htmlFor="sujet" className="block text-sm font-medium text-gray-700 mb-1.5">Sujet</label>
              <input id="sujet" type="text" value={sujet} onChange={(e) => setSujet(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none transition-all duration-300 text-sm" />
            </div>

            <div className="flex-1 flex flex-col">
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1.5">Message *</label>
              <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} required rows={5}
                className="flex-1 w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 outline-none transition-all duration-300 text-sm resize-none"></textarea>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Envoi en cours...
                </span>
              ) : (
                <><Send className="w-4 h-4" /> Envoyer le message</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

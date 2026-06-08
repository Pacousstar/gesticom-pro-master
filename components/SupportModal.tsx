'use client'

import Image from 'next/image'
import { X, Mail, Phone, Globe, ExternalLink, MapPin } from 'lucide-react'

interface SupportModalProps {
  isOpen: boolean
  onClose: () => void
}

const SUPPORT = {
  contact: '05 44 81 49 24',
  email: 'pacousstar01@gmail.com',
  siteWeb: 'gesticom.com',
  localisation: 'Duékoué, Région du Guémon',
}

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
  if (!isOpen) return null

  const color = '#FF7518'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-2xl border border-[#FFE0CC] bg-white shadow-2xl overflow-hidden">
          <div
            className="px-6 pt-6 pb-10 text-white relative"
            style={{ background: `linear-gradient(135deg, ${color}, #CC5C12)` }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Image src="/icon-512x512.png" alt="GestiCom Pro" width={24} height={24} className="h-6 w-6 object-contain" />
              </div>
              <h2 className="text-lg font-bold">Support</h2>
            </div>
            <p className="text-sm text-white/80">GestiCom Pro</p>
          </div>

          <div className="p-6 space-y-4">
            <a href={`tel:${SUPPORT.contact}`} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 hover:bg-[#FFF5EB] hover:border-[#FFC299] transition-colors group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFE0CC] text-[#FF7518] group-hover:bg-[#FFC299] transition-colors">
                <Phone className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Téléphone</p>
                <p className="text-sm font-bold text-gray-900">{SUPPORT.contact}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-[#FF7518]" />
            </a>

            <a href={`mailto:${SUPPORT.email}`} className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 hover:bg-[#FFF5EB] hover:border-[#FFC299] transition-colors group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFE0CC] text-[#FF7518] group-hover:bg-[#FFC299] transition-colors">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email</p>
                <p className="text-sm font-bold text-gray-900">{SUPPORT.email}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-[#FF7518]" />
            </a>

            <a href={`https://${SUPPORT.siteWeb}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 hover:bg-[#FFF5EB] hover:border-[#FFC299] transition-colors group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFE0CC] text-[#FF7518] group-hover:bg-[#FFC299] transition-colors">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Site web</p>
                <p className="text-sm font-bold text-gray-900">{SUPPORT.siteWeb}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-[#FF7518]" />
            </a>

            <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFE0CC] text-[#FF7518]">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Adresse</p>
                <p className="text-sm font-bold text-gray-900">{SUPPORT.localisation}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 bg-gray-50 px-6 py-3">
            <p className="text-center text-[10px] text-gray-400 uppercase tracking-wider">
              GestiCom Pro &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

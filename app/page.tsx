'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Shield, ArrowRight } from 'lucide-react'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [volume, setVolume] = useState(0.3)
  const [showVolume, setShowVolume] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume
  }, [volume])

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay loop playsInline
          className="w-[85%] h-[85%] object-cover rounded-3xl opacity-60"
        >
          <source src="/images/gesticom-pro.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-orange-900/60 to-black/70" />
      <button
        onClick={() => setShowVolume(!showVolume)}
        className="absolute bottom-6 right-6 z-20 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all"
        title="Volume"
      >
        {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
      </button>
      {showVolume && (
        <div className="absolute bottom-20 right-6 z-20 bg-black/60 backdrop-blur-md rounded-xl p-3 flex flex-col items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="w-24 h-1.5 appearance-none bg-white/30 rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="text-white text-xs">{Math.round(volume * 100)}%</span>
        </div>
      )}

      {mounted && (
        <div className="absolute inset-0">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/40 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 5}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className={`relative z-10 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center transform transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full blur-lg opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-orange-500 to-orange-700 p-6 rounded-full shadow-2xl">
                <Image 
                  src="/logo.png" 
                  alt="GestiCom - Gestion de Commerce" 
                  width={200} 
                  height={52} 
                  className="h-12 md:h-16 w-auto object-contain" 
                  priority 
                />
              </div>
            </div>
          </div>
          <p className="text-xl md:text-2xl font-semibold text-orange-700 mt-4">
            Gestion Professionnelle de Commerce
          </p>
          <p className="mt-2 text-sm md:text-base font-semibold text-[#0D6B0D]">
            Solution complète pour la gestion de vos magasins
          </p>
        </div>

        <div className="space-y-4 mb-10">
          <div className="flex items-center justify-center gap-3 text-gray-800 group hover:scale-105 transition-transform duration-300">
            <div className="w-4 h-4 rounded-full bg-orange-600 shadow-lg animate-pulse"></div>
            <span className="font-semibold text-lg">Multi-Magasins</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-gray-800 group hover:scale-105 transition-transform duration-300">
            <div className="w-4 h-4 rounded-full bg-green-600 shadow-lg animate-pulse animation-delay-1000"></div>
            <span className="font-semibold text-lg">Stocks en Temps Réel</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-gray-800 group hover:scale-105 transition-transform duration-300">
            <div className="w-4 h-4 rounded-full bg-blue-600 shadow-lg animate-pulse animation-delay-2000"></div>
            <span className="font-semibold text-lg">Comptabilité Complète</span>
          </div>
        </div>

        <Link 
          href="/login"
          className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 shadow-2xl hover:shadow-orange-500/50 hover:scale-105 transform"
        >
          <span>Accéder à l'application</span>
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Link>

        <div className="mt-10 pt-6 border-t border-gray-200 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Shield className="h-4 w-4 text-orange-500" />
            <span>Version {process.env.NEXT_PUBLIC_APP_VERSION || '—'} - Offline Ready - Sécurisé</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>GestiCom — Solution de Gestion Professionnelle</span>
          </div>
        </div>
      </div>
    </div>
  )
}

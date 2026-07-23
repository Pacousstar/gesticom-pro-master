'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Shield, ArrowRight } from 'lucide-react'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [volume, setVolume] = useState(0.3)
  const [playing, setPlaying] = useState(true)
  const [showVolume, setShowVolume] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume
  }, [volume])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setPlaying(true)
    } else {
      videoRef.current.pause()
      setPlaying(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="relative w-full md:w-1/2 flex items-center justify-center bg-black" style={{ minHeight: '50vh' }}>
        <video
          ref={videoRef}
          autoPlay loop playsInline preload="auto" onEnded={(e) => (e.target as HTMLVideoElement).play()}
          className="w-full h-auto max-h-screen object-contain"
          style={{ maxHeight: '100vh' }}
          onClick={togglePlay}
        >
          <source src="/images/gestiCom%20pro.mp4" type="video/mp4" />
        </video>
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all text-lg"
            title={playing ? 'Pause' : 'Lecture'}
          >
            {playing ? '⏸' : '▶️'}
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all"
            title="Volume"
          >
            {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          {showVolume && (
            <div className="absolute bottom-14 left-0 z-10 bg-black/60 backdrop-blur-md rounded-xl p-3 flex flex-col items-center gap-2">
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
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent pointer-events-none" />
      </div>

      <div className="relative w-full md:w-1/2 min-h-screen flex items-center justify-center p-6 md:p-12 bg-gradient-to-br from-orange-50 via-white to-orange-100">
        <div className={`relative w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 transform transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="mb-8 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start mb-6">
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
            <p className="text-xl md:text-2xl font-bold text-gray-900">GestiCom - Gestion de Commerce</p>
            <p className="text-lg md:text-xl font-semibold text-orange-700 mt-2">
              Gestion Professionnelle de Commerce
            </p>
            <p className="mt-1 text-sm md:text-base font-semibold text-green-700">
              Solution complète pour la gestion de vos magasins
            </p>
          </div>

          <div className="space-y-4 mb-10">
            <div className="flex items-center gap-3 text-gray-800 group hover:scale-105 transition-transform duration-300">
              <div className="w-4 h-4 rounded-full bg-orange-600 shadow-lg animate-pulse flex-shrink-0"></div>
              <span className="font-semibold text-lg">Multi-Magasins</span>
            </div>
            <div className="flex items-center gap-3 text-gray-800 group hover:scale-105 transition-transform duration-300">
              <div className="w-4 h-4 rounded-full bg-green-600 shadow-lg animate-pulse animation-delay-1000 flex-shrink-0"></div>
              <span className="font-semibold text-lg">Stocks en Temps Réel</span>
            </div>
            <div className="flex items-center gap-3 text-gray-800 group hover:scale-105 transition-transform duration-300">
              <div className="w-4 h-4 rounded-full bg-blue-600 shadow-lg animate-pulse animation-delay-2000 flex-shrink-0"></div>
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
            <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-gray-500">
              <Shield className="h-4 w-4 text-orange-500" />
              <span>Version {process.env.NEXT_PUBLIC_APP_VERSION || '—'} - Offline Ready - Sécurisé</span>
            </div>
            <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-gray-500">
              <span>GestiCom — Solution de Gestion Professionnelle</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

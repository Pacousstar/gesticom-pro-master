'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { TrendingUp, Shield, Zap, ArrowRight, Sparkles } from 'lucide-react'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [particles, setParticles] = useState<Array<{ left: number; top: number; delay: number; duration: number }>>([])

  useEffect(() => {
    setMounted(true)
    // Générer les positions des particules uniquement côté client
    setParticles(
      Array.from({ length: 20 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 5,
      }))
    )
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 flex items-center justify-center p-4">
      {/* Animations de fond */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-400/40 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-400/40 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-400/40 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Particules flottantes - générées uniquement côté client */}
      {mounted && (
        <div className="absolute inset-0">
          {particles.map((particle, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/40 rounded-full animate-float"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
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
            <span>Version 1.0.0 - Offline Ready - Sécurisé</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>GestiCom — Solution de Gestion Professionnelle</span>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import RapportsNav from './RapportsNav'
import { Users, UserCheck, Package } from 'lucide-react'
import Link from 'next/link'

export default function RapportsVentesPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <RapportsNav />
            
            <div className="relative overflow-hidden rounded-[2.5rem] bg-white border border-gray-100 p-10 shadow-2xl group">
                <div className="relative z-10">
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
                        Intelligence <span className="text-orange-600">Commerciale</span>
                    </h1>
                    <p className="mt-4 max-w-2xl text-slate-500 font-bold uppercase text-xs tracking-widest leading-relaxed opacity-80">
                        Exploration analytique des flux de vente, performance des collaborateurs et rentabilité du catalogue produits.
                    </p>
                </div>
                {/* Décorations Abstract Bright Pro */}
                <div className="absolute right-0 top-0 -mr-16 -mt-16 h-80 w-80 rounded-full bg-orange-500/5 blur-3xl group-hover:bg-orange-500/10 transition-colors duration-1000"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-px h-20 bg-gradient-to-t from-orange-500/20 to-transparent" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12">
                <Link href="/dashboard/rapports-ventes/vendeurs" className="group relative">
                    <div className="relative flex h-full flex-col justify-between rounded-[2.5rem] border border-gray-100 bg-white p-8 transition-all hover:shadow-2xl hover:-translate-y-2 duration-500 overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform">
                            <Users className="h-32 w-32 text-slate-900" />
                        </div>
                        <div>
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 shadow-inner group-hover:bg-orange-600 group-hover:text-white transition-all duration-500">
                                <Users className="h-7 w-7" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Force de Vente</h2>
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-relaxed">
                                Analyse du C.A et de l'efficacité par collaborateur.
                            </p>
                        </div>
                        <div className="mt-8 flex items-center text-[10px] font-black uppercase tracking-widest text-orange-600 group-hover:gap-3 transition-all">
                            DÉTAILS PERFORMANCE
                            <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </Link>

                <Link href="/dashboard/rapports-ventes/clients" className="group relative">
                    <div className="relative flex h-full flex-col justify-between rounded-[2.5rem] border border-gray-100 bg-white p-8 transition-all hover:shadow-2xl hover:-translate-y-2 duration-500 overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform">
                            <UserCheck className="h-32 w-32 text-slate-900" />
                        </div>
                        <div>
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                <UserCheck className="h-7 w-7" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Fidélité Clients</h2>
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-relaxed">
                                Top clients et habitudes de consommation.
                            </p>
                        </div>
                        <div className="mt-8 flex items-center text-[10px] font-black uppercase tracking-widest text-blue-600 group-hover:gap-3 transition-all">
                            ANALYSE FIDÉLITÉ
                            <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </Link>

                <Link href="/dashboard/rapports-ventes/produits" className="group relative">
                    <div className="relative flex h-full flex-col justify-between rounded-[2.5rem] border border-gray-100 bg-white p-8 transition-all hover:shadow-2xl hover:-translate-y-2 duration-500 overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform">
                            <Package className="h-32 w-32 text-slate-900" />
                        </div>
                        <div>
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                                <Package className="h-7 w-7" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Rentabilité</h2>
                            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-relaxed">
                                Performances articles et marges brutes.
                            </p>
                        </div>
                        <div className="mt-8 flex items-center text-[10px] font-black uppercase tracking-widest text-emerald-600 group-hover:gap-3 transition-all">
                            EXPLORER CATALOGUE
                            <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </Link>
            </div>
        </div>
    )
}

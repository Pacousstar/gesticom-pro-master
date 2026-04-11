'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, UserCheck, Package } from 'lucide-react'

export default function RapportsNav() {
    const pathname = usePathname()

    const tabs = [
        { name: 'Vue Globale', href: '/dashboard/rapports-ventes', icon: LayoutDashboard },
        { name: 'Par Vendeur', href: '/dashboard/rapports-ventes/vendeurs', icon: Users },
        { name: 'Par Client', href: '/dashboard/rapports-ventes/clients', icon: UserCheck },
        { name: 'Par Produit', href: '/dashboard/rapports-ventes/produits', icon: Package },
    ]

    return (
        <div className="mb-8 flex space-x-3 border-b border-gray-100 pb-4 overflow-x-auto custom-scrollbar scrollbar-hide no-print">
            {tabs.map((tab) => {
                const isActive = pathname === tab.href
                const Icon = tab.icon
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap border ${isActive
                                ? 'bg-orange-600 text-white shadow-xl shadow-orange-500/20 border-orange-500'
                                : 'text-slate-400 hover:text-slate-900 bg-white border-gray-100 hover:border-gray-300 shadow-sm'
                            }`}
                    >
                        <Icon className="h-4 w-4" />
                        {tab.name}
                    </Link>
                )
            })}
        </div>
    )
}

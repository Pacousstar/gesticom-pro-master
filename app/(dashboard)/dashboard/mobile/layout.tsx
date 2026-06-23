'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, ShoppingCart, Users, Package } from 'lucide-react'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const segments = pathname.split('/')
  const last = segments[segments.length - 1]
  const currentTab = last === 'mobile' ? '' : last

  const tabs = [
    { id: '', label: 'Dashboard', icon: TrendingUp, href: '/dashboard/mobile' },
    { id: 'ventes', label: 'Vente', icon: ShoppingCart, href: '/dashboard/mobile/ventes' },
    { id: 'clients', label: 'Clients', icon: Users, href: '/dashboard/mobile/clients' },
    { id: 'stock', label: 'Stock', icon: Package, href: '/dashboard/mobile/stock' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm h-[90vh] max-h-[min(820px,calc(100vh-3rem))] translate-y-8 bg-gray-950 text-white flex flex-col overflow-y-auto rounded-[3rem] border-4 border-gray-800 shadow-2xl shadow-orange-500/10">
        {children}
        <div className="flex items-center justify-around bg-gray-900 border-t border-gray-800 py-1 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = currentTab === tab.id
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive ? 'text-orange-400' : 'text-gray-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className={`text-[10px] font-bold ${isActive ? 'text-orange-400' : 'text-gray-500'}`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

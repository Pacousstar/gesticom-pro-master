import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Rapports Ventes | GestiCom',
}

export default function RapportsVentesLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
}

import Image from 'next/image'

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6">
      <Image src="/logo.png" alt="GestiCom" width={140} height={36} className="h-9 w-auto object-contain opacity-90" />
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
    </div>
  )
}

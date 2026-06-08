import { TableSkeleton, StatsRowSkeleton } from '@/components/loading-skeleton'

export default function AchatsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-36" />
        <div className="h-10 bg-gray-200 rounded-lg w-32" />
      </div>
      <StatsRowSkeleton />
      <TableSkeleton rows={10} cols={6} />
    </div>
  )
}

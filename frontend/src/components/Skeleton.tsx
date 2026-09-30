import type { ReactNode } from 'react'

interface SkeletonProps {
  className?: string
}

/** 基础骨架屏（用 shimmer 流光） */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded bg-slate-200 ${className}`}
      aria-hidden="true"
    />
  )
}

/** 房源卡片骨架（避免 layout shift） */
export function ListingCardSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="aspect-[4/3] rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

/** 通用网格骨架 */
export function GridSkeleton({ count = 20, Item }: { count?: number; Item: () => ReactNode }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </>
  )
}

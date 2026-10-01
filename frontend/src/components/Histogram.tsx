import type { PriceBucket } from '@/types/listing'

interface HistogramProps {
  buckets: PriceBucket[]
  highlightMin?: string | null
  highlightMax?: string | null
}

/**
 * 价格直方图：30 个竖柱，玫瑰色，按 count 比例设高度
 * highlightMin/Max 区间内的柱子用深色（rose-500），区间外浅色（rose-200）
 */
export function Histogram({ buckets, highlightMin, highlightMax }: HistogramProps) {
  if (!buckets.length) {
    return (
      <div className="h-12 flex items-center justify-center text-xs text-slate-400">
        暂无价格数据
      </div>
    )
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1)
  const hMin = highlightMin !== undefined && highlightMin !== null ? Number(highlightMin) : null
  const hMax = highlightMax !== undefined && highlightMax !== null ? Number(highlightMax) : null

  return (
    <div className="flex items-end gap-[2px] h-12 px-1">
      {buckets.map((b, i) => {
        const bMin = Number(b.min)
        const bMax = Number(b.max)
        const inRange =
          (hMin === null || bMax >= hMin) && (hMax === null || bMin <= hMax)
        const highlight = hMin !== null || hMax !== null
        const heightPct = (b.count / maxCount) * 100
        return (
          <div
            key={i}
            className={`flex-1 rounded-t-sm transition-colors ${
              highlight
                ? inRange
                  ? 'bg-rose-500'
                  : 'bg-rose-200'
                : 'bg-rose-500'
            }`}
            style={{ height: `${Math.max(heightPct, b.count > 0 ? 8 : 0)}%` }}
            title={`¥${bMin} - ¥${bMax}: ${b.count}`}
          />
        )
      })}
    </div>
  )
}

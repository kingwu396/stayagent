import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SectionCarouselProps {
  title: ReactNode
  children: ReactNode
}

/**
 * Airbnb 风格横滑板块：标题 + 右上圆形箭头(到边界置灰) + 横向 snap 滚动行。
 * 子项请用 <CarouselCard> 包裹以获得固定宽度。
 */
export function SectionCarousel({ title, children }: SectionCarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  function update() {
    const el = rowRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  useEffect(() => {
    update()
    // 异步加载的卡片改变行宽后重新测量箭头可用态
    const el = rowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function scroll(dir: 1 | -1) {
    const el = rowRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section className="max-w-6xl mx-auto px-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-[22px] font-semibold text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">
          <ArrowBtn dir="left" disabled={!canLeft} onClick={() => scroll(-1)} />
          <ArrowBtn dir="right" disabled={!canRight} onClick={() => scroll(1)} />
        </div>
      </div>
      <div ref={rowRef} onScroll={update} className="flex gap-4 overflow-x-auto no-scrollbar snap-x">
        {children}
      </div>
    </section>
  )
}

/** 横滑卡片固定宽度 wrapper（复用 ListingCard 用） */
export function CarouselCard({ children }: { children: ReactNode }) {
  return <div className="w-[200px] md:w-[240px] flex-shrink-0 snap-start">{children}</div>
}

function ArrowBtn({
  dir,
  disabled,
  onClick,
}: {
  dir: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'left' ? '向左滚动' : '向右滚动'}
      className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${
        disabled
          ? 'border-slate-200 text-slate-300 cursor-default'
          : 'border-slate-300 text-slate-700 hover:border-slate-900 hover:text-slate-900 hover:shadow-md'
      }`}
    >
      <Icon className="w-5 h-5" />
    </button>
  )
}

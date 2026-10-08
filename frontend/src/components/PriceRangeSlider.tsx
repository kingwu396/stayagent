import { useRef, useState } from 'react'

interface PriceRangeSliderProps {
  /** 数据绝对下界 */
  min: number
  /** 数据绝对上界 */
  max: number
  /** 当前下界(null = 未设 = 滑到最左) */
  valueMin: number | null
  /** 当前上界(null = 未设 = 滑到最右) */
  valueMax: number | null
  /** 拖动/松手时回调(min/max 必为数字, 已按区间互斥钳制) */
  onChange: (min: number | null, max: number | null) => void
  className?: string
}

/**
 * Block 25: Airbnb 式双头价格滑杆。
 * 丝滑要点:
 * - 拖动中滑头位置走「本地拖动态 + rAF 合帧」, 每个 pointermove 都在下一帧渲染(60fps 跟手)
 * - 同步给外部的提交(直方图高亮/预览计数/输入框)单独节流 200ms, 松手必提交
 * - Pointer Events 统一鼠标/触摸; 拖动头越过另一个头时把对方推着走(不会交叉)
 */
export function PriceRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  className = '',
}: PriceRangeSliderProps) {
  const [drag, setDrag] = useState<{ which: 'min' | 'max'; value: number } | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lastCommitRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const pendingXRef = useRef<number | null>(null)
  // onMove 闭包里读最新 props(避免拖动中读到过期值)
  const valuesRef = useRef({ lo: valueMin ?? min, hi: valueMax ?? max })
  valuesRef.current = { lo: valueMin ?? min, hi: valueMax ?? max }

  // 拖动中: 被拖的头用本地值(跟手), 另一头用 props
  const lo = drag?.which === 'min' ? drag.value : valuesRef.current.lo
  const hi = drag?.which === 'max' ? drag.value : valuesRef.current.hi

  const pct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))

  function valueFromClientX(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.round(min + p * (max - min))
  }

  function commitToParent(which: 'min' | 'max', v: number, final: boolean) {
    const now = performance.now()
    if (!final && now - lastCommitRef.current < 200) return
    lastCommitRef.current = now
    const { lo: curLo, hi: curHi } = valuesRef.current
    if (which === 'min') {
      const next = Math.min(Math.max(v, min), max)
      onChange(next, Math.max(next, curHi)) // 越过头把对方推着走
    } else {
      const next = Math.min(Math.max(v, min), max)
      onChange(Math.min(next, curLo), next)
    }
  }

  const cleanupRef = useRef<(() => void) | null>(null)

  function startDrag(which: 'min' | 'max', e: React.PointerEvent) {
    e.preventDefault()
    // 防泄漏: 上一个拖动会话若因异常未收尾(如 pointercancel 丢失), 先清理
    cleanupRef.current?.()
    setDrag({ which, value: valueFromClientX(e.clientX) })
    commitToParent(which, valueFromClientX(e.clientX), false)

    const onMove = (ev: PointerEvent) => {
      pendingXRef.current = ev.clientX
      if (rafRef.current != null) return // 已有帧排队, 合帧
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const x = pendingXRef.current
        if (x == null) return
        pendingXRef.current = null
        const v = valueFromClientX(x)
        setDrag({ which, value: v })
        commitToParent(which, v, false)
      })
    }
    const onUp = (ev: PointerEvent) => {
      cleanupRef.current?.()
      pendingXRef.current = null
      const v = valueFromClientX(ev.clientX)
      commitToParent(which, v, true) // 松手必提交
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    cleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setDrag(null)
      cleanupRef.current = null
    }
  }

  const loPct = pct(lo)
  const hiPct = pct(hi)

  return (
    <div className={`select-none ${className}`}>
      <div ref={trackRef} className="relative h-8 flex items-center">
        {/* 轨道 */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-slate-200" />
        {/* 已选区间 */}
        <div
          className="absolute h-1 rounded-full bg-brand-500"
          style={{ left: `${loPct}%`, width: `${Math.max(hiPct - loPct, 0)}%` }}
        />
        {/* 下界头 */}
        <Thumb
          pos={loPct}
          active={drag?.which === 'min'}
          onDown={(e) => startDrag('min', e)}
          ariaLabel="最低价格"
        />
        {/* 上界头 */}
        <Thumb
          pos={hiPct}
          active={drag?.which === 'max'}
          onDown={(e) => startDrag('max', e)}
          ariaLabel="最高价格"
        />
      </div>
    </div>
  )
}

function Thumb({
  pos,
  active,
  onDown,
  ariaLabel,
}: {
  pos: number
  active: boolean
  onDown: (e: React.PointerEvent) => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="slider"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(pos)}
      onPointerDown={onDown}
      style={{ left: `calc(${pos}% - 12px)`, touchAction: 'none' }}
      className={`absolute w-6 h-6 rounded-full bg-white border shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing active:z-10 ${
        active ? 'border-slate-900 shadow-lg' : 'border-slate-300 hover:border-slate-500'
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-slate-900" />
    </button>
  )
}

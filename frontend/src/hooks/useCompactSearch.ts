import { useEffect, useRef, useState, useCallback } from 'react'

export interface GuestsValue {
  adults: number
  children: number
  infants: number
  pets: number
}

export const EMPTY_GUESTS: GuestsValue = {
  adults: 0,
  children: 0,
  infants: 0,
  pets: 0,
}

export interface CompactSearchState {
  city: string
  checkIn: string
  checkOut: string
  guests: GuestsValue
}

export const EMPTY_SEARCH: CompactSearchState = {
  city: '',
  checkIn: '',
  checkOut: '',
  guests: { ...EMPTY_GUESTS },
}

export type SearchPanel = 'location' | 'dates' | 'guests'

/** total number of guests (adults + children) for filtering */
export function totalGuests(g: GuestsValue): number {
  return g.adults + g.children
}

/** format date range for pill display */
export function formatDateRange(checkIn: string, checkOut: string): string {
  if (!checkIn && !checkOut) return '任何日期'
  const fmt = (s: string) => {
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }
  if (checkIn && checkOut) return `${fmt(checkIn)} - ${fmt(checkOut)}`
  if (checkIn) return `${fmt(checkIn)} 起`
  return `至 ${fmt(checkOut)}`
}

/** format guests for pill display */
export function formatGuestsSummary(g: GuestsValue): string {
  const total = g.adults + g.children
  if (total === 0 && g.infants === 0 && g.pets === 0) return ''
  const parts: string[] = []
  if (total > 0) parts.push(`${total} 位客人`)
  if (g.infants > 0) parts.push(`${g.infants} 位婴儿`)
  if (g.pets > 0) parts.push(`${g.pets} 只宠物`)
  return parts.join('，')
}

interface UseCompactSearchOptions {
  initial?: CompactSearchState
  /** Called when initial changes (URL → state sync) */
  syncFromInitial?: boolean
  /** state 变化时回调（Hero ↔ 顶栏胶囊双端同步用） */
  onChange?: (state: CompactSearchState) => void
}

export function useCompactSearch({ initial, syncFromInitial = true, onChange }: UseCompactSearchOptions = {}) {
  const [state, setState] = useState<CompactSearchState>(initial ?? EMPTY_SEARCH)
  const [expanded, setExpanded] = useState(false)
  const [activePanel, setActivePanel] = useState<SearchPanel | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // onChange 走 ref，避免回调 identity 变化导致下游 effect 重跑
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // 任意 setState 路径（输入 / 面板选择 / initial 同步）都会经过这里，
  // 统一向外报告最新 state；父组件存回同一引用时 React 会 bailout，不会成环
  useEffect(() => {
    onChangeRef.current?.(state)
  }, [state])

  // 当 initial prop 变化时同步（URL 变 → state 变）
  useEffect(() => {
    if (!syncFromInitial || !initial) return
    setState(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initial?.city,
    initial?.checkIn,
    initial?.checkOut,
    initial?.guests.adults,
    initial?.guests.children,
    initial?.guests.infants,
    initial?.guests.pets,
  ])

  // 点击外部关闭 expanded
  useEffect(() => {
    if (!expanded) return
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return
      const target = e.target as Node
      // Block 24: 移动端全屏选择页 portal 在 body 下, 不算「外部」
      if (target instanceof Element && target.closest('[data-search-sheet]')) return
      if (!containerRef.current.contains(target)) {
        close()
      }
    }
    const t = setTimeout(() => {
      window.addEventListener('mousedown', onDown)
    }, 0)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', onDown)
    }
  }, [expanded])

  // ESC 关闭
  useEffect(() => {
    if (!expanded) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const open = useCallback((panel?: SearchPanel) => {
    setExpanded(true)
    setActivePanel(panel ?? 'location')
  }, [])

  const close = useCallback(() => {
    setExpanded(false)
    setActivePanel(null)
  }, [])

  /**
   * 切换展开。
   * - 折叠 → 展开到指定 panel（默认 location）
   * - 展开态 + 不同 panel → 切换
   * - 展开态 + 同一 panel → 不响应（关闭走 ESC / 点击外部）
   */
  const toggle = useCallback((panel?: SearchPanel) => {
    setExpanded((currExpanded) => {
      if (!currExpanded) {
        setActivePanel(panel ?? 'location')
        return true
      }
      return true // 保持展开
    })
    if (expanded && panel && activePanel !== panel) {
      setActivePanel(panel)
    }
  }, [expanded, activePanel])

  return {
    state,
    setState,
    expanded,
    activePanel,
    setActivePanel,
    containerRef,
    open,
    close,
    toggle,
  }
}

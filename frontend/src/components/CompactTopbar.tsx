import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Hotel,
  MapPin,
  CalendarDays,
  Users,
  Search,
} from 'lucide-react'
import { UserMenu } from './UserMenu'
import { LocationSuggestions } from './LocationSuggestions'
import { DatePickerPanel } from './DatePickerPanel'
import { GuestsPanel, formatGuestsSummary, type GuestsValue } from './GuestsPanel'
import type { CityInfo } from '@/types/listing'

/** 紧凑搜索条承载的搜索状态 */
export interface CompactSearchState {
  city: string
  checkIn: string  // YYYY-MM-DD
  checkOut: string
  guests: GuestsValue
}

export const EMPTY_GUESTS: GuestsValue = {
  adults: 0,
  children: 0,
  infants: 0,
  pets: 0,
}

export const EMPTY_SEARCH: CompactSearchState = {
  city: '',
  checkIn: '',
  checkOut: '',
  guests: { ...EMPTY_GUESTS },
}

interface CompactTopbarProps {
  /** 是否整体可见（HomeView 滚过 hero 时才可见） */
  visible?: boolean
  /** 初始值（SearchView 用，从 URL 解析过来） */
  initial?: CompactSearchState
  /** 推荐城市（来自后端 /api/listings/cities） */
  recommended?: CityInfo[]
  /** 点击搜索后行为：默认 navigate('/search?q=...') */
  onSearch?: (state: CompactSearchState) => void
  /** 自定义类名（用于 SearchView 等场景贴顶） */
  className?: string
}

/** 把 GuestsValue 转成单字段 guests 数（适配 API min_guests） */
function totalGuests(g: GuestsValue): number {
  return g.adults + g.children
}

/** 把日期转成人类可读文本 */
function formatDateRange(checkIn: string, checkOut: string): string {
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

export function CompactTopbar({
  visible = true,
  initial,
  recommended,
  onSearch,
  className = '',
}: CompactTopbarProps) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  const [expanded, setExpanded] = useState(false)
  const [activePanel, setActivePanel] = useState<'location' | 'dates' | 'guests' | null>(null)
  const [state, setState] = useState<CompactSearchState>(initial ?? EMPTY_SEARCH)

  // 当 initial prop 变化时同步（URL 变 → state 变）
  useEffect(() => {
    if (initial) setState(initial)
  }, [initial?.city, initial?.checkIn, initial?.checkOut, initial?.guests.adults, initial?.guests.children, initial?.guests.infants, initial?.guests.pets])

  // 点击外部关闭 expanded
  useEffect(() => {
    if (!expanded) return
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setActivePanel(null)
      }
    }
    // 延迟挂载，避免当前点击事件触发关闭
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
      if (e.key === 'Escape') {
        setExpanded(false)
        setActivePanel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  function toggleExpand(panel?: 'location' | 'dates' | 'guests') {
    if (!expanded) {
      // 折叠 → 展开
      setExpanded(true)
      setActivePanel(panel ?? 'location')
    } else if (panel && activePanel !== panel) {
      // 展开态：点击不同 segment → 切换 panel
      setActivePanel(panel)
    }
    // 展开态点击同一 segment 或无 segment：不响应（避免误关闭）
    // 关闭由 ESC / 点击外部 / 搜索按钮触发
  }

  const triggerSearch = useCallback(() => {
    const params = new URLSearchParams()
    if (state.city.trim()) params.set('city', state.city.trim())
    if (state.checkIn) params.set('check_in', state.checkIn)
    if (state.checkOut) params.set('check_out', state.checkOut)
    const g = totalGuests(state.guests)
    if (g > 0) params.set('min_guests', String(g))

    if (onSearch) {
      onSearch(state)
    } else {
      navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`)
    }
    setExpanded(false)
    setActivePanel(null)
  }, [state, navigate, onSearch])

  // ===== 紧凑态显示文本 =====
  const cityDisplay = state.city || '想去哪？'
  const dateDisplay = formatDateRange(state.checkIn, state.checkOut)
  const guestsDisplay = formatGuestsSummary(state.guests) || '添加人数'

  return (
    <div
      ref={containerRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-full pointer-events-none'
      } ${className}`}
      aria-hidden={!visible}
    >
      {/* 顶部条 */}
      <div className="bg-white border-b border-slate-200 backdrop-blur-sm">
        <div className="max-w-[1760px] mx-auto px-6 h-16 md:h-[72px] flex items-center gap-4 md:gap-6">
          {/* Logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault()
              navigate('/')
            }}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <div className="w-7 h-7 md:w-8 md:h-8 bg-brand-500 rounded-md md:rounded-lg flex items-center justify-center">
              <Hotel className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <span className="text-base md:text-lg font-bold text-slate-900 hidden sm:inline">
              StayAgent
            </span>
          </a>

          {/* 紧凑搜索 pill（展开时折叠为单段） */}
          {!expanded ? (
            <>
              {/* 桌面端：完整 pill */}
              <div
                role="button"
                onClick={() => toggleExpand()}
                className="hidden md:flex flex-1 items-center max-w-2xl mx-auto border border-slate-300 rounded-full hover:shadow-md transition cursor-pointer divide-x divide-slate-200"
              >
                <PillSegment icon={<MapPin className="w-4 h-4" />} label={cityDisplay} highlight={!!state.city} />
                <PillSegment icon={<CalendarDays className="w-4 h-4" />} label={dateDisplay} highlight={!!(state.checkIn || state.checkOut)} />
                <PillSegment icon={<Users className="w-4 h-4" />} label={guestsDisplay} highlight={totalGuests(state.guests) > 0} />
                <span className="ml-auto mr-1.5 w-8 h-8 rounded-full bg-brand-500 group-hover:bg-brand-600 flex items-center justify-center transition flex-shrink-0">
                  <Search className="w-4 h-4 text-white" />
                </span>
              </div>

              {/* 移动端：单 input */}
              <button
                type="button"
                onClick={() => toggleExpand()}
                className="md:hidden flex-1 flex items-center gap-2 border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-500 hover:shadow-md transition"
              >
                <Search className="w-4 h-4" />
                <span className="truncate">
                  {state.city || '搜索房源'}
                  {(state.checkIn || state.checkOut) && ` · ${dateDisplay}`}
                </span>
              </button>
            </>
          ) : (
            <>
              {/* 展开态：单段 pill（显示"任意地点"），各段点开切换 dropdown */}
              <div className="hidden md:flex flex-1 items-center max-w-3xl mx-auto border border-slate-300 rounded-full hover:shadow-md transition divide-x divide-slate-200 bg-white">
                <ExpandPillSegment
                  icon={<MapPin className="w-4 h-4" />}
                  label={cityDisplay || '任何地点'}
                  active={activePanel === 'location'}
                  onClick={() => toggleExpand('location')}
                />
                <ExpandPillSegment
                  icon={<CalendarDays className="w-4 h-4" />}
                  label={dateDisplay}
                  active={activePanel === 'dates'}
                  onClick={() => toggleExpand('dates')}
                />
                <ExpandPillSegment
                  icon={<Users className="w-4 h-4" />}
                  label={guestsDisplay}
                  active={activePanel === 'guests'}
                  onClick={() => toggleExpand('guests')}
                />
                <button
                  type="button"
                  onClick={triggerSearch}
                  className="ml-auto mr-1.5 flex items-center gap-1.5 px-3 h-10 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition flex-shrink-0"
                >
                  <Search className="w-4 h-4" />
                  <span>搜索</span>
                </button>
              </div>

              {/* 移动端：占位 */}
              <div className="md:hidden flex-1" />
            </>
          )}

          {/* 心 + 用户菜单 */}
          <UserMenu />
        </div>
      </div>

      {/* 展开态：下拉面板 */}
      {expanded && (
        <div className="bg-white border-b border-slate-200 shadow-lg animate-expand-down">
          <div className="max-w-[1760px] mx-auto px-6">
            {/* 移动端：tab 切换（一次只显示一个 panel） */}
            <div className="md:hidden flex border-b border-slate-200">
              {(['location', 'dates', 'guests'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActivePanel(p)}
                  className={`flex-1 py-3 text-sm font-medium transition ${
                    activePanel === p
                      ? 'text-slate-900 border-b-2 border-slate-900'
                      : 'text-slate-500'
                  }`}
                >
                  {p === 'location' ? '地点' : p === 'dates' ? '时间' : '人员'}
                </button>
              ))}
            </div>

            <div className="flex">
              {/* panel 内容 */}
              <div className="flex-1 min-w-0 max-h-[520px] overflow-y-auto">
                <div className={(activePanel === 'location' || activePanel === null) ? 'block' : 'hidden'}>
                  <LocationSuggestions
                    value={state.city}
                    onChange={(v) => setState((s) => ({ ...s, city: v }))}
                    onPick={(city) => {
                      setState((s) => ({ ...s, city }))
                      setActivePanel('dates')
                    }}
                    recommended={recommended}
                    focused={activePanel === 'location' || activePanel === null}
                  />
                </div>
                {activePanel === 'dates' && (
                  <DatePickerPanel
                    checkIn={state.checkIn}
                    checkOut={state.checkOut}
                    onChange={(inDate, outDate) => setState((s) => ({ ...s, checkIn: inDate, checkOut: outDate }))}
                  />
                )}
                {activePanel === 'guests' && (
                  <GuestsPanel
                    value={state.guests}
                    onChange={(v) => setState((s) => ({ ...s, guests: v }))}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 紧凑态 pill 单段 */
function PillSegment({
  icon,
  label,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  highlight: boolean
}) {
  return (
    <span
      className={`flex-1 flex items-center gap-2 px-4 py-1.5 text-sm rounded-full cursor-pointer transition min-w-0 ${
        highlight ? 'text-slate-900 font-semibold' : 'text-slate-700'
      } hover:bg-slate-50`}
    >
      <span className="text-slate-500 flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  )
}

/** 展开态 pill 单段（active 高亮） */
function ExpandPillSegment({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center gap-2 px-4 py-1.5 text-sm rounded-full cursor-pointer transition min-w-0 ${
        active ? 'bg-white shadow-md text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className={`flex-shrink-0 ${active ? 'text-slate-900' : 'text-slate-500'}`}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}



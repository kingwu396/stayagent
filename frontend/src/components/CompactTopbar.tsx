import { Link, useNavigate } from 'react-router-dom'
import { Hotel, MapPin, CalendarDays, Users, Search } from 'lucide-react'
import { UserMenu } from './UserMenu'
import { SearchPanel } from './SearchPanel'
import {
  useCompactSearch,
  formatDateRange,
  formatGuestsSummary,
  totalGuests,
  type CompactSearchState,
  type SearchPanel as PanelKey,
} from '@/hooks/useCompactSearch'
import type { CityInfo } from '@/types/listing'

interface CompactTopbarProps {
  /** 是否整体可见（HomeView 滚过 hero 时才可见） */
  visible?: boolean
  /** 初始值（SearchView 用，从 URL 解析过来） */
  initial?: CompactSearchState
  /** 推荐城市（来自后端 /api/listings/cities） */
  recommended?: CityInfo[]
  /** 点击搜索后行为：默认 navigate('/search?q=...') */
  onSearch?: (state: CompactSearchState) => void
}

export function CompactTopbar({
  visible = true,
  initial,
  recommended,
  onSearch,
}: CompactTopbarProps) {
  const navigate = useNavigate()
  const {
    state,
    setState,
    expanded,
    activePanel,
    containerRef,
    close,
    toggle,
  } = useCompactSearch({ initial })

  function triggerSearch() {
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
    close()
  }

  // ===== 紧凑态显示文本 =====
  const cityDisplay = state.city || '想去哪？'
  const dateDisplay = formatDateRange(state.checkIn, state.checkOut)
  const guestsDisplay = formatGuestsSummary(state.guests) || '添加人数'

  return (
    <div
      ref={containerRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-full pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      {/* 顶部条 */}
      <div className="bg-white border-b border-slate-200 backdrop-blur-sm">
        <div className="max-w-[1760px] mx-auto px-6 h-16 md:h-[72px] flex items-center gap-4 md:gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-brand-500 rounded-md md:rounded-lg flex items-center justify-center">
              <Hotel className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <span className="text-base md:text-lg font-bold text-slate-900 hidden sm:inline">
              StayAgent
            </span>
          </Link>

          {/* pill */}
          <div
            className={`hidden md:flex flex-1 items-center ${
              expanded ? 'max-w-3xl' : 'max-w-2xl'
            } mx-auto border border-slate-300 rounded-full hover:shadow-md transition divide-x divide-slate-200 bg-white`}
          >
            <PillSegment
              icon={<MapPin className="w-4 h-4" />}
              label={expanded ? cityDisplay || '任何地点' : cityDisplay}
              highlight={!!state.city}
              active={activePanel === 'location'}
              onClick={() => toggle('location')}
            />
            <PillSegment
              icon={<CalendarDays className="w-4 h-4" />}
              label={dateDisplay}
              highlight={!!(state.checkIn || state.checkOut)}
              active={activePanel === 'dates'}
              onClick={() => toggle('dates')}
            />
            <PillSegment
              icon={<Users className="w-4 h-4" />}
              label={guestsDisplay}
              highlight={totalGuests(state.guests) > 0}
              active={activePanel === 'guests'}
              onClick={() => toggle('guests')}
            />
            {expanded ? (
              <button
                type="button"
                onClick={triggerSearch}
                className="ml-auto mr-1.5 flex items-center gap-1.5 px-4 h-10 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition flex-shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>搜索</span>
              </button>
            ) : (
              <span className="ml-auto mr-1.5 w-9 h-9 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center transition flex-shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); triggerSearch() }}>
                <Search className="w-4 h-4 text-white" />
              </span>
            )}
          </div>

          {/* 移动端：单 input */}
          <button
            type="button"
            onClick={() => toggle()}
            className="md:hidden flex-1 flex items-center gap-2 border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-500 hover:shadow-md transition"
          >
            <Search className="w-4 h-4" />
            <span className="truncate">
              {state.city || '搜索房源'}
              {(state.checkIn || state.checkOut) && ` · ${dateDisplay}`}
            </span>
          </button>

          {/* 心 + 用户菜单 */}
          <UserMenu />
        </div>
      </div>

      {/* 展开态：下拉面板（更紧凑的尺寸） */}
      {expanded && (
        <div className="bg-white border-b border-slate-200 shadow-lg animate-expand-down">
          <div className="max-w-[1760px] mx-auto px-6">
            {/* 移动端：tab 切换 */}
            <div className="md:hidden flex border-b border-slate-200">
              {(['location', 'dates', 'guests'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggle(p)}
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

            {/* 桌面端：面板居中、宽度受限 */}
            <div className="hidden md:flex justify-center py-2">
              <div className="w-full max-w-3xl max-h-[480px] overflow-y-auto">
                <SearchPanel
                  active={activePanel}
                  state={state}
                  setState={setState}
                  recommended={recommended}
                  variant="double"
                />
              </div>
            </div>

            {/* 移动端 */}
            <div className="md:hidden max-h-[480px] overflow-y-auto">
              <SearchPanel
                active={activePanel}
                state={state}
                setState={setState}
                recommended={recommended}
                variant="single"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** pill 单段（统一 compact + expanded） */
function PillSegment({
  icon,
  label,
  highlight,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  highlight: boolean
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center gap-2 px-4 py-1.5 text-sm rounded-full cursor-pointer transition min-w-0 ${
        active
          ? 'bg-white shadow-md text-slate-900 font-semibold'
          : highlight
            ? 'text-slate-900 font-semibold'
            : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className={`flex-shrink-0 ${active ? 'text-slate-900' : 'text-slate-500'}`}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

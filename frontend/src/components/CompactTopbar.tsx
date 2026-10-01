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
} from '@/hooks/useCompactSearch'
import type { CityInfo } from '@/types/listing'

interface CompactTopbarProps {
  visible?: boolean
  initial?: CompactSearchState
  recommended?: CityInfo[]
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
      {/* 顶部条：logo + pill + 用户菜单 */}
      <div className="bg-white">
        <div className="max-w-[1760px] mx-auto px-6 h-16 md:h-[72px] flex items-center gap-4 md:gap-6 relative">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-brand-500 rounded-md md:rounded-lg flex items-center justify-center">
              <Hotel className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <span className="text-base md:text-lg font-bold text-slate-900 hidden sm:inline">
              StayAgent
            </span>
          </Link>

          {/* pill：浅灰底（让 active 白段更突出） */}
          <div
            className={`hidden md:flex flex-1 items-center ${
              expanded ? 'max-w-3xl' : 'max-w-2xl'
            } mx-auto border border-slate-200 rounded-full shadow-sm transition divide-x divide-slate-200 bg-slate-50`}
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
              <span
                className="ml-auto mr-1.5 w-9 h-9 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center transition flex-shrink-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  triggerSearch()
                }}
              >
                <Search className="w-4 h-4 text-white" />
              </span>
            )}
          </div>

          {/* 移动端：单 input */}
          <button
            type="button"
            onClick={() => toggle()}
            className="md:hidden flex-1 flex items-center gap-2 border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:shadow-md transition"
          >
            <Search className="w-4 h-4" />
            <span className="truncate">
              {state.city || '搜索房源'}
              {(state.checkIn || state.checkOut) && ` · ${dateDisplay}`}
            </span>
          </button>

          {/* 心 + 用户菜单 */}
          <UserMenu />

          {/* 展开面板：浮动卡片，居中 */}
          {expanded && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 animate-expand-down pointer-events-auto">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[520px] overflow-y-auto">
                {/* 移动端：tab 切换（卡片内顶部） */}
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
                <SearchPanel
                  active={activePanel}
                  state={state}
                  setState={setState}
                  recommended={recommended}
                  variant="single"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** pill 单段（统一 compact + expanded 样式） */
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
            : 'text-slate-700 hover:bg-white/60'
      }`}
    >
      <span className={`flex-shrink-0 ${active ? 'text-slate-900' : 'text-slate-500'}`}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

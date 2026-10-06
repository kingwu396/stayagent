import { forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, CalendarDays, Users } from 'lucide-react'
import { SearchPanel } from './SearchPanel'
import {
  useCompactSearch,
  formatDateRange,
  formatGuestsSummary,
  totalGuests,
  type SearchPanel as PanelKey,
} from '@/hooks/useCompactSearch'
import type { CityInfo } from '@/types/listing'

interface HeroSearchProps {
  recommended?: CityInfo[]
}

export const HeroSearch = forwardRef<HTMLDivElement, HeroSearchProps>(function HeroSearch(
  { recommended },
  ref
) {
  const navigate = useNavigate()
  const {
    state,
    setState,
    expanded,
    activePanel,
    containerRef,
    close,
    toggle,
  } = useCompactSearch({})

  function triggerSearch() {
    const params = new URLSearchParams()
    if (state.city.trim()) params.set('city', state.city.trim())
    if (state.checkIn) params.set('check_in', state.checkIn)
    if (state.checkOut) params.set('check_out', state.checkOut)
    const g = totalGuests(state.guests)
    if (g > 0) params.set('min_guests', String(g))
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`)
    close()
  }

  const cityDisplay = state.city || '想去哪？'
  const dateRange = formatDateRange(state.checkIn, state.checkOut)

  // 浮层按 panel 对齐：
  // - location → 左侧对齐到「地点」段左边
  // - dates    → 居中
  // - guests   → 右侧对齐到「人数」段右边
  const panelAlignClass =
    activePanel === 'location'
      ? 'left-0'
      : activePanel === 'guests'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2'
  const guestsText = formatGuestsSummary(state.guests) || '添加人数'

  return (
    <section ref={ref} className="relative bg-gradient-to-br from-rose-50 via-white to-slate-50 border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
          找到你的<span className="text-brand-500">下一站</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
          告诉 AI Agent 你想去哪儿，剩下的它来搞定
        </p>

        {/* 搜索栏容器（需要 ref 包裹以支持点击外部关闭） */}
        <div ref={containerRef} className="relative max-w-3xl mx-auto">
          {/* 搜索栏（4 段 + 按钮） */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-2 md:p-3 flex flex-col md:flex-row items-stretch md:items-center gap-1 md:gap-0 relative z-10">
            <HeroSegment
              icon={<MapPin className="w-5 h-5" />}
              label="想去哪？"
              placeholder="搜索目的地"
              value={state.city || ''}
              onClick={() => toggle('location')}
              active={activePanel === 'location'}
              onChangeText={(v) => setState((s) => ({ ...s, city: v }))}
              showInput={expanded && activePanel === 'location'}
            />
            <Divider />
            <HeroSegment
              icon={<CalendarDays className="w-5 h-5" />}
              label="入住"
              placeholder="任何日期"
              value={formatDateDisplay(state.checkIn)}
              onClick={() => toggle('dates')}
              active={activePanel === 'dates'}
            />
            <Divider />
            <HeroSegment
              icon={<CalendarDays className="w-5 h-5" />}
              label="退房"
              placeholder="任何日期"
              value={formatDateDisplay(state.checkOut)}
              onClick={() => toggle('dates')}
              active={activePanel === 'dates'}
            />
            <Divider />
            <HeroSegment
              icon={<Users className="w-5 h-5" />}
              label="人数"
              placeholder={guestsText}
              value=""
              onClick={() => toggle('guests')}
              active={activePanel === 'guests'}
            />

            <button
              onClick={triggerSearch}
              className="flex-shrink-0 flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-3 rounded-xl transition md:ml-2"
            >
              <Search className="w-4 h-4" />
              <span className="md:inline">搜索</span>
            </button>
          </div>

          {/* 展开态面板：紧凑浮层 */}
          {expanded && (
            <div className={`absolute ${panelAlignClass} top-full mt-2 z-20 animate-expand-down pointer-events-auto`}>
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[480px] overflow-y-auto">
                {/* 移动端 tab */}
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

        {/* 热门标签提示（始终显示在搜索栏下方） */}
        {!expanded && (
          <div className="mt-6 text-sm text-slate-500">
            热门：<span className="text-slate-700">东京</span> · <span className="text-slate-700">曼谷</span> · <span className="text-slate-700">巴厘岛</span> · <span className="text-slate-700">巴黎</span>
          </div>
        )}
      </div>
    </section>
  )
})

/** 格式化日期显示 */
function formatDateDisplay(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** Hero 单段（支持 inline input 用于 location） */
function HeroSegment({
  icon,
  label,
  placeholder,
  value,
  onClick,
  onChangeText,
  active,
  showInput,
}: {
  icon: React.ReactNode
  label: string
  placeholder: string
  value: string
  onClick: () => void
  onChangeText?: (v: string) => void
  active: boolean
  showInput?: boolean
}) {
  // location 段在 active 时显示真实 input
  if (showInput && onChangeText) {
    return (
      <div className="flex-1 px-3 py-2 md:py-1 rounded-lg cursor-text transition min-w-0 bg-white shadow-md">
        <div className="flex items-center gap-2 text-slate-900">
          <span className="text-slate-400 flex-shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-900">{label}</div>
            <input
              type="text"
              placeholder={placeholder}
              value={value}
              autoFocus
              onChange={(e) => onChangeText(e.target.value)}
              className="w-full text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 md:py-1 text-left rounded-lg cursor-pointer transition min-w-0 ${
        active ? 'bg-white shadow-md' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2 text-slate-900">
        <span className={`flex-shrink-0 ${active ? 'text-slate-900' : 'text-slate-400'}`}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-900">{label}</div>
          <div className={`text-sm truncate ${value ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
            {value || placeholder}
          </div>
        </div>
      </div>
    </button>
  )
}

function Divider() {
  return <div className="hidden md:block w-px h-8 bg-slate-200" />
}

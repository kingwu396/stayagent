import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MapPin, CalendarDays, Users, Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

interface SearchPillProps {
  initial?: CompactSearchState
  recommended?: CityInfo[]
  onSearch?: (state: CompactSearchState) => void
  onChange?: (state: CompactSearchState) => void
  /** 置 true 时强制收起（如主页胶囊随滚动切走时，顺带关掉展开面板） */
  forceCollapsed?: boolean
  /** md = 顶栏紧凑胶囊；lg = 主页 Hero 大搜索条（与 md 结构同构，供 layoutId morph） */
  size?: 'md' | 'lg'
  className?: string
}

/**
 * 统一搜索条（状态层）：useCompactSearch 管展开/面板/跳转，PillFrame 管外观。
 * 主页 Hero（size="lg"）与顶栏胶囊（size="md"）外观同构，
 * 配合外层 framer-motion layoutId 可实现两者之间的飞行 morph（同 Airbnb）。
 */
export function SearchPill({
  initial,
  recommended,
  onSearch,
  onChange,
  forceCollapsed = false,
  size = 'md',
  className = '',
}: SearchPillProps) {
  const navigate = useNavigate()
  const {
    state,
    setState,
    expanded,
    activePanel,
    containerRef,
    close,
    toggle,
  } = useCompactSearch({ initial, onChange })

  // 胶囊被调用方隐藏（滚出顶栏）时，展开面板一并收起，避免下次滚回来面板还挂着
  useEffect(() => {
    if (forceCollapsed && expanded) close()
  }, [forceCollapsed, expanded, close])

  // 展开时锁住背景滚动（同 Airbnb）：避免滚动触发 Hero ↔ 顶栏切换把搜索条拽走
  useEffect(() => {
    if (!expanded) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [expanded])

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

  // 浮层按 panel 对齐：location → 左 / dates → 中 / guests → 右
  const panelAlignClass =
    activePanel === 'location'
      ? 'left-0'
      : activePanel === 'guests'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2'

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto w-full ${
        size === 'md' ? (expanded ? 'max-w-3xl' : 'max-w-2xl') : ''
      } ${expanded ? 'z-40' : ''} ${className}`}
    >
      <PillFrame
        size={size}
        state={state}
        expanded={expanded}
        activePanel={activePanel}
        onSegment={toggle}
        onSearch={triggerSearch}
        onCityChange={(v) => setState((s) => ({ ...s, city: v }))}
        onMobileOpen={() => toggle()}
      />

      {/* 展开浮层 —— 桌面端：锚定胶囊的下拉面板（双月日历） */}
      {expanded && (
        <div className={`hidden md:block absolute ${panelAlignClass} top-full mt-2 z-20 animate-expand-down pointer-events-auto`}>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[520px] overflow-y-auto">
            <SearchPanel
              active={activePanel}
              state={state}
              setState={setState}
              recommended={recommended}
              variant="double"
            />
          </div>
        </div>
      )}

      {/* 展开浮层 —— Block 24 移动端：全屏选择页（单月日历， 完整宽度）。
          必须 portal 到 body: 祖先 layoutId 容器带 transform, fixed 会退化成相对它定位 */}
      {expanded &&
        createPortal(
          <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
            {/* 头部：关闭 + tab 切换 */}
            <div className="flex items-center border-b border-slate-200 flex-shrink-0">
              <button
                type="button"
                onClick={close}
                aria-label="关闭搜索"
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-slate-500 hover:text-slate-900 transition"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex-1 flex">
                {(['location', 'dates', 'guests'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggle(p)}
                    className={`flex-1 py-3.5 text-sm font-medium transition ${
                      activePanel === p
                        ? 'text-slate-900 border-b-2 border-slate-900'
                        : 'text-slate-500'
                    }`}
                  >
                    {p === 'location' ? '地点' : p === 'dates' ? '时间' : '人员'}
                  </button>
                ))}
              </div>
              {/* 占位平衡左侧关闭钮, 让 tab 视觉居中 */}
              <div className="w-12 flex-shrink-0" />
            </div>

            {/* 面板内容 */}
            <div className="flex-1 overflow-y-auto">
              <SearchPanel
                active={activePanel}
                state={state}
                setState={setState}
                recommended={recommended}
                variant="single"
              />
            </div>

            {/* 底部搜索按钮 */}
            <div className="flex-shrink-0 border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={triggerSearch}
                className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium py-3.5 rounded-xl transition"
              >
                <Search className="w-4 h-4" />
                <span>搜索</span>
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* 背景暗幕：portal 到 body，脱离 transformed 祖先的 containing block。
          z-30 低于顶栏(z-40)/搜索容器(z-40)，点击暗幕由全局 mousedown 关闭逻辑兜底 */}
      {createPortal(
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="search-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-slate-900/25"
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

/* ================= PillFrame：纯外观层（无状态） ================= */

interface PillFrameProps {
  size?: 'md' | 'lg'
  state: CompactSearchState
  expanded?: boolean
  activePanel?: PanelKey | null
  onSegment?: (panel: PanelKey) => void
  onSearch?: () => void
  onCityChange?: (v: string) => void
  onMobileOpen?: () => void
}

/**
 * 搜索条外观：md（顶栏紧凑胶囊）/ lg（Hero 大搜索条）同构，
 * 内部都是「地点 / 日期 / 人数 + 搜索钮」，保证 layoutId morph 时视觉连续。
 * 不传回调即为「静态占位」——主页两个槽位各放一份隐形副本顶住布局，
 * morph 切换挂载位置时文档流高度不抖动。
 */
export function PillFrame({
  size = 'md',
  state,
  expanded = false,
  activePanel = null,
  onSegment,
  onSearch,
  onCityChange,
  onMobileOpen,
}: PillFrameProps) {
  const cityDisplay = state.city || '想去哪？'
  const dateDisplay = formatDateRange(state.checkIn, state.checkOut)
  const guestsDisplay = formatGuestsSummary(state.guests) || '添加人数'
  const guestsEmpty =
    totalGuests(state.guests) === 0 && state.guests.infants === 0 && state.guests.pets === 0
  // Block 24: 移动端紧凑胶囊摘要文案
  const mobileSummary = [
    state.city || '搜索房源',
    (state.checkIn || state.checkOut) && dateDisplay !== '任何日期' ? dateDisplay : '',
    !guestsEmpty ? guestsDisplay : '',
  ]
    .filter(Boolean)
    .join(' · ')

  if (size === 'lg') {
    return (
      <>
        {/* 桌面端：四段大胶囊（与 md 同构） */}
        <div className="hidden md:flex w-full items-center border border-slate-200 rounded-full shadow-lg divide-x divide-slate-200 bg-slate-50">
          {expanded && activePanel === 'location' ? (
            <div className="flex-[1.3] flex items-center gap-2 pl-6 pr-4 py-2 rounded-full bg-white shadow-md min-w-0 cursor-text">
              <MapPin className="w-4 h-4 text-slate-900 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-900">想去哪？</div>
                <input
                  type="text"
                  placeholder="搜索目的地"
                  value={state.city}
                  autoFocus
                  onChange={(e) => onCityChange?.(e.target.value)}
                  className="w-full text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
                />
              </div>
            </div>
          ) : (
            <LgSegment
              flexClass="flex-[1.3]"
              icon={<MapPin className="w-4 h-4" />}
              label="想去哪？"
              text={state.city || '搜索目的地'}
              dim={!state.city}
              active={activePanel === 'location'}
              onClick={() => onSegment?.('location')}
            />
          )}
          <LgSegment
            icon={<CalendarDays className="w-4 h-4" />}
            label="入住"
            text={fmtDate(state.checkIn) || '任何日期'}
            dim={!state.checkIn}
            active={activePanel === 'dates'}
            onClick={() => onSegment?.('dates')}
          />
          <LgSegment
            icon={<CalendarDays className="w-4 h-4" />}
            label="退房"
            text={fmtDate(state.checkOut) || '任何日期'}
            dim={!state.checkOut}
            active={activePanel === 'dates'}
            onClick={() => onSegment?.('dates')}
          />
          <LgSegment
            icon={<Users className="w-4 h-4" />}
            label="人数"
            text={guestsDisplay}
            dim={guestsEmpty}
            active={activePanel === 'guests'}
            onClick={() => onSegment?.('guests')}
          />
          <button
            type="button"
            onClick={onSearch}
            className="ml-1 mr-1.5 flex-shrink-0 flex items-center gap-1.5 px-5 h-11 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition"
          >
            <Search className="w-4 h-4" />
            <span>搜索</span>
          </button>
        </div>

        {/* Block 24: 移动端单行紧凑胶囊(输入由展开浮层承担, 同 Airbnb) */}
        <div className="md:hidden w-full flex items-center gap-2 bg-white border border-slate-200 rounded-full shadow-lg pl-4 pr-1.5 py-1.5">
          <button
            type="button"
            onClick={() => onSegment?.('location')}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span
              className={`truncate text-sm ${
                state.city ? 'text-slate-900 font-medium' : 'text-slate-500'
              }`}
            >
              {mobileSummary}
            </span>
          </button>
          <button
            type="button"
            onClick={onSearch}
            aria-label="搜索"
            className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center transition"
          >
            <Search className="w-4 h-4 text-white" />
          </button>
        </div>
      </>
    )
  }

  /* ===== md：顶栏紧凑胶囊 ===== */
  return (
    <>
      {/* 桌面端：三段胶囊 */}
      <div className="hidden md:flex w-full items-center border border-slate-200 rounded-full shadow-sm transition divide-x divide-slate-200 bg-slate-50">
        <MdSegment
          icon={<MapPin className="w-4 h-4" />}
          label={cityDisplay}
          highlight={!!state.city}
          active={activePanel === 'location'}
          onClick={() => onSegment?.('location')}
        />
        <MdSegment
          icon={<CalendarDays className="w-4 h-4" />}
          label={dateDisplay}
          highlight={!!(state.checkIn || state.checkOut)}
          active={activePanel === 'dates'}
          onClick={() => onSegment?.('dates')}
        />
        <MdSegment
          icon={<Users className="w-4 h-4" />}
          label={guestsDisplay}
          highlight={totalGuests(state.guests) > 0}
          active={activePanel === 'guests'}
          onClick={() => onSegment?.('guests')}
        />
        {expanded ? (
          <button
            type="button"
            onClick={onSearch}
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
              onSearch?.()
            }}
          >
            <Search className="w-4 h-4 text-white" />
          </span>
        )}
      </div>

      {/* 移动端：单 input 胶囊 */}
      <button
        type="button"
        onClick={onMobileOpen}
        className="md:hidden w-full flex items-center gap-2 border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-500 bg-slate-50 hover:shadow-md transition"
      >
        <Search className="w-4 h-4" />
        <span className="truncate">
          {state.city || '搜索房源'}
          {(state.checkIn || state.checkOut) && ` · ${dateDisplay}`}
        </span>
      </button>
    </>
  )
}

/** md 胶囊单段 */
function MdSegment({
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

/** lg 大搜索条单段（上标题下值两行） */
function LgSegment({
  icon,
  label,
  text,
  dim = false,
  active,
  onClick,
  flexClass = 'flex-1',
}: {
  icon: React.ReactNode
  label: string
  text: string
  dim?: boolean
  active: boolean
  onClick: () => void
  flexClass?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${flexClass} flex items-center gap-2.5 px-5 py-2 rounded-full cursor-pointer transition min-w-0 text-left ${
        active ? 'bg-white shadow-md' : 'hover:bg-white/60'
      }`}
    >
      <span className={`flex-shrink-0 ${active ? 'text-slate-900' : 'text-slate-400'}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-900">{label}</div>
        <div className={`text-sm truncate ${dim ? 'text-slate-500' : 'text-slate-900 font-medium'}`}>
          {text}
        </div>
      </div>
    </button>
  )
}

/** 格式化单个日期为「M月D日」 */
function fmtDate(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

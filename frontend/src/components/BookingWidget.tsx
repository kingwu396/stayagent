import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { ListingDetail } from '@/types/listing'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'
import { bookingsApi } from '@/api/bookings'
import { DatePickerPanel } from './DatePickerPanel'
import { GuestsPanel, type GuestsValue } from './GuestsPanel'
import { PriceBreakdown } from './PriceBreakdown'

interface BookingWidgetProps {
  listing: ListingDetail
}

function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0
  const a = new Date(checkIn).getTime()
  const b = new Date(checkOut).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

/** 2026/04/12 中文短格式 */
function formatDateShort(iso: string): string {
  if (!iso) return '选择日期'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`
}

/** 2026年11月12日 全中文格式 */
function formatDateFull(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${y}年${m}月${d}日`
}

function totalGuests(g: GuestsValue): number {
  return g.adults + g.children
}

function guestsLabel(g: GuestsValue): string {
  const total = totalGuests(g)
  if (total <= 0) return '1 位客人'
  return `${total} 位客人`
}

export function BookingWidget({ listing }: BookingWidgetProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const toast = useToast()

  const [checkIn, setCheckIn] = useState(todayISO())
  const [checkOut, setCheckOut] = useState(todayISO(3))
  const [guests, setGuests] = useState<GuestsValue>({ adults: 1, children: 0, infants: 0, pets: 0 })

  const [openPanel, setOpenPanel] = useState<'dates' | 'guests' | null>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  // 日期+人数卡片: 桌面端 popover portal 到 body 后按它的视口坐标定位
  const anchorRef = useRef<HTMLDivElement>(null)

  const pricePerNight = parseFloat(listing.price_per_night)
  const cleaningFee = parseFloat(listing.cleaning_fee)
  const serviceFee = parseFloat(listing.service_fee)

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut])
  const subtotal = pricePerNight * Math.max(0, nights)
  const total = subtotal + cleaningFee + serviceFee
  const nightlySum = pricePerNight * Math.max(0, nights)
  const saved = Math.max(0, Math.round(nightlySum * 0.18))

  // 入住人数校验: 成人+儿童 不能超 max_guests (婴幼儿/宠物独立)
  const maxGuests = listing.max_guests
  const guestsCount = guests.adults + guests.children
  const guestsOverLimit = guestsCount > maxGuests

  // 点击外部关闭面板
  // Block 23: Esc 关闭日期/人数弹层
  useEffect(() => {
    if (!openPanel) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPanel])

  useEffect(() => {
    if (!openPanel) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as Element
      if (widgetRef.current?.contains(target)) return
      // 移动端日期抽屉 portal 到了 document.body, 不在 widgetRef 内, 也要算"内部"
      if (target.closest?.('[data-booking-popover]')) return
      setOpenPanel(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [openPanel])

  // 接收日历的 onChange (只选了 checkIn 时 cOut 为空, 此时保持弹窗打开;
  // 选完两个日期后才关闭)
  function onDateChange(cIn: string, cOut: string) {
    setCheckIn(cIn)
    setCheckOut(cOut)
    if (cIn && cOut) {
      setOpenPanel(null)
    }
  }

  function clearDates() {
    const t = todayISO()
    setCheckIn(t)
    setCheckOut(todayISO(3))
  }

  // 人数受 listing.max_guests 约束 (婴幼儿/宠物独立计数)
  function onGuestsChange(next: GuestsValue) {
    const total = next.adults + next.children
    if (total > maxGuests) {
      toast.warning(`此房源最多可入住 ${maxGuests} 位客人(不包括婴幼儿)`)
      return
    }
    setGuests(next)
  }

  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onBook() {
    if (!user) {
      navigate('/login')
      return
    }
    if (nights < 1) {
      toast.warning('请选择有效的入住 / 退房日期')
      return
    }
    if (guestsOverLimit) {
      toast.warning(`此房源最多可入住 ${maxGuests} 位客人`)
      return
    }
    setIsSubmitting(true)
    try {
      // Block 26: 创建后进入支付页(待支付), 支付成功才确认
      const booking = await bookingsApi.create({
        listing_id: listing.id,
        check_in: checkIn,
        check_out: checkOut,
        guests: Math.max(1, totalGuests(guests)),
      })
      toast.success('订单已创建, 请完成支付')
      navigate(`/payment/${booking.id}`)
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || '预订失败'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const buttonText = user ? '预订' : '登录后预订'

  return (
    <div ref={widgetRef} className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sticky top-24">
      {/* 价格头 */}
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900">
            ¥{Math.round(pricePerNight).toLocaleString()}
          </span>
          <span className="text-slate-500 text-sm">CNY</span>
          {nights > 0 && (
            <span className="text-slate-500 text-sm ml-1">/ {nights} 晚</span>
          )}
        </div>
        {saved > 0 && nights > 0 ? (
          <span className="text-xs font-medium text-emerald-600">
            已省 ¥{saved.toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-slate-400">已含税费</span>
        )}
      </div>

      {/* 日期 + 人数: 单卡片边框 */}
      <div ref={anchorRef} className="border border-slate-300 rounded-xl overflow-visible mt-4 relative">
        {/* 日期行 */}
        <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300">
          <button
            type="button"
            onClick={() => setOpenPanel((p) => (p === 'dates' ? null : 'dates'))}
            className="text-left px-4 py-3 hover:bg-slate-50 transition rounded-tl-xl"
          >
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-900">
              入住日期
            </div>
            <div className="text-sm text-slate-700 mt-0.5">
              {formatDateShort(checkIn)}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setOpenPanel((p) => (p === 'dates' ? null : 'dates'))}
            className="text-left px-4 py-3 hover:bg-slate-50 transition rounded-tr-xl"
          >
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-900">
              退房日期
            </div>
            <div className="text-sm text-slate-700 mt-0.5">
              {formatDateShort(checkOut)}
            </div>
          </button>
        </div>
        {/* 房客行 */}
        <button
          type="button"
          onClick={() => setOpenPanel((p) => (p === 'guests' ? null : 'guests'))}
          className="w-full flex items-center justify-between text-left px-4 py-3 hover:bg-slate-50 transition rounded-b-xl"
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-900">
              房客
            </div>
            <div className="text-sm text-slate-700 mt-0.5">
              {guestsLabel(guests)}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openPanel === 'guests' ? 'rotate-180' : ''}`} />
        </button>

        {/* 日期弹出面板 (Airbnb 风格: 双月 + 已选 chip + 顶/底栏; portal 到 body, 避开页面 stacking context) */}
        {openPanel === 'dates' && (
          <DatePickerPopover
            checkIn={checkIn}
            checkOut={checkOut}
            onChange={onDateChange}
            onClear={clearDates}
            onClose={() => setOpenPanel(null)}
            nights={nights}
            anchorRef={anchorRef}
          />
        )}

        {/* 人数弹出面板 (Airbnb 风格: 4 类 + 房源限制提示 + 关闭) */}
        {openPanel === 'guests' && (
          <GuestsPopover
            value={guests}
            onChange={onGuestsChange}
            maxGuests={maxGuests}
            onClose={() => setOpenPanel(null)}
          />
        )}
      </div>

      {/* 预订按钮 */}
      <button
        onClick={onBook}
        disabled={isSubmitting || nights < 1 || guestsOverLimit}
        className="w-full mt-5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl transition shadow-md disabled:cursor-not-allowed"
      >
        {isSubmitting ? '预订中…' : buttonText}
      </button>

      <p className="text-xs text-slate-500 mt-3 text-center">
        您现在不会被收费
      </p>

      {/* 价格拆解 */}
      {nights >= 1 && (
        <div className="mt-5 pt-5 border-t border-slate-200">
          <PriceBreakdown
            pricePerNight={pricePerNight}
            nights={nights}
            cleaningFee={cleaningFee}
            serviceFee={serviceFee}
          />
        </div>
      )}
      {nights < 1 && (
        <p className="text-xs text-amber-600 mt-4 text-center">
          请选择有效的入住 / 退房日期
        </p>
      )}
    </div>
  )
}

// ============ 日期弹窗 (Airbnb 风格) ============

interface DatePickerPopoverProps {
  checkIn: string
  checkOut: string
  onChange: (cIn: string, cOut: string) => void
  onClear: () => void
  onClose: () => void
  nights: number
  /** 日期+人数卡片 ref, 桌面端 fixed 定位锚点 */
  anchorRef: RefObject<HTMLDivElement | null>
}

/** 视口 < 768px 判定 (与 Tailwind md 断点一致), resize 时同步 */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    function onResize() { setMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
}

function DatePickerPopover({
  checkIn,
  checkOut,
  onChange,
  onClear,
  onClose,
  nights,
  anchorRef,
}: DatePickerPopoverProps) {
  // 必须 portal 到 document.body:
  // 页面过渡层 (PageTransition 的 framer transform) 会给详情页创建独立 stacking context,
  // 弹层 z-50 逃不出去, 会被轮播图/底部预订栏/FAB 穿透遮挡 —— 移动端桌面端都一样
  const isMobile = useIsMobile()

  // 桌面端: fixed 定位, 锚点卡片下缘居中; scroll/resize 实时跟随
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    if (isMobile) return
    function update() {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const half = 340 // popover 宽 680 的一半
      setPos({
        left: Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8),
        top: r.bottom + 8,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true) // capture: 页面/容器滚动都触发
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [isMobile, anchorRef])

  const body = (
    <>
      {/* 顶部: 左侧 nights 摘要, 右侧 已选日期 chip (窄屏纵排防挤压) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 md:px-6 pt-3 md:pt-5 pb-3 gap-3">
        <div className="flex-shrink-0">
          <div className="text-2xl font-bold text-slate-900">
            {nights > 0 ? `${nights}晚` : '选择日期'}
          </div>
          {checkIn && checkOut && nights > 0 && (
            <div className="text-sm text-slate-600 mt-1">
              {formatDateFull(checkIn)} - {formatDateFull(checkOut)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
          {checkIn && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-700">
              <span className="text-slate-500">入住日期</span>
              <span className="font-medium">{formatDateShort(checkIn)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClear()
                }}
                className="ml-1 w-4 h-4 rounded-full bg-slate-300 text-white text-[10px] leading-none flex items-center justify-center hover:bg-slate-500 transition"
                aria-label="清除入住"
              >
                ×
              </button>
            </span>
          )}
          {checkOut && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-700">
              <span className="text-slate-500">退房日期</span>
              <span className="font-medium">{formatDateShort(checkOut)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClear()
                }}
                className="ml-1 w-4 h-4 rounded-full bg-slate-300 text-white text-[10px] leading-none flex items-center justify-center hover:bg-slate-500 transition"
                aria-label="清除退房"
              >
                ×
              </button>
            </span>
          )}
        </div>
      </div>

      {/* 日历: 双月视图 */}
      <div className="px-6 pb-2">
        <DatePickerPanel
          checkIn={checkIn}
          checkOut={checkOut}
          variant="double"
          onChange={onChange}
        />
      </div>

      {/* 底部: 清除 / 关闭 */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onClear}
          className="px-4 py-2 text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-brand-600 transition"
        >
          清除日期
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition"
        >
          关闭
        </button>
      </div>
    </>
  )

  // 移动端: portal 到 body 的全宽底部抽屉 (遮罩 + 把手 + 限高 + 安全区)
  if (isMobile) {
    return createPortal(
      <>
        <div
          data-booking-popover
          className="fixed inset-0 bg-black/40 z-[45]"
          onClick={onClose}
        />
        <div
          data-booking-popover
          className="fixed inset-x-0 bottom-0 z-50 bg-white shadow-2xl border-t border-slate-200 rounded-t-2xl max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] animate-expand-down"
        >
          {/* 抽屉把手 */}
          <div className="flex justify-center pt-2">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
          {body}
        </div>
      </>,
      document.body
    )
  }

  // 桌面端: 同样 portal 到 body, fixed 定位跟随锚点卡片
  return createPortal(
    <div
      data-booking-popover
      className="fixed z-30 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-expand-down w-[680px] max-w-[calc(100vw-2rem)]"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        transform: 'translateX(-50%)',
        visibility: pos ? 'visible' : 'hidden', // 首次定位完成前不闪现
      }}
    >
      {body}
    </div>,
    document.body
  )
}

// ============ 人数弹窗 (Airbnb 风格) ============

interface GuestsPopoverProps {
  value: GuestsValue
  onChange: (v: GuestsValue) => void
  maxGuests: number
  onClose: () => void
}

function GuestsPopover({ value, onChange, maxGuests, onClose }: GuestsPopoverProps) {
  return (
    <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-expand-down w-[360px] max-w-[calc(100vw-2rem)]">
      <GuestsPanel value={value} onChange={onChange} />

      {/* 房源限制提示 */}
      <div className="px-5 pb-4 pt-1">
        <p className="text-xs text-slate-500 leading-relaxed">
          此房源最多可入住 {maxGuests} 名客人(不包括婴幼儿)。
          不允许携带宠物入住。
        </p>
      </div>

      {/* 底部: 关闭 */}
      <div className="flex items-center justify-end px-5 py-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition"
        >
          关闭
        </button>
      </div>
    </div>
  )
}

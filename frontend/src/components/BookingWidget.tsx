import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import type { ListingDetail } from '@/types/listing'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'
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

export function BookingWidget({ listing }: BookingWidgetProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const toast = useToast()

  const [checkIn, setCheckIn] = useState(todayISO())
  const [checkOut, setCheckOut] = useState(todayISO(3))
  const [guests, setGuests] = useState(1)

  const pricePerNight = parseFloat(listing.price_per_night)
  const cleaningFee = parseFloat(listing.cleaning_fee)
  const serviceFee = parseFloat(listing.service_fee)

  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut])

  // 日期校验：checkOut 不能 <= checkIn
  function onCheckInChange(v: string) {
    setCheckIn(v)
    if (checkOut && v >= checkOut) {
      const next = new Date(v)
      next.setDate(next.getDate() + 1)
      setCheckOut(next.toISOString().slice(0, 10))
    }
  }

  function onCheckOutChange(v: string) {
    if (checkIn && v <= checkIn) {
      toast.warning('退房日期需晚于入住日期')
      return
    }
    setCheckOut(v)
  }

  function onGuests(delta: number) {
    setGuests((g) => Math.max(1, Math.min(listing.max_guests, g + delta)))
  }

  function onBook() {
    if (!user) {
      navigate('/login')
      return
    }
    toast.info('预订功能将在 Block 7 上线 🚀')
  }

  const buttonText = user ? '立即预订' : '登录后预订'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sticky top-24">
      {/* 价格 */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <span className="text-2xl font-bold text-slate-900">
            ¥{Math.round(pricePerNight)}
          </span>
          <span className="text-slate-500 ml-1">/晚</span>
        </div>
        <div className="text-sm text-slate-600">
          ★ {parseFloat(listing.rating).toFixed(1)} ({listing.review_count})
        </div>
      </div>

      {/* 日期 + 人数 */}
      <div className="border border-slate-300 rounded-xl overflow-hidden mb-4">
        <div className="grid grid-cols-2 divide-x divide-slate-300 border-b border-slate-300">
          <DateField
            label="入住"
            value={checkIn}
            onChange={onCheckInChange}
          />
          <DateField
            label="退房"
            value={checkOut}
            onChange={onCheckOutChange}
            min={checkIn || undefined}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <div>
            <div className="text-xs font-semibold text-slate-900">人数</div>
            <div className="text-sm text-slate-500">
              {guests} 位客人 · 最多 {listing.max_guests} 位
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onGuests(-1)}
              disabled={guests <= 1}
              className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:border-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="减少人数"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium w-6 text-center">{guests}</span>
            <button
              type="button"
              onClick={() => onGuests(+1)}
              disabled={guests >= listing.max_guests}
              className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center hover:border-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
              aria-label="增加人数"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* PriceBreakdown */}
      <PriceBreakdown
        pricePerNight={pricePerNight}
        nights={nights}
        cleaningFee={cleaningFee}
        serviceFee={serviceFee}
      />

      {/* 预订按钮 */}
      <button
        onClick={onBook}
        className="w-full mt-6 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold py-3.5 rounded-xl transition shadow-md"
      >
        {buttonText}
      </button>

      {nights < 1 && (
        <p className="text-xs text-amber-600 mt-3 text-center">
          请选择有效的入住 / 退房日期
        </p>
      )}
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
  min,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min?: string
}) {
  return (
    <div className="px-3 py-2">
      <div className="text-xs font-semibold text-slate-900">{label}</div>
      <input
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm text-slate-700 outline-none bg-transparent"
      />
    </div>
  )
}

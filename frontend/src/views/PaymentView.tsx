/** Block 26: 支付页(Airbnb checkout 风格, 全模拟支付)
 *
 * 流程: 进入 → 加载订单 → 选支付方式 → 「支付」→ 创建支付单 + 模拟网关(1.2s 处理动画)
 *     → 成功态(✅ 动画 + 订单号 + 查看行程)
 * 边界: 已 confirmed → 直接显示已支付;cancelled/过期 → 订单失效提示;
 *      15 分钟倒计时(与后端惰性过期一致), 归零提示已超时。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Check, ChevronRight, Smartphone, MessageCircle,
  CreditCard, Loader2, ShieldCheck,
} from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { bookingsApi } from '@/api/bookings'
import { paymentsApi } from '@/api/payments'
import { useToast } from '@/hooks/useToast'
import type { Booking } from '@/types/booking'
import { PLACEHOLDER_IMAGE } from '@/lib/placeholder'
import type { Payment, PaymentMethod } from '@/types/payment'

const METHODS: { key: PaymentMethod; label: string; desc: string; icon: typeof Smartphone; bg: string }[] = [
  { key: 'alipay', label: '支付宝', desc: '推荐使用', icon: Smartphone, bg: 'bg-blue-500' },
  { key: 'wechat', label: '微信支付', desc: '微信快捷支付', icon: MessageCircle, bg: 'bg-green-500' },
  { key: 'card', label: '银行卡', desc: '储蓄卡 / 信用卡', icon: CreditCard, bg: 'bg-slate-700' },
]

/** 与后端惰性过期一致的 15 分钟时限 */
const EXPIRE_MS = 15 * 60 * 1000

function fmtMoney(v: string | number): string {
  return `¥${parseFloat(String(v)).toFixed(2)}`
}

export function PaymentView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('alipay')
  const [paying, setPaying] = useState(false)
  // 轮询闭包里读最新 paying 状态用 (state 在 effect 闭包里会 stale)
  const payingRef = useRef(false)
  const [paidPayment, setPaidPayment] = useState<Payment | null>(null)

  // 加载订单
  useEffect(() => {
    const numId = parseInt(id ?? '', 10)
    if (Number.isNaN(numId)) {
      setLoadError('订单 ID 无效')
      setIsLoading(false)
      return
    }
    const fetchBooking = () =>
      bookingsApi.getById(numId).then((b) => {
        // paying 中不覆盖 (支付成功瞬间轮询可能带回旧 pending 数据, 让位给 paidPayment 流程)
        if (!payingRef.current) setBooking(b)
      })
    fetchBooking()
      .catch((err: any) => setLoadError(err.response?.data?.detail || err.message || '订单加载失败'))
      .finally(() => setIsLoading(false))

    // 房东取消/后台惰性过期无推送 — 页面可见时每 15s 静默轮询,
    // booking 变 cancelled/confirmed 后自动切「订单已失效」/「已支付」视图
    const refresh = () => {
      if (document.visibilityState !== 'visible' || payingRef.current) return
      fetchBooking().catch(() => {}) // 轮询失败不打扰用户
    }
    const t = setInterval(refresh, 15000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', refresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 15 分钟倒计时(从订单创建时间起算, 与后端惰性过期一致)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const remainMs = useMemo(() => {
    if (!booking) return 0
    const deadline = new Date(booking.created_at).getTime() + EXPIRE_MS
    return Math.max(0, deadline - now)
  }, [booking, now])
  const remainText = useMemo(() => {
    const total = Math.floor(remainMs / 1000)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }, [remainMs])

  async function handlePay() {
    if (!booking || paying) return
    setPaying(true)
    payingRef.current = true
    try {
      // 1. 创建/复用支付单 2. 模拟网关支付(前端加 1.2s 处理动画增强真实感)
      const payment: Payment = await paymentsApi.create({ booking_id: booking.id, method })
      const [paid] = await Promise.all([
        paymentsApi.pay(payment.id),
        new Promise((r) => setTimeout(r, 1200)),
      ])
      setPaidPayment(paid)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || '支付失败')
      // 支付失败可能因房东已取消/订单已过期 — 立即拉一次最新状态切视图
      bookingsApi
        .getById(booking.id)
        .then(setBooking)
        .catch(() => {})
    } finally {
      setPaying(false)
      payingRef.current = false
    }
  }

  const expired = remainMs <= 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶栏 */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">S</div>
            <span className="text-base font-bold text-slate-900">StayAgent</span>
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        )}

        {!isLoading && loadError && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <div className="text-rose-500 mb-2">{loadError}</div>
            <Link to="/" className="text-brand-500 hover:underline text-sm">返回首页</Link>
          </div>
        )}

        {!isLoading && !loadError && booking && (
          <>
            {/* 成功态 */}
            {paidPayment ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4 animate-pop-in-center">
                  <Check className="w-9 h-9 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">支付成功!</h1>
                <p className="text-sm text-slate-500 mb-6">
                  订单 #{booking.id} · {fmtMoney(paidPayment.amount)} · {METHODS.find((m) => m.key === paidPayment.method)?.label}
                </p>
                <button
                  onClick={() => navigate('/trips')}
                  className="px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-xl transition"
                >
                  查看行程
                </button>
              </div>
            ) : expired ? (
              /* 过期态 */
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <h1 className="text-xl font-bold text-slate-900 mb-2">订单已超时</h1>
                <p className="text-sm text-slate-500 mb-6">该订单超过 15 分钟未支付, 已自动取消。</p>
                <Link to="/search" className="text-brand-500 hover:underline text-sm">重新选房</Link>
              </div>
            ) : booking.status === 'confirmed' ? (
              /* 已支付(重复进入) */
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-9 h-9 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">该订单已支付</h1>
                <button
                  onClick={() => navigate('/trips')}
                  className="mt-4 px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-xl transition"
                >
                  查看行程
                </button>
              </div>
            ) : booking.status !== 'pending' ? (
              /* 已取消等失效态 */
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <h1 className="text-xl font-bold text-slate-900 mb-2">订单已失效</h1>
                <p className="text-sm text-slate-500 mb-6">该订单当前状态为「{booking.status}」, 无法支付。</p>
                <Link to="/search" className="text-brand-500 hover:underline text-sm">重新选房</Link>
              </div>
            ) : (
              /* 待支付: 摘要 + 方式 + 支付按钮 */
              <>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold text-slate-900">确认并支付</h1>
                  <div className="text-sm text-slate-500">
                    支付剩余时间 <span className="font-mono font-semibold text-brand-500">{remainText}</span>
                  </div>
                </div>

                {/* 订单摘要 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-5">
                  <div className="flex gap-4">
                    <img
                      src={booking.listing.primary_image || PLACEHOLDER_IMAGE}
                      alt={booking.listing.title}
                      className="w-24 h-24 rounded-xl object-cover bg-slate-100 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900">{booking.listing.title}</div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        {booking.listing.city}, {booking.listing.country}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {booking.check_in} → {booking.check_out} · {booking.nights} 晚 · {booking.guests} 位客人
                      </div>
                      <div className="mt-2 text-right">
                        <span className="text-lg font-bold text-slate-900">{fmtMoney(booking.total)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 mt-3 pt-3 text-xs text-slate-500">
                    房租 {fmtMoney(booking.subtotal)} + 清洁费 {fmtMoney(booking.cleaning_fee)} + 服务费 {fmtMoney(booking.service_fee)}
                  </div>
                </div>

                {/* 支付方式 */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
                  <div className="text-sm font-semibold text-slate-900 mb-3">支付方式</div>
                  <div className="space-y-2">
                    {METHODS.map((m) => {
                      const Icon = m.icon
                      const active = method === m.key
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setMethod(m.key)}
                          className={`w-full flex items-center gap-3 p-3 border rounded-xl transition text-left ${
                            active ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${m.bg}`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900">{m.label}</div>
                            <div className="text-xs text-slate-400">{m.desc}</div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              active ? 'border-brand-500' : 'border-slate-300'
                            }`}
                          >
                            {active && <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                    演示环境模拟支付, 不会产生真实扣款
                  </div>
                </div>

                {/* 支付按钮 */}
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white font-medium py-3.5 rounded-xl transition"
                >
                  {paying && <Loader2 className="w-4 h-4 animate-spin" />}
                  {paying ? '支付处理中…' : `支付 ${fmtMoney(booking.total)}`}
                </button>
                <Link
                  to="/"
                  className="flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-slate-900 mt-4 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  暂不支付, 返回首页
                </Link>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

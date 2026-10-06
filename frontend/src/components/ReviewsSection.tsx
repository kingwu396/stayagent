import { useState, useMemo } from 'react'
import { Sparkles, CheckCircle2, KeyRound, MessageCircle, MapPin, Tag, Camera, ChevronDown, ChevronRight } from 'lucide-react'
import type { ListingDetail } from '@/types/listing'

interface ReviewsSectionProps {
  listing: ListingDetail
}

// ============ 确定性 hash (基于 listing.id) ============

function hash(n: number, salt: number): number {
  // xorshift32 风格 hash, 范围 [0, 1)
  let x = (n * 2654435761) ^ (salt * 374761393)
  x = (x ^ (x >>> 13)) * 1274126177
  x = x ^ (x >>> 16)
  return ((x >>> 0) % 10000) / 10000
}

function rangeHash(id: number, salt: number, lo: number, hi: number): number {
  return lo + hash(id, salt) * (hi - lo)
}

function intHash(id: number, salt: number, lo: number, hi: number): number {
  return Math.floor(rangeHash(id, salt, lo, hi + 0.999))
}

// ============ Mock 池 ============

const SUBRATING_KEYS = [
  { key: 'cleanliness', label: '干净卫生', icon: Sparkles },
  { key: 'accuracy',    label: '如实描述', icon: CheckCircle2 },
  { key: 'checkin',     label: '入住便捷', icon: KeyRound },
  { key: 'communicate', label: '沟通顺畅', icon: MessageCircle },
  { key: 'location',    label: '地段优越', icon: MapPin },
  { key: 'value',       label: '高性价比', icon: Tag },
] as const

const TAG_POOL = [
  { label: '带图',       icon: Camera },
  { label: '景观',       icon: MapPin },
  { label: '洁净程度',   icon: Sparkles },
  { label: '地段',       icon: MapPin },
  { label: '入住',       icon: KeyRound },
  { label: '周边',       icon: MapPin },
  { label: '待客之道',   icon: MessageCircle },
  { label: '步行便利程度', icon: MapPin },
  { label: '周边交通',   icon: MapPin },
  { label: '房间',       icon: Sparkles },
] as const

const REVIEWERS = ['Judy', 'Anna', 'Mark', 'Sophie', 'Leo', 'Yuki', 'Chen', 'Maria'] as const

const REVIEW_TEXTS = [
  '交通便利,环境超级温馨舒适,窗外城景很棒,晚霞洒在窗外整个城市都温柔了,房子设施齐全,家具布置精致很新也很干净,这趟入住之旅很满意,五星好评🌟🌟🌟🌟🌟',
  '我们在这里面度过了美好时光! 公寓非常干净、舒适,景观优美。地理位置优越,位于市中心,前往任何地方都很方便。房东很棒,非常友善,总是快速回复任何问题或疑问,与我们…',
  '房间整洁,装修风格很赞,卫生间的热水也很稳定。位置离地铁站走路 5 分钟,附近有不少咖啡馆和便利店,适合商旅。',
  '入住体验非常棒,房东准备了很多小细节,比如洗衣液、咖啡胶囊、本地地图。床很舒服,一觉到天亮。下次来还会选这里。',
  '景色真的超出预期,早晨的阳光照进客厅特别治愈。设施齐全,WiFi 流畅,工作区也够用。强烈推荐给远程办公的朋友。',
] as const

const PHOTOS = [
  'https://picsum.photos/seed/review-a/200/150',
  'https://picsum.photos/seed/review-b/200/150',
  'https://picsum.photos/seed/review-c/200/150',
  'https://picsum.photos/seed/review-d/200/150',
]

// ============ 组件 ============

export function ReviewsSection({ listing }: ReviewsSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const id = listing.id

  const overall = parseFloat(listing.rating)
  const reviewCount = listing.review_count
  const totalLabel = `${overall.toFixed(1)} · ${reviewCount} 条评价`

  // 总体评分条 (5/4/3/2/1 各占多少)
  const overallBars = useMemo(() => {
    const base = [hash(id, 100), hash(id, 101), hash(id, 102), hash(id, 103), hash(id, 104)]
    // 权重偏 5 星 + 4 星 (主流评价)
    const weights = [0.62, 0.27, 0.06, 0.03, 0.02]
    // 叠加 hash 扰动
    const raw = base.map((h, i) => weights[i] + (h - 0.5) * 0.06)
    const sum = raw.reduce((a, b) => a + b, 0)
    return raw.map((r) => Math.max(0, r / sum))
  }, [id])

  // 6 子维度评分
  const subratings = useMemo(() =>
    SUBRATING_KEYS.map((s, i) => ({
      ...s,
      score: rangeHash(id, 200 + i, 4.5, 5.0),
    })),
    [id])

  // 客人提到 chips (取 8 个)
  const tags = useMemo(() =>
    TAG_POOL.slice(0, 8).map((t, i) => ({
      ...t,
      count: intHash(id, 300 + i, 2, 12),
    })),
    [id])

  // 评论卡 (4 张, 前 2 张默认展示)
  const reviews = useMemo(() =>
    Array.from({ length: 4 }, (_, i) => {
      const monthsAgo = intHash(id, 400 + i, 1, 12)
      const date = new Date()
      date.setMonth(date.getMonth() - monthsAgo)
      const yearMonth = `${date.getFullYear()}年${date.getMonth() + 1}月`
      return {
        id: `${id}-${i}`,
        avatar: `https://i.pravatar.cc/100?u=${id}-reviewer-${i}`,
        name: REVIEWERS[intHash(id, 500 + i, 0, REVIEWERS.length - 1)],
        yearsOnAirbnb: intHash(id, 600 + i, 1, 7),
        stars: 5,
        date: yearMonth,
        text: REVIEW_TEXTS[intHash(id, 700 + i, 0, REVIEW_TEXTS.length - 1)],
        photo: PHOTOS[i % PHOTOS.length],
      }
    }),
    [id])

  const visibleReviews = showAll ? reviews : reviews.slice(0, 2)

  return (
    <section className="border-t border-slate-200 pt-10 pb-2">
      {/* 标题行 */}
      <header className="flex items-center gap-3 mb-6">
        <StarIcon className="w-6 h-6 fill-slate-900 text-slate-900" />
        <h2 className="text-2xl font-bold text-slate-900">{totalLabel}</h2>
        <a
          href="#how-reviews-work"
          className="ml-2 text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
        >
          评价的运作机制
        </a>
      </header>

      {/* 总体评分条 + 6 子维度 */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-6 border-b border-slate-200 pb-8">
        {/* 总体评分条 (1 列) */}
        <div className="md:col-span-1">
          <div className="text-sm font-medium text-slate-900 mb-3">总体评分</div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star, idx) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-3 text-right">{star}</span>
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900 rounded-full"
                    style={{ width: `${overallBars[idx] * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6 子维度 (6 列) */}
        <div className="md:col-span-6 grid grid-cols-3 md:grid-cols-6 gap-x-6 gap-y-6">
          {subratings.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.key} className="flex flex-col items-start">
                <div className="text-sm font-medium text-slate-900">{s.label}</div>
                <div className="text-lg font-semibold text-slate-900 mt-1">
                  {s.score.toFixed(1)}
                </div>
                <Icon className="w-7 h-7 text-slate-700 mt-2" strokeWidth={1.5} />
              </div>
            )
          })}
        </div>
      </div>

      {/* 客人提到 */}
      <div className="py-6 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">客人提到</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((t, i) => {
            const Icon = t.icon
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-full transition"
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                <span className="text-slate-500 ml-0.5">{t.count}</span>
              </span>
            )
          })}
          <button
            type="button"
            className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition"
            aria-label="下一个标签"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 评论卡 2 列 */}
      <div className="py-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        {visibleReviews.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
      </div>

      {reviews.length > 2 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-1 px-5 py-2.5 bg-white border border-slate-900 text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-900 hover:text-white transition"
          >
            {showAll ? '收起' : '显示更多'}
            <ChevronDown className={`w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}
    </section>
  )
}

interface ReviewCard {
  id: string
  avatar: string
  name: string
  yearsOnAirbnb: number
  stars: number
  date: string
  text: string
  photo: string
}

function ReviewCard({ review }: { review: ReviewCard }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <img
          src={review.avatar}
          alt={review.name}
          loading="lazy"
          className="w-11 h-11 rounded-full object-cover bg-slate-100"
        />
        <div>
          <div className="text-sm font-semibold text-slate-900">{review.name}</div>
          <div className="text-xs text-slate-500">
            使用爱彼迎 {review.yearsOnAirbnb} 年
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-700">
        <span className="tracking-wider">{'★'.repeat(review.stars)}</span>
        <span className="text-slate-500">·</span>
        <span>{review.date}</span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
        {review.text}
      </p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <img
          src={review.photo}
          alt={`${review.name} 评价图 1`}
          loading="lazy"
          className="aspect-[4/3] w-full rounded-lg object-cover bg-slate-100"
        />
        <img
          src={`https://picsum.photos/seed/${review.id}-p2/200/150`}
          alt={`${review.name} 评价图 2`}
          loading="lazy"
          className="aspect-[4/3] w-full rounded-lg object-cover bg-slate-100"
        />
      </div>
    </div>
  )
}

function StarIcon(props: React.SVGProps<SVGSVGElement>) {
  // 实心 5 角星 (lucide 没提供 fill 形式, 用这个本地组件)
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  )
}

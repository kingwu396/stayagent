import { useEffect, useRef, useState } from 'react'
import { useWishlistStore } from '@/stores/wishlist'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Hotel, Star, Users, Bed, Bath, ArrowLeft, MapPin } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { ImageGallery } from '@/components/ImageGallery'
import { AmenityList } from '@/components/AmenityList'
import { BookingWidget } from '@/components/BookingWidget'
import { ListingLocationCard } from '@/components/ListingLocationCard'
import { ListingHighlights } from '@/components/ListingHighlights'
import { ReviewsSection } from '@/components/ReviewsSection'
import { MoreListingsCarousel } from '@/components/MoreListingsCarousel'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { listingsApi } from '@/api/listings'
import { recordViewed } from '@/lib/recent'
import { propertyTypeLabel } from '@/lib/labels'
import type { ListingDetail } from '@/types/listing'

/** 由 listing.id 派生"X 年出租经验" */
function hashYears(id: number): number {
  let x = (id * 2654435761) >>> 0
  x = ((x ^ (x >>> 13)) * 1274126177) >>> 0
  return 2 + (x % 8) // 2-9 年
}

/** 检测描述中是否含有非中文字符 (英文短语) 用于显示"翻译提示" */
function hasNonChinese(s: string): boolean {
  return /[A-Za-z]/.test(s)
}

export function ListingDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [listing, setListing] = useState<ListingDetail | null>(null)
  // Block 23: 移动端吸底栏「预订」滚动定位用
  const bookingCardRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 房源介绍: 中英文展示切换
  const [showOriginal, setShowOriginal] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  useEffect(() => {
    if (!id) return
    const numId = parseInt(id, 10)
    if (Number.isNaN(numId) || numId <= 0) {
      setError('房源 ID 无效')
      setIsLoading(false)
      return
    }
    fetchListing(numId)
  }, [id])

  async function fetchListing(numId: number) {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listingsApi.getById(numId)
      setListing(data)
      // 记录到 localStorage「最近浏览」（主页横滑板块用）
      recordViewed(numId)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('房源不存在')
      } else {
        setError(err.response?.data?.detail || err.message || '加载失败')
      }
    } finally {
      setIsLoading(false)
    }
  }
  // 心愿单状态同步
  useEffect(() => {
    useWishlistStore.getState().fetchAll()
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Topbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Hotel className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">StayAgent</span>
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* 返回 */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>

        {/* Loading */}
        {isLoading && <DetailSkeleton />}

        {/* Error */}
        {!isLoading && error && (
          <div className="py-16">
            <ErrorState
              title={error === '房源不存在' ? '找不到这个房源' : '加载失败'}
              description={error === '房源不存在' ? '该房源可能已被删除或链接有误。' : error}
              onRetry={() => { const n = parseInt(id ?? '', 10); if (!Number.isNaN(n)) fetchListing(n) }}
            />
            {!listing && (
              <div className="text-center mt-4">
                <Link to="/" className="text-brand-500 hover:underline">
                  ← 返回首页
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {!isLoading && !error && listing && (
          <div className="space-y-8">
            {/* Title above gallery */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                {listing.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-current text-slate-900" />
                  <span className="font-medium text-slate-900">
                    {parseFloat(listing.rating).toFixed(1)}
                  </span>
                  <span>({listing.review_count} 条评论)</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {listing.city}, {listing.country}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                  {propertyTypeLabel(listing.property_type)}
                </span>
              </div>
            </div>

            {/* Gallery */}
            <ImageGallery images={listing.images} title={listing.title} />

            {/* Grid: details + booking */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 左 2 列：详情 */}
              <div className="lg:col-span-2 space-y-10">
                {/* 房东 + 房型 简介 */}
                <section className="flex items-start justify-between border-b border-slate-200 pb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-1">
                      {listing.property_type === 'hotel' ? '酒店房间' : '整套房源'} 由 {listing.host_name} 出租
                    </h2>
                    <p className="text-slate-600">
                      {listing.max_guests} 位客人 · {listing.bedrooms} 间卧室 · {listing.beds} 张床 · {listing.bathrooms} 间卫生间
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                    {listing.host_name.charAt(0).toUpperCase()}
                  </div>
                </section>

                {/* 6 槽设施亮点 (Airbnb 风格营销文案) */}
                <ListingHighlights amenities={listing.amenities} city={listing.city} />

                {/* 房东卡 (Airbnb 风格: 头像 + 自我介绍) */}
                <section className="border-b border-slate-200 pb-8">
                  <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-700 font-bold text-xl flex-shrink-0">
                        {listing.host_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-base font-semibold text-slate-900">
                          房东: {listing.host_name}
                        </div>
                        <div className="text-sm text-slate-600 mt-0.5">
                          超赞房东 · {hashYears(listing.id)} 年出租经验
                        </div>
                      </div>
                    </div>
                </section>

                {/* 描述 + 翻译提示 */}
                {listing.description && (
                  <section className="border-b border-slate-200 pb-8">
                    {/* 翻译提示 banner (检测到英文才显示) */}
                    {hasNonChinese(listing.description) && (
                      <div className="bg-slate-100 px-4 py-3 rounded-lg flex items-center gap-2 text-sm text-slate-700 mb-5">
                        <span>
                          {showOriginal ? '部分信息以原文展示。' : '部分信息已自动翻译。'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowOriginal((v) => !v)}
                          className="font-semibold text-slate-900 underline underline-offset-2 hover:text-brand-600 transition"
                        >
                          {showOriginal ? '显示译文' : '显示原文'}
                        </button>
                      </div>
                    )}
                    {/* 房源介绍 */}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">房源介绍</h3>
                      <p
                        className={`text-slate-700 leading-relaxed whitespace-pre-line ${
                          descExpanded ? '' : 'line-clamp-4'
                        }`}
                      >
                        {listing.description}
                      </p>
                      {listing.description.length > 200 && (
                        <button
                          type="button"
                          onClick={() => setDescExpanded((v) => !v)}
                          className="mt-3 px-5 py-2.5 bg-white border border-slate-900 text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-900 hover:text-white transition"
                        >
                          {descExpanded ? '收起' : '显示更多'}
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* 完整设施清单 */}
                <section className="border-b border-slate-200 pb-8">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    设施与服务
                  </h3>
                  <AmenityList amenities={listing.amenities} />
                </section>

                {/* 评价区 (Airbnb 风格: 评分条 + 子维度 + chips + 评论卡) */}
                <ReviewsSection listing={listing} />

                {/* 位置 */}
                <section className="pb-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">位置</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    📍 {listing.city}, {listing.country}
                  </p>
                  <ListingLocationCard
                    latitude={listing.latitude}
                    longitude={listing.longitude}
                    city={listing.city}
                    country={listing.country}
                  />
                </section>

                {/* 房型详情 */}
                <section className="pb-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">房型</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <RoomStat icon={<Users className="w-5 h-5" />} label="可住人数" value={`${listing.max_guests} 人`} />
                    <RoomStat icon={<Bed className="w-5 h-5" />} label="卧室" value={`${listing.bedrooms} 间`} />
                    <RoomStat icon={<Bed className="w-5 h-5" />} label="床" value={`${listing.beds} 张`} />
                    <RoomStat icon={<Bath className="w-5 h-5" />} label="卫生间" value={`${listing.bathrooms} 间`} />
                  </div>
                </section>
              </div>

              {/* 右 1 列：粘性预订卡 */}
              <aside ref={bookingCardRef} className="lg:col-span-1">
                <BookingWidget listing={listing} />
              </aside>
            </div>

            {/* 底部: 更多周边房源 (全宽, 不进 grid) */}
            <MoreListingsCarousel city={listing.city} currentListingId={listing.id} />
          </div>
        )}
      </main>

      {/* Block 23: 移动端吸底预订栏 (<lg), 避免预订入口沉在长页底部 */}
      {listing && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pl-4 pr-[76px] py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <span className="text-lg font-bold text-slate-900">
              ¥{Math.round(Number(listing.price_per_night))}
            </span>
            <span className="text-sm text-slate-500"> /晚</span>
            <div className="text-xs text-slate-500 truncate">
              ★ {listing.rating} ({listing.review_count} 条评价)
            </div>
          </div>
          <button
            onClick={() =>
              bookingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="flex-shrink-0 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold rounded-xl transition shadow-md"
          >
            预订
          </button>
        </div>
      )}
      {/* 吸底栏占位, 防止内容被遮 */}
      <div className="lg:hidden h-[72px]" aria-hidden="true" />
    </div>
  )
}

function RoomStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <span className="text-slate-600">{icon}</span>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-[480px] w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-8 mt-8">
        <div className="col-span-2 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  )
}

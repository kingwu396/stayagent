import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Hotel, Star, Users, Bed, Bath, ArrowLeft, MapPin } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { ImageGallery } from '@/components/ImageGallery'
import { AmenityList } from '@/components/AmenityList'
import { BookingWidget } from '@/components/BookingWidget'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { listingsApi } from '@/api/listings'
import type { ListingDetail } from '@/types/listing'

export function ListingDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [listing, setListing] = useState<ListingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
              onRetry={() => listing && fetchListing(listing.id)}
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
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium capitalize">
                  {listing.property_type}
                </span>
              </div>
            </div>

            {/* Gallery */}
            <ImageGallery images={listing.images} title={listing.title} />

            {/* Grid: details + booking */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 左 2 列：详情 */}
              <div className="lg:col-span-2 space-y-8">
                {/* 房东 + 房型 */}
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

                {/* 描述 */}
                {listing.description && (
                  <section className="border-b border-slate-200 pb-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">关于这里</h3>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                      {listing.description}
                    </p>
                  </section>
                )}

                {/* 设施 */}
                <section className="border-b border-slate-200 pb-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    设施与服务
                  </h3>
                  <AmenityList amenities={listing.amenities} />
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
              <aside className="lg:col-span-1">
                <BookingWidget listing={listing} />
              </aside>
            </div>
          </div>
        )}
      </main>
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

import { Link, useNavigate } from 'react-router-dom'
import { Heart, Star } from 'lucide-react'
import type { ListingSummary } from '@/types/listing'
import { formatPrice, formatRating } from '@/lib/utils'
import { useWishlistStore } from '@/stores/wishlist'
import { useAuthStore } from '@/stores/auth'
import { useWishlistPicker } from '@/components/WishlistPickerModal'
import { propertyTypeLabel } from '@/lib/labels'
import { useToast } from '@/hooks/useToast'
import { PLACEHOLDER_IMAGE } from '@/lib/placeholder'
import { setPendingFavorite } from '@/lib/pendingFavorite'

const FALLBACK_IMAGE = PLACEHOLDER_IMAGE

interface ListingCardProps {
  listing: ListingSummary
  /** 当从地图 marker 点击时，传 true 让卡片加 ring 高亮 */
  highlighted?: boolean
}

export function ListingCard({ listing, highlighted }: ListingCardProps) {
  const liked = useWishlistStore((s) => s.has(listing.id))
  const removeFromAll = useWishlistStore((s) => s.removeFromAll)
  const openPicker = useWishlistPicker((s) => s.open)
  const toast = useToast()
  const navigate = useNavigate()

  async function toggleLike(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    // 未登录: 暂存房源 → 跳登录页, 登录成功后自动弹出心愿单选择框
    // (Block 32 权限收紧 + 体验优化: 不再匿名收藏, 但登录后接续收藏动作)
    if (!useAuthStore.getState().token) {
      setPendingFavorite(listing)
      toast.info('登录后即可收藏房源')
      navigate('/login')
      return
    }
    // 已收藏: 再次点红心 = 直接取消 (从所有清单移除), 不弹选择框
    if (liked) {
      await removeFromAll(listing.id)
      toast.success('已取消收藏')
      return
    }
    // 未收藏: 打开「保存到心愿单」选择弹窗
    openPicker(listing)
  }

  return (
    <Link
      to={`/listings/${listing.id}`}
      className={`group block rounded-xl overflow-hidden transition-all duration-300 ${highlighted ? 'ring-4 ring-brand-500 ring-offset-2 rounded-2xl' : ''}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        <img
          src={listing.primary_image || FALLBACK_IMAGE}
          alt={listing.title}
          loading="lazy"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = FALLBACK_IMAGE
          }}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        <button
          onClick={toggleLike}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:scale-110 transition"
          aria-label="收藏"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              liked ? 'fill-red-500 text-red-500' : 'text-slate-700'
            }`}
          />
        </button>

        {listing.property_type && (
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-slate-700">
            {propertyTypeLabel(listing.property_type)}
          </div>
        )}
      </div>

      <div className="pt-3 px-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm text-slate-900 font-semibold truncate flex-1">
            {listing.title}
          </h3>
          <div className="flex items-center gap-1 text-sm flex-shrink-0">
            <Star className="w-3.5 h-3.5 fill-current text-slate-900" />
            <span className="text-slate-900 font-medium">
              {formatRating(listing.rating, listing.review_count)}
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-500 mb-1">
          {listing.city}, {listing.country}
        </p>

        <p className="text-sm text-slate-900">
          <span className="font-semibold">{formatPrice(listing.price_per_night)}</span>
          <span className="text-slate-500"> /晚</span>
        </p>
      </div>
    </Link>
  )
}

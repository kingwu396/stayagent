import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Star } from 'lucide-react'
import type { ListingSummary } from '@/types/listing'
import { formatPrice, formatRating } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'

const FALLBACK_IMAGE = 'https://picsum.photos/seed/placeholder/400/300'

interface ListingCardProps {
  listing: ListingSummary
}

export function ListingCard({ listing }: ListingCardProps) {
  const toast = useToast()
  const [liked, setLiked] = useState(false)
  const [imgError, setImgError] = useState(false)

  const imageSrc = imgError || !listing.primary_image
    ? FALLBACK_IMAGE
    : listing.primary_image

  function toggleLike(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLiked((v) => !v)
    toast.info(
      liked ? '收藏功能将在 Block 7 上线 ❤️' : '收藏功能将在 Block 7 上线 🚀'
    )
  }

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group block rounded-xl overflow-hidden"
    >
      {/* 图片容器 */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
        <img
          src={imageSrc}
          alt={listing.title}
          loading="lazy"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* 右上角心形按钮 */}
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

        {/* 类型徽章 */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-md text-xs font-medium text-slate-700 capitalize">
          {listing.property_type}
        </div>
      </div>

      {/* 信息 */}
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

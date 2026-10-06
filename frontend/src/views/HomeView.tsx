import { useEffect, useRef, useState, useCallback } from 'react'
import { useWishlistStore } from '@/stores/wishlist'
import { Link } from 'react-router-dom'
import { Hotel } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { HeroSearch } from '@/components/HeroSearch'
import { CompactTopbar } from '@/components/CompactTopbar'
import { CategoryStrip } from '@/components/CategoryStrip'
import { motion } from 'framer-motion'
import { ListingCard } from '@/components/ListingCard'
import { ListingCardSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { listingsApi } from '@/api/listings'
import type { ListingSummary, CityInfo } from '@/types/listing'

export function HomeView() {
  const [listings, setListings] = useState<ListingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCompact, setShowCompact] = useState(false)
  const [cities, setCities] = useState<CityInfo[]>([])
  const heroRef = useRef<HTMLDivElement>(null)

  // 滚过 hero 80% 后显示紧凑搜索条
  useEffect(() => {
    function onScroll() {
      if (!heroRef.current) return
      const rect = heroRef.current.getBoundingClientRect()
      // hero 底部到视口顶部距离 < 80px → 显示
      setShowCompact(rect.bottom < 80)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const fetchListings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listingsApi.list({ page: 1, page_size: 20 })
      setListings(data.items)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '加载失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  // 心愿单状态同步（保证 ListingCard 红心与服务端一致）
  useEffect(() => {
    useWishlistStore.getState().fetchAll()
  }, [])

  // 拉城市列表（HeroSearch 推荐目的地用）
  useEffect(() => {
    listingsApi.cities().then(setCities).catch(() => setCities([]))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== 紧凑条（滚过 hero 后出现） ===== */}
      <CompactTopbar visible={showCompact} />

      {/* ===== Topbar（滚过 hero 后隐藏） ===== */}
      <header
        className={`sticky top-0 z-30 bg-white border-b border-slate-200 backdrop-blur-sm transition-all duration-300 ease-out ${
          showCompact ? 'opacity-0 -translate-y-full pointer-events-none' : 'opacity-100 translate-y-0'
        }`}
      >
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

      {/* ===== Hero 搜索栏 ===== */}
      <HeroSearch ref={heroRef} recommended={cities} />

      {/* ===== 分类条 ===== */}
      <CategoryStrip />

      {/* ===== 推荐房源 ===== */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          推荐房源
          {!isLoading && listings.length > 0 && (
            <span className="text-sm font-normal text-slate-500 ml-2">
              {listings.length} 处
            </span>
          )}
        </h2>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <ErrorState
            description={error}
            onRetry={fetchListings}
          />
        )}

        {!isLoading && !error && listings.length === 0 && (
          <EmptyState
            title="暂无房源"
            description="演示数据为空，请运行 make seed 填充数据"
          />
        )}

        {!isLoading && !error && listings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {listings.map((l, idx) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.5), ease: 'easeOut' }}
              >
                <ListingCard listing={l} />
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <FooterColumn
              title="StayAgent"
              links={[
                { label: '关于我们', href: '#' },
                { label: '招新', href: '#' },
              ]}
            />
            <FooterColumn
              title="支持"
              links={[
                { label: '帮助中心', href: '#' },
                { label: '联系客服', href: '#' },
              ]}
            />
            <FooterColumn
              title="开发"
              links={[
                { label: 'API 文档', href: 'http://127.0.0.1:8000/docs', external: true },
                { label: 'GitHub', href: '#' },
              ]}
            />
          </div>
          <div className="pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
            © 2026 StayAgent · AI Travel Agent Demo
          </div>
        </div>
      </footer>
    </div>
  )
}

interface FooterLink {
  label: string
  href: string
  external?: boolean
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900 mb-3">{title}</h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              className="text-sm text-slate-500 hover:text-slate-900 transition"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

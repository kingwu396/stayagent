import { useEffect, useRef, useState, useCallback } from 'react'
import { useWishlistStore } from '@/stores/wishlist'
import { Link } from 'react-router-dom'
import { Hotel, ChevronRight } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { SearchPill, PillFrame } from '@/components/SearchPill'
import { CategoryStrip } from '@/components/CategoryStrip'
import { WelcomeBack } from '@/components/WelcomeBack'
import { SectionCarousel, CarouselCard } from '@/components/SectionCarousel'
import { motion } from 'framer-motion'
import { ListingCard } from '@/components/ListingCard'
import { ListingCardSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { listingsApi } from '@/api/listings'
import { getViewedIds } from '@/lib/recent'
import { EMPTY_SEARCH, type CompactSearchState } from '@/hooks/useCompactSearch'
import type { ListingSummary, CityInfo } from '@/types/listing'

const HOT_CITIES = ['东京', '曼谷', '巴厘岛', '巴黎']

export function HomeView() {
  const [listings, setListings] = useState<ListingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 搜索条位置：hero = 页面中部大搜索条；top = 顶栏胶囊。
  // 两个槽位挂同一个 framer-motion layoutId，切换时自动飞行 morph（同 Airbnb）
  const [barPos, setBarPos] = useState<'hero' | 'top'>('hero')
  const [cities, setCities] = useState<CityInfo[]>([])
  // Hero 大搜索栏与顶栏胶囊共享同一份搜索状态，切换时内容连续
  const [sharedSearch, setSharedSearch] = useState<CompactSearchState>(EMPTY_SEARCH)
  const [recentItems, setRecentItems] = useState<ListingSummary[]>([])
  const [hotItems, setHotItems] = useState<ListingSummary[]>([])
  const searchBarRef = useRef<HTMLDivElement>(null)

  // 搜索条槽位顶部贴住顶栏 → 飞到顶栏；回滚到其下方 → 飞回 Hero。
  // 两个阈值形成滞回带，避免在临界点来回抖动
  useEffect(() => {
    function onScroll() {
      const el = searchBarRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      setBarPos((prev) => (prev === 'top' ? (top <= 88 ? 'top' : 'hero') : top <= 60 ? 'top' : 'hero'))
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

  // 拉城市列表（搜索条推荐目的地用）
  useEffect(() => {
    listingsApi.cities().then(setCities).catch(() => setCities([]))
  }, [])

  // 最近浏览：localStorage ids → 批量取回（后端按传入顺序返回；已下架的自动消失）
  useEffect(() => {
    const ids = getViewedIds()
    if (ids.length === 0) {
      setRecentItems([])
      return
    }
    listingsApi
      .list({ ids, page_size: 20 })
      .then((d) => setRecentItems(d.items))
      .catch(() => setRecentItems([]))
  }, [])

  // 热门房源：按浏览量降序
  useEffect(() => {
    listingsApi
      .list({ sort: 'view_count', page: 1, page_size: 12 })
      .then((d) => setHotItems(d.items))
      .catch(() => setHotItems([]))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ===== 顶栏（常驻）：logo + 搜索条槽位 + 用户菜单 ===== */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4 md:gap-6">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Hotel className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">StayAgent</span>
          </Link>

          {/* 顶栏槽位：隐形 md 占位顶住高度；barPos='top' 时搜索条 morph 进来 */}
          <div className="flex-1 flex justify-center min-w-0 relative">
            <div className="w-full max-w-2xl invisible pointer-events-none" aria-hidden="true">
              <PillFrame size="md" state={sharedSearch} />
            </div>
            {barPos === 'top' && (
              <motion.div
                layoutId="home-searchbar"
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                className="absolute inset-x-0 top-0"
              >
                <SearchPill
                  initial={sharedSearch}
                  onChange={setSharedSearch}
                  recommended={cities}
                  className="w-full"
                />
              </motion.div>
            )}
          </div>

          <UserMenu />
        </div>
      </header>

      {/* ===== Hero 区：标题 + 大搜索条槽位 ===== */}
      <section className="relative bg-gradient-to-b from-brand-50/60 via-white to-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-20 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
            找到你的<span className="text-brand-500">下一站</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            告诉 AI Agent 你想去哪儿，剩下的它来搞定
          </p>

          {/* Hero 槽位：隐形 lg 占位顶住高度；barPos='hero' 时搜索条 morph 进来 */}
          <div ref={searchBarRef} className="relative max-w-3xl mx-auto">
            <div className="invisible pointer-events-none" aria-hidden="true">
              <PillFrame size="lg" state={sharedSearch} />
            </div>
            {barPos === 'hero' && (
              <motion.div
                layoutId="home-searchbar"
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                className="absolute inset-x-0 top-0"
              >
                <SearchPill
                  size="lg"
                  initial={sharedSearch}
                  onChange={setSharedSearch}
                  recommended={cities}
                  className="w-full"
                />
              </motion.div>
            )}
          </div>

          {/* 热门城市 chip（点击直接带城市筛选进搜索页） */}
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-sm text-slate-500">热门：</span>
            {HOT_CITIES.map((c) => (
              <Link
                key={c}
                to={`/search?city=${encodeURIComponent(c)}`}
                className="px-3.5 py-1.5 rounded-full border border-slate-300 bg-white text-sm text-slate-700 hover:border-slate-900 hover:text-slate-900 hover:shadow-sm transition"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 分类条 ===== */}
      <CategoryStrip />

      {/* ===== 个性化板块：欢迎回来 / 最近浏览 / 热门房源 ===== */}
      <div className="space-y-10 pt-8">
        <WelcomeBack />

        {recentItems.length > 0 && (
          <SectionCarousel title="最近浏览">
            {recentItems.map((l) => (
              <CarouselCard key={l.id}>
                <ListingCard listing={l} />
              </CarouselCard>
            ))}
          </SectionCarousel>
        )}

        {hotItems.length > 0 && (
          <SectionCarousel title="热门房源">
            {hotItems.map((l) => (
              <CarouselCard key={l.id}>
                <ListingCard listing={l} />
              </CarouselCard>
            ))}
          </SectionCarousel>
        )}
      </div>

      {/* ===== 推荐房源 ===== */}
      <main className="max-w-6xl mx-auto px-6 pt-10 pb-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-[22px] font-semibold text-slate-900">
            推荐房源
            {!isLoading && listings.length > 0 && (
              <span className="text-sm font-normal text-slate-500 ml-2">
                {listings.length} 处
              </span>
            )}
          </h2>
          <Link
            to="/search"
            className="flex items-center gap-0.5 text-sm text-slate-500 hover:text-slate-900 transition"
          >
            查看全部
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

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
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
            <span>© 2026 StayAgent · AI Travel Agent Demo</span>
            <span>中文（简体） · ¥ CNY</span>
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

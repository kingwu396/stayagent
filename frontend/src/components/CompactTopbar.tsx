import { Link } from 'react-router-dom'
import { Hotel } from 'lucide-react'
import { UserMenu } from './UserMenu'
import { SearchPill } from './SearchPill'
import type { CompactSearchState } from '@/hooks/useCompactSearch'
import type { CityInfo } from '@/types/listing'

interface CompactTopbarProps {
  visible?: boolean
  initial?: CompactSearchState
  recommended?: CityInfo[]
  onSearch?: (state: CompactSearchState) => void
}

export function CompactTopbar({
  visible = true,
  initial,
  recommended,
  onSearch,
}: CompactTopbarProps) {
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-full pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      {/* 顶部条：logo + pill + 用户菜单 */}
      <div className="bg-white">
        <div className="max-w-[1760px] mx-auto px-6 h-16 md:h-[72px] flex items-center gap-4 md:gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-brand-500 rounded-md md:rounded-lg flex items-center justify-center">
              <Hotel className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <span className="text-base md:text-lg font-bold text-slate-900 hidden sm:inline">
              StayAgent
            </span>
          </Link>

          {/* 胶囊搜索条（桌面三段 / 移动单 input） */}
          <SearchPill
            initial={initial}
            recommended={recommended}
            onSearch={onSearch}
            className="flex-1"
          />

          {/* 心 + 用户菜单 */}
          <UserMenu />
        </div>
      </div>
    </div>
  )
}

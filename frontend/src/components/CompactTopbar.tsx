import { Link, useNavigate } from 'react-router-dom'
import { Hotel, MapPin, CalendarDays, Users, Search } from 'lucide-react'
import { UserMenu } from './UserMenu'
import { useToast } from '@/hooks/useToast'

interface CompactTopbarProps {
  visible: boolean
}

export function CompactTopbar({ visible }: CompactTopbarProps) {
  const navigate = useNavigate()
  const toast = useToast()

  function onSearch() {
    toast.info('搜索功能将在后续 Block 上线 🚀')
    // 复用 Block 5 行为：跳 /search
    navigate('/search')
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 transition-all duration-300 ease-out ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 -translate-y-full pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-brand-500 rounded-md flex items-center justify-center">
            <Hotel className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">StayAgent</span>
        </Link>

        {/* 紧凑搜索条 */}
        <button
          onClick={onSearch}
          className="hidden md:flex flex-1 items-center gap-1 max-w-2xl mx-auto border border-slate-300 rounded-full px-2 py-1 hover:shadow-md transition group"
        >
          <Segment icon={<MapPin className="w-4 h-4" />} label="想去哪？" />
          <Divider />
          <Segment icon={<CalendarDays className="w-4 h-4" />} label="任何日期" />
          <Divider />
          <Segment icon={<Users className="w-4 h-4" />} label="添加人数" />
          <span className="ml-auto mr-1 w-8 h-8 rounded-full bg-brand-500 group-hover:bg-brand-600 flex items-center justify-center transition">
            <Search className="w-4 h-4 text-white" />
          </span>
        </button>

        {/* 移动端：单 input */}
        <button
          onClick={onSearch}
          className="md:hidden flex-1 flex items-center gap-2 border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-500"
        >
          <Search className="w-4 h-4" />
          <span>搜索房源</span>
        </button>

        {/* 心 + 用户菜单 */}
        <UserMenu />
      </div>
    </div>
  )
}

function Segment({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex-1 flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 rounded-full cursor-pointer transition">
      <span className="text-slate-500 flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  )
}

function Divider() {
  return <span className="w-px h-6 bg-slate-200 flex-shrink-0" />
}

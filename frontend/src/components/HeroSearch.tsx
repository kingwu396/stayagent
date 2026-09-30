import { Search, MapPin, CalendarDays, Users } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

export function HeroSearch() {
  const toast = useToast()

  return (
    <section className="relative bg-gradient-to-br from-rose-50 via-white to-slate-50 border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
          找到你的<span className="text-brand-500">下一站</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          告诉 AI Agent 你想去哪儿，剩下的它来搞定
        </p>

        {/* 搜索栏（视觉占位 + 点击触发 toast） */}
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-2 md:p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2">
          <SearchItem icon={<MapPin className="w-5 h-5" />} label="想去哪？" placeholder="搜索目的地" />
          <Divider />
          <SearchItem icon={<CalendarDays className="w-5 h-5" />} label="入住" placeholder="任何日期" />
          <Divider />
          <SearchItem icon={<CalendarDays className="w-5 h-5" />} label="退房" placeholder="任何日期" />
          <Divider />
          <SearchItem icon={<Users className="w-5 h-5" />} label="人数" placeholder="添加" />

          <button
            onClick={() => toast.info('搜索功能将在 Block 5 上线 🚀')}
            className="flex-shrink-0 flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-3 rounded-xl transition md:ml-2"
          >
            <Search className="w-4 h-4" />
            <span className="md:inline">搜索</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function SearchItem({
  icon,
  label,
  placeholder,
}: {
  icon: React.ReactNode
  label: string
  placeholder: string
}) {
  return (
    <div className="flex-1 px-3 py-2 md:py-1 hover:bg-slate-50 rounded-lg cursor-pointer transition min-w-0">
      <div className="flex items-center gap-2 text-slate-900">
        <span className="text-slate-400 flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-900">{label}</div>
          <input
            type="text"
            placeholder={placeholder}
            className="w-full text-sm text-slate-500 placeholder:text-slate-400 outline-none bg-transparent"
          />
        </div>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="hidden md:block w-px h-8 bg-slate-200" />
}

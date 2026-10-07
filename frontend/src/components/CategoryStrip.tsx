import { Link } from 'react-router-dom'
import { Building2, Home, Palmtree, Hotel, Sofa } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Category {
  type: string
  label: string
  icon: LucideIcon
}

const CATEGORIES: Category[] = [
  { type: 'apartment', label: '公寓', icon: Building2 },
  { type: 'house', label: '民居', icon: Home },
  { type: 'villa', label: '别墅', icon: Palmtree },
  { type: 'hotel', label: '酒店', icon: Hotel },
  { type: 'studio', label: '工作室', icon: Sofa },
]

/** 主页分类快捷筛选：Airbnb 胶囊 chip 样式，点击跳转搜索页并带上类型筛选 */
export function CategoryStrip() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-center justify-start md:justify-center gap-3 overflow-x-auto">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <Link
                key={cat.type}
                to={`/search?property_types=${cat.type}`}
                aria-label={`筛选${cat.label}`}
                className="flex items-center gap-2.5 px-5 py-3 rounded-full border border-slate-300 bg-white flex-shrink-0 hover:border-slate-900 hover:shadow-md active:scale-95 transition group"
              >
                <Icon className="w-5 h-5 text-slate-700 group-hover:text-slate-900 transition" />
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 whitespace-nowrap">
                  {cat.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

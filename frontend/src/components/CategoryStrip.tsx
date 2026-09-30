import { useNavigate } from 'react-router-dom'
import { Building2, Home, Palmtree, Hotel, DoorOpen } from 'lucide-react'
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
  { type: 'studio', label: '工作室', icon: DoorOpen },
]

export function CategoryStrip() {
  const navigate = useNavigate()

  function onClick(type: string) {
    navigate(`/search?property_type=${type}`)
  }

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between gap-4 overflow-x-auto">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <button
                key={cat.type}
                onClick={() => onClick(cat.type)}
                className="flex flex-col items-center gap-2 px-6 py-3 rounded-xl hover:bg-slate-50 transition flex-shrink-0 min-w-[80px] group"
              >
                <Icon className="w-7 h-7 text-slate-600 group-hover:text-brand-500 transition" />
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                  {cat.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

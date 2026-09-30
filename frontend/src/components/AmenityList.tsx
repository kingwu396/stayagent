import {
  Wifi, ChefHat, WashingMachine, Wind, Thermometer, Flame,
  Briefcase, Waves, Dumbbell, Car, Tv, Coffee, TreePine,
  type LucideIcon,
} from 'lucide-react'

interface AmenityListProps {
  amenities: string[]
}

const AMENITY_MAP: Record<string, { label: string; icon: LucideIcon }> = {
  wifi: { label: '无线网络', icon: Wifi },
  kitchen: { label: '厨房', icon: ChefHat },
  washer: { label: '洗衣机', icon: WashingMachine },
  dryer: { label: '烘干机', icon: Wind },
  'air conditioning': { label: '空调', icon: Thermometer },
  heating: { label: '暖气', icon: Flame },
  workspace: { label: '工作区', icon: Briefcase },
  pool: { label: '游泳池', icon: Waves },
  gym: { label: '健身房', icon: Dumbbell },
  parking: { label: '停车场', icon: Car },
  tv: { label: '电视', icon: Tv },
  'coffee maker': { label: '咖啡机', icon: Coffee },
  balcony: { label: '阳台', icon: TreePine },
  garden: { label: '花园', icon: TreePine },
}

const FALLBACK_ICON = AmenityDot

function AmenityDot() {
  return <span className="w-2 h-2 rounded-full bg-slate-400" />
}

export function AmenityList({ amenities }: AmenityListProps) {
  if (amenities.length === 0) {
    return <p className="text-slate-500 text-sm">暂无设施信息</p>
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {amenities.map((key) => {
        const entry = AMENITY_MAP[key] ?? { label: key, icon: FALLBACK_ICON }
        const Icon = entry.icon
        return (
          <div key={key} className="flex items-center gap-3 text-slate-700">
            <Icon className="w-5 h-5 text-slate-500 flex-shrink-0" />
            <span className="text-sm capitalize">{entry.label}</span>
          </div>
        )
      })}
    </div>
  )
}

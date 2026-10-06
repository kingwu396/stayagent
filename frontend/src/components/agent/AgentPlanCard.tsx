/** Block 13 (F8): parse_travel_plan_pdf / recommend_from_plan 卡片
 *
 * 显示: plan_summary (cities/dates/duration) + 缩略 listing 列表 (来自 recommendations)
 */
import { Link } from 'react-router-dom'
import { FileText, MapPin, Calendar, Sparkles } from 'lucide-react'
import { AgentListingCard } from './AgentListingCard'

export interface AgentPlanSummary {
  cities: string[]
  dates: string[]
  duration_days?: number | null
  themes?: string[]
  method?: string
}

export interface AgentPlanItem {
  plan_summary: AgentPlanSummary
  recommendations?: Array<any>
}

export function AgentPlanCard({ item }: { item: AgentPlanItem }) {
  const { plan_summary, recommendations = [] } = item
  return (
    <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-50 to-fuchsia-50 border-b border-slate-200">
        <Sparkles className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-semibold text-slate-900">旅行计划</span>
      </div>
      <div className="p-3 space-y-2 text-sm">
        {plan_summary.cities?.length > 0 && (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {plan_summary.cities.map((c) => (
                <span key={c} className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {plan_summary.dates?.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600">
              {plan_summary.dates[0]} ~ {plan_summary.dates[plan_summary.dates.length - 1]}
              {plan_summary.duration_days && <> ({plan_summary.duration_days} 天)</>}
            </span>
          </div>
        )}
        {(plan_summary.themes?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <div className="flex flex-wrap gap-1">
              {(plan_summary.themes ?? []).map((t) => (
                <span key={t} className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
        {recommendations.length > 0 && (
          <div className="pt-2 mt-2 border-t border-slate-100 space-y-1.5">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              推荐 {recommendations.length} 个房源
            </div>
            {recommendations.slice(0, 3).map((r: any) => (
              <AgentListingCard key={r.id} item={r} />
            ))}
            {recommendations.length > 3 && (
              <div className="text-xs text-slate-400 text-center pt-1">
                还有 {recommendations.length - 3} 个...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

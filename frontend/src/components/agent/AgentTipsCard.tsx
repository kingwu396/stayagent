/** Block 13 (F8): search_travel_tips (RAG) 结果卡片
 *
 * 视觉:
 * - 顶部 score 进度条 (0-1, 越高越好)
 * - 卡片本体: category badge + title + content (前 200 字) + destination
 * - hover 高亮 category 色
 */
import { FileText, MapPin } from 'lucide-react'

export interface AgentTipItem {
  id: number
  title: string
  content: string
  category: string
  destination?: string | null
  score: number
}

const CATEGORY_COLOR: Record<string, string> = {
  visa: 'bg-blue-100 text-blue-700',
  transport: 'bg-green-100 text-green-700',
  food: 'bg-orange-100 text-orange-700',
  safety: 'bg-red-100 text-red-700',
  culture: 'bg-purple-100 text-purple-700',
}

export function AgentTipsCard({ tip }: { tip: AgentTipItem }) {
  const score = Math.max(0, Math.min(1, tip.score))
  const badge = CATEGORY_COLOR[tip.category] || 'bg-slate-100 text-slate-700'

  return (
    <div className="rounded-lg bg-white border border-slate-200 overflow-hidden">
      {/* 顶部 score 进度条 */}
      <div className="h-1 bg-slate-100 relative">
        <div
          className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all"
          style={{ width: `${score * 100}%` }}
          aria-label={`相关度 ${(score * 100).toFixed(0)}%`}
        />
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge}`}>
            {tip.category}
          </span>
          {tip.destination && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500">
              <MapPin className="w-2.5 h-2.5" />
              {tip.destination}
            </span>
          )}
          <span className="ml-auto text-[10px] text-slate-400">
            {(score * 100).toFixed(0)}% 相关
          </span>
        </div>
        <div className="flex items-start gap-1.5">
          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 line-clamp-1">
              {tip.title}
            </div>
            <div className="text-xs text-slate-600 line-clamp-3 mt-0.5">
              {tip.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { MapPin, ExternalLink, Compass, Globe2 } from 'lucide-react'

interface ListingLocationCardProps {
  latitude: string | null
  longitude: string | null
  city: string
  country: string
}

/**
 * 设计选择（按 frontend-design skill）：
 * - "One memorable thing": 城市名（48px bold）做主角
 * - 颜色：品牌色 brand-500（玫瑰红）+ 中性灰
 * - 字体：默认 stack，big bold + small regular 形成层级
 * - 不用任何地图服务、API key、JS 库 → 永远可用
 * - "诚实标注" 坐标 → 真实数据给用户
 * - 主动作：跳到 AMap native scheme（移动端能拉起原生地图 app）
 */
export function ListingLocationCard({ latitude, longitude, city, country }: ListingLocationCardProps) {
  const lat = latitude ? parseFloat(latitude) : null
  const lng = longitude ? parseFloat(longitude) : null
  const hasCoords = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)

  // AMap URI scheme — 桌面跳网页版，手机唤起原生地图 app
  const mapsUrl = hasCoords
    ? `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(`${city}, ${country}`)}&src=maps&coordinate=wgs84&callnative=1`
    : null

  return (
    <div className="relative overflow-hidden border border-slate-200 rounded-2xl bg-gradient-to-br from-white via-white to-slate-50">
      {/* 顶部强调线 */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-600" />

      <div className="p-7 md:p-10">
        {/* 头部：pin 图标 + 位置标签 / 右上坐标 */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-brand-500/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-brand-500" strokeWidth={2.25} />
            </div>
            <div>
              <div className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">Location</div>
              <div className="text-[10px] text-slate-400 tracking-wider uppercase -mt-0.5">所在位置</div>
            </div>
          </div>

          {hasCoords && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full font-mono text-xs text-slate-500">
              <Compass className="w-3 h-3" />
              <span>{lat!.toFixed(2)}°N · {lng!.toFixed(2)}°E</span>
            </div>
          )}
        </div>

        {/* 主元素：城市名（the memorable thing） */}
        <div className="mb-7">
          <h3 className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight leading-none">
            {city}
          </h3>
          <p className="text-lg text-slate-500 mt-2 font-light">{country}</p>
        </div>

        {/* 坐标数据卡 */}
        {hasCoords && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">纬度 / Lat</div>
              <div className="font-mono text-slate-900 font-semibold tracking-tight">{lat!.toFixed(6)}°</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">经度 / Lng</div>
              <div className="font-mono text-slate-900 font-semibold tracking-tight">{lng!.toFixed(6)}°</div>
            </div>
          </div>
        )}

        {/* 操作：跳到 AMap */}
        {mapsUrl && (
          <div className="flex items-center gap-3 pt-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-brand-500 text-white rounded-xl font-medium transition-all group"
            >
              <Globe2 className="w-4 h-4" />
              <span>在地图上查看</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
            <span className="text-xs text-slate-400 hidden sm:inline">
              手机端唤起 AMap app
            </span>
          </div>
        )}

        {/* fallback：没坐标 */}
        {!hasCoords && (
          <p className="text-sm text-slate-400 italic">暂无具体坐标数据</p>
        )}
      </div>
    </div>
  )
}

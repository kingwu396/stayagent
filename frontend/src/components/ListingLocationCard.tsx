import { MapPin, ExternalLink, Compass, Globe2 } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface ListingLocationCardProps {
  latitude: string | null
  longitude: string | null
  city: string
  country: string
}

/** Airbnb 风格红色 pin marker (用 divIcon, 不依赖外部 icon URL) */
function createPinIcon() {
  return L.divIcon({
    className: 'listing-pin-marker',
    html: `<div class="listing-pin-shadow"></div>
<div class="listing-pin">
  <svg viewBox="0 0 24 24" width="20" height="20" fill="white" stroke="white" stroke-width="1.5">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
  </svg>
</div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  })
}

/**
 * 房源位置卡 (Airbnb 风格)
 *
 * - 顶部: pin 图标 + 城市 + 国家
 * - 中部: 实际地图 (react-leaflet + OpenStreetMap tile, 不需 API key)
 * - 底部: "在 AMap 查看" 跳外链
 */
export function ListingLocationCard({ latitude, longitude, city, country }: ListingLocationCardProps) {
  const lat = latitude ? parseFloat(latitude) : null
  const lng = longitude ? parseFloat(longitude) : null
  const hasCoords = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)

  const mapsUrl = hasCoords
    ? `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(`${city}, ${country}`)}&src=maps&coordinate=wgs84&callnative=1`
    : null

  return (
    <div className="relative overflow-hidden border border-slate-200 rounded-2xl bg-white">
      <div className="p-6 md:p-8">
        {/* 头部: pin 图标 + 城市 */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-brand-500" strokeWidth={2.25} />
              <span className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
                Location
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
              {city}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{country}</p>
          </div>

          {hasCoords && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-600">
              <Compass className="w-3 h-3" />
              <span className="tabular-nums">{lat!.toFixed(3)}°N · {lng!.toFixed(3)}°E</span>
            </div>
          )}
        </div>

        {/* 地图区 */}
        {hasCoords ? (
          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[16/9]">
            <MapContainer
              center={[lat!, lng!]}
              zoom={14}
              scrollWheelZoom={false}
              dragging={true}
              doubleClickZoom={true}
              zoomControl={true}
              attributionControl={true}
              className="w-full h-full"
              key={`${lat}-${lng}`}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              <Marker position={[lat!, lng!]} icon={createPinIcon()}>
                <Popup>
                  <div className="text-sm font-medium text-slate-900">{city}</div>
                  <div className="text-xs text-slate-500">{country}</div>
                </Popup>
              </Marker>
            </MapContainer>

            {/* 角落坐标 chip */}
            <div className="absolute bottom-3 left-3 z-[400] px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full text-xs text-slate-700 shadow-md flex items-center gap-1.5 pointer-events-none">
              <Compass className="w-3 h-3 text-brand-500" />
              <span className="tabular-nums">
                {lat!.toFixed(4)}, {lng!.toFixed(4)}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 aspect-[16/9] flex items-center justify-center text-slate-400 text-sm">
            暂无坐标数据,无法渲染地图
          </div>
        )}

        {/* 操作: 跳到 AMap */}
        {mapsUrl && (
          <div className="flex items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              手机端唤起 AMap, 桌面跳网页版
            </span>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-all group"
            >
              <Globe2 className="w-4 h-4" />
              <span>在 AMap 查看</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

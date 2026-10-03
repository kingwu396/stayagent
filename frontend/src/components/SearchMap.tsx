import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ListingSummary } from '@/types/listing'

interface SearchMapProps {
  listings: ListingSummary[]
  highlightedId?: number | null
  onMarkerClick?: (id: number) => void
}

function formatPrice(priceStr: string): string {
  const n = Math.round(Number(priceStr))
  if (isNaN(n)) return ''
  if (n >= 1000) return `¥${(n / 1000).toFixed(1)}k`
  return `¥${n}`
}

function createPriceIcon(priceStr: string, isHighlighted: boolean) {
  const price = formatPrice(priceStr)
  return L.divIcon({
    className: 'price-marker-wrapper',
    html: `<div class="price-marker ${isHighlighted ? 'highlighted' : ''}">${price}</div>`,
    iconSize: [56, 32],
    iconAnchor: [28, 32],
  })
}

export function SearchMap({ listings, highlightedId, onMarkerClick }: SearchMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const listingsRef = useRef(listings)
  listingsRef.current = listings

  if (listings.length === 0) return null

  return (
    <div className="hidden md:block flex-none w-[480px] h-[calc(100vh-72px)] sticky top-[72px] border-l border-slate-200 bg-slate-50">
      <MapContainer
        center={[20, 100]}
        zoom={3}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom={true}
        className="w-full h-full"
        ref={(m) => {
          mapRef.current = m
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {/* 监听 listings + map 变化重 fit（严格依赖 mapRef 保证拿到 live 实例） */}
        <FitBridge mapRef={mapRef} getListings={() => listingsRef.current} />
        {listings.map((l) => {
          if (!l.latitude || !l.longitude) return null
          const lat = parseFloat(l.latitude)
          const lng = parseFloat(l.longitude)
          if (isNaN(lat) || isNaN(lng)) return null
          const isHi = highlightedId === l.id
          return (
            <Marker
              key={l.id}
              position={[lat, lng]}
              icon={createPriceIcon(l.price_per_night, isHi)}
              eventHandlers={{
                click: () => onMarkerClick?.(l.id),
              }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-semibold text-slate-900">{l.title}</div>
                  <div className="text-slate-500 mt-0.5">{l.city}, {l.country}</div>
                  <div className="text-slate-900 mt-1">★ {l.rating} · ¥{Math.round(Number(l.price_per_night))} /晚</div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

/**
 * 在 MapContainer 内部，监听 map 的 `moveend` 事件触发时调用 fit
 * 这样保证 map 容器真正 ready 且尺寸已计算
 */
function FitBridge({
  mapRef,
  getListings,
}: {
  mapRef: React.MutableRefObject<L.Map | null>
  getListings: () => ListingSummary[]
}) {
  useEffect(() => {
    const m = mapRef.current
    if (!m) return

    // 首次 fit（用 moveend 事件保证 map 完全就绪）
    let fitted = false
    const onMoveEnd = () => {
      if (fitted) return
      fitted = true
      const pts = getListings()
        .filter((l) => l.latitude && l.longitude)
        .map((l) => [parseFloat(l.latitude!), parseFloat(l.longitude!)] as [number, number])
      if (pts.length === 0) return
      if (pts.length === 1) {
        m.setView(pts[0], 12)
        return
      }
      m.invalidateSize()
      m.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 14 })
    }
    m.on('moveend', onMoveEnd)
    // 备用：500ms 后强制 fit
    const t = setTimeout(onMoveEnd, 500)

    return () => {
      m.off('moveend', onMoveEnd)
      clearTimeout(t)
    }
  }, [mapRef, getListings])

  // 当 listings 长度变化时也重新 fit
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const t = setTimeout(() => {
      const pts = getListings()
        .filter((l) => l.latitude && l.longitude)
        .map((l) => [parseFloat(l.latitude!), parseFloat(l.longitude!)] as [number, number])
      if (pts.length === 0) return
      if (pts.length === 1) {
        m.setView(pts[0], 12)
        return
      }
      m.invalidateSize()
      m.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 14 })
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getListings()?.length])

  return null
}

import { useEffect, useRef, useState } from 'react'
import { MapPin, AlertCircle, KeyRound } from 'lucide-react'
import { Skeleton } from './Skeleton'

interface ListingMapProps {
  latitude: string | null
  longitude: string | null
  city: string
  country: string
}

const AMAP_KEY = import.meta.env.VITE_AMAP_KEY as string | undefined

// 动态注入 AMap JS API 脚本（避免污染 index.html）
function loadAMapScript(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // 已加载则直接返回
    if ((window as any).AMap) {
      resolve((window as any).AMap)
      return
    }

    // 设置全局 resolver（AMap loader 约定）
    const w = window as any
    w._AMapSecurityConfig = { securityJsCode: '' } // 占位，按需配白名单

    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.ToolBar,AMap.Scale`
    script.async = true
    script.onload = () => resolve((window as any).AMap)
    script.onerror = () => reject(new Error('AMap 脚本加载失败'))
    document.head.appendChild(script)
  })
}

type MapState =
  | { kind: 'empty' }
  | { kind: 'no-key' }
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

export function ListingMap({ latitude, longitude, city, country }: ListingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [state, setState] = useState<MapState>(() => {
    if (!latitude || !longitude) return { kind: 'empty' }
    if (!AMAP_KEY) return { kind: 'no-key' }
    return { kind: 'loading' }
  })

  useEffect(() => {
    if (state.kind !== 'loading') return
    if (!latitude || !longitude || !AMAP_KEY || !containerRef.current) return

    let cancelled = false

    loadAMapScript(AMAP_KEY)
      .then((AMap) => {
        if (cancelled) return

        const lng = parseFloat(longitude)
        const lat = parseFloat(latitude)
        if (Number.isNaN(lng) || Number.isNaN(lat)) {
          setState({ kind: 'empty' })
          return
        }

        const map = new AMap.Map(containerRef.current, {
          center: [lng, lat],
          zoom: 15,
          viewMode: '2D',
        })
        mapInstanceRef.current = map

        const marker = new AMap.Marker({
          position: [lng, lat],
          title: '房源位置',
        })
        map.add(marker)

        const infoWindow = new AMap.InfoWindow({
          content: `<div style="padding:6px 10px;font-size:13px;">📍 房源大致位置<br/><span style="color:#64748b;">${city}, ${country}</span></div>`,
          offset: new AMap.Pixel(0, -30),
        })
        infoWindow.open(map, [lng, lat])

        setState({ kind: 'ready' })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[ListingMap] AMap load failed:', err)
        setState({ kind: 'error', message: err?.message || '地图加载失败' })
      })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
      }
    }
  }, [state.kind, latitude, longitude, city, country])

  if (state.kind === 'empty') {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2 min-h-[180px]">
        <MapPin className="w-4 h-4" />
        暂无位置数据
      </div>
    )
  }

  if (state.kind === 'no-key') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 min-h-[180px]">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1">需要配置 AMap API Key</h4>
            <p className="text-sm text-amber-700">
              在 <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs">frontend/.env.local</code> 设置 <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs">VITE_AMAP_KEY=你的key</code> 后重启 dev server。
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 min-h-[180px] flex items-start gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold mb-1">地图加载失败</h4>
          <p className="text-sm text-red-600">{state.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200">
      {state.kind === 'loading' && (
        <Skeleton className="absolute inset-0 rounded-none h-full w-full" />
      )}
      <div
        ref={containerRef}
        className="w-full h-[400px] md:h-[480px]"
        aria-label={`${city} ${country} 地图`}
      />
    </div>
  )
}

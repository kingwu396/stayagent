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

function loadAMapScript(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).AMap) {
      resolve((window as any).AMap)
      return
    }

    const w = window as any
    w._AMapSecurityConfig = { securityJsCode: '' }

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

  // 关键修复：从依赖中移除 state.kind
  // 这样 setState('ready') 不会触发 cleanup 销毁 map
  // 只有当 latitude/longitude/key 真正变化时才重建
  useEffect(() => {
    if (!latitude || !longitude || !AMAP_KEY || !containerRef.current) return

    let cancelled = false
    let initTimer: number | undefined

    loadAMapScript(AMAP_KEY)
      .then((AMap) => {
        if (cancelled) return

        const lng = parseFloat(longitude)
        const lat = parseFloat(latitude)
        if (Number.isNaN(lng) || Number.isNaN(lat)) {
          setState({ kind: 'empty' })
          return
        }

        // 延迟一帧再创建 map（让 React 完成渲染 + 容器尺寸稳定）
        initTimer = window.setTimeout(() => {
          if (cancelled || !containerRef.current) return

          let map: any
          try {
            map = new AMap.Map(containerRef.current, {
              center: [lng, lat],
              zoom: 15,
              viewMode: '2D',
            })
          } catch (e) {
            setState({ kind: 'error', message: String(e) })
            return
          }
          mapInstanceRef.current = map

          map.add(new AMap.Marker({
            position: [lng, lat],
            title: '房源位置',
          }))

          const infoWindow = new AMap.InfoWindow({
            content: `<div style="padding:6px 10px;font-size:13px;">📍 房源大致位置<br/><span style="color:#64748b;">${city}, ${country}</span></div>`,
            offset: new AMap.Pixel(0, -30),
          })
          infoWindow.open(map, [lng, lat])

          // 强制重排（处理容器初始 0 尺寸的边缘情况）
          window.setTimeout(() => {
            try { map.resize?.() } catch (e) { /* noop */ }
            window.dispatchEvent(new Event('resize'))
          }, 200)

          setState({ kind: 'ready' })
        }, 100)
      })
      .catch((err) => {
        if (cancelled) return
        setState({ kind: 'error', message: err?.message || '地图加载失败' })
      })

    return () => {
      cancelled = true
      if (initTimer) clearTimeout(initTimer)
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.destroy() } catch (e) { /* noop */ }
        mapInstanceRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, city, country])
  //         ^ 故意不含 state.kind 和 AMAP_KEY（key 不会变）
  //         AMAP_KEY 在模块顶层读取，重渲染时不变

  // ===== 占位状态 =====

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
              在 <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs">frontend/.env.local</code> 设置{' '}
              <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs">VITE_AMAP_KEY=你的key</code> 后重启 dev server。
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

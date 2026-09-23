import { useEffect, useState } from 'react'
import { Hotel } from 'lucide-react'
import { api } from './api/client'

interface HealthStatus {
  status: string
  backend: string
  database: string
}

interface StatusRowProps {
  icon: string
  label: string
  ok: boolean | null
  description: string
}

function StatusRow({ icon, label, ok, description }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="font-medium text-slate-900">{label}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
      </div>
      <div className="text-2xl">
        {ok === null ? '⏳' : ok ? '✅' : '❌'}
      </div>
    </div>
  )
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<HealthStatus>('/health')
      .then((res) => setHealth(res.data))
      .catch((err) => setError(err.message))
  }, [])

  const backendOk = health?.backend === 'ok'
  const dbOk = health?.database === 'connected'
  const allOk = backendOk && dbOk

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-500 rounded-2xl mb-4 shadow-lg">
            <Hotel className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-3">StayAgent</h1>
          <p className="text-slate-600 text-lg">AI Travel Agent · Block 1 烟雾测试</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-4">
          <StatusRow
            icon="🚀"
            label="FastAPI 后端"
            ok={health ? backendOk : null}
            description={health ? `状态：${health.backend}` : '检查中...'}
          />
          <StatusRow
            icon="🗄️"
            label="MySQL 数据库"
            ok={health ? dbOk : null}
            description={health ? `状态：${health.database}` : '检查中...'}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              ❌ 连接错误：{error}
            </div>
          )}

          {allOk && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm text-center font-medium">
              🎉 Block 1 完成！前后端 + 数据库三连成功！
            </div>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-8">
          Stack: React 18 + TypeScript + Vite + Tailwind + FastAPI + SQLAlchemy + MySQL
        </p>
        <p className="text-center text-slate-400 text-xs mt-2">
          当前进度：Block 1 / 14 · 等待进入 Block 2
        </p>
      </div>
    </div>
  )
}

export default App

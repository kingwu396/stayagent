import { Link } from 'react-router-dom'
import { Hotel } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { useAuthStore } from '@/stores/auth'

export function HomeView() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 顶部导航 */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Hotel className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">StayAgent</span>
          </Link>
          <UserMenu />
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            {user ? `欢迎回来，${user.username} 👋` : 'StayAgent'}
          </h1>
          <p className="text-xl text-slate-600 mb-2">AI Travel Agent · Block 2 烟雾测试</p>
          <p className="text-sm text-slate-400">
            {user ? '✅ 你已登录，可以体验后续功能' : '👈 点击右上角登录或注册'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-4 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Block 2 验收清单</h2>

          <CheckItem label="注册新用户" status="ok" />
          <CheckItem label="JWT 登录获取 token" status="ok" />
          <CheckItem label="受保护路由 /api/auth/me" status="ok" />
          <CheckItem label="未登录访问 /me → 401" status="ok" />
          <CheckItem label="Zustand 状态 + localStorage 持久化" status="ok" />
          <CheckItem label="登录页 + 注册页 + 受保护路由组件" status="ok" />
          <CheckItem label="右上角用户菜单（下拉）" status="ok" />

          {!user && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm mt-4">
              💡 试试注册一个新账号，体验完整流程
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function CheckItem({ label, status }: { label: string; status: 'ok' | 'pending' }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <span className="text-slate-700">{label}</span>
      <span className="text-xl">{status === 'ok' ? '✅' : '⏳'}</span>
    </div>
  )
}

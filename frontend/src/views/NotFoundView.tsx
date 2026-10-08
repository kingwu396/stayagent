import { Link } from 'react-router-dom'
import { Hotel, Home, Search } from 'lucide-react'

/** Block 23: 404 页 —— 替代原先「未知路由静默跳首页」 */
export function NotFoundView() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-6">
          <Hotel className="w-8 h-8 text-white" />
        </div>
        <div className="text-7xl font-bold text-slate-900 tracking-tight mb-2">404</div>
        <h1 className="text-lg font-semibold text-slate-900 mb-2">页面不存在或已下线</h1>
        <p className="text-sm text-slate-500 mb-8">
          你要找的页面去旅行了。回到首页继续探索房源,或者直接搜一搜。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition"
          >
            <Home className="w-4 h-4" />
            回到首页
          </Link>
          <Link
            to="/search"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 hover:border-slate-900 text-slate-700 hover:text-slate-900 text-sm font-medium rounded-xl transition"
          >
            <Search className="w-4 h-4" />
            去搜索
          </Link>
        </div>
      </div>
    </div>
  )
}

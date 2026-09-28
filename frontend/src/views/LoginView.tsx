import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

export function LoginView() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)

  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    clearError()
    try {
      await login(account, password)
      navigate('/')
    } catch {
      // 错误已经在 store 里
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">欢迎回来 👋</h1>
        <p className="text-slate-500 mb-6">登录 StayAgent 开始你的 AI 旅行</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">邮箱或用户名</label>
            <input
              type="text"
              required
              minLength={3}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              placeholder="alice 或 alice@test.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              placeholder="至少 8 位"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition"
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-6">
          还没有账号？{' '}
          <Link to="/register" className="text-brand-500 hover:text-brand-600 font-medium">
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}

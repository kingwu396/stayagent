import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, LogOut, Heart, Home, MapPin, User } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { hostApi } from '@/api/host'
import { useToast } from '@/hooks/useToast'

export function UserMenu() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const logout = useAuthStore((s) => s.logout)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [open, setOpen] = useState(false)
  const [becomingHost, setBecomingHost] = useState(false)
  const toast = useToast()
  const ref = useRef<HTMLDivElement>(null)

  // 挂载时如果有 token 但没 user，尝试拉取
  useEffect(() => {
    if (!user) fetchMe()
  }, [user, fetchMe])

  // 点击外部关闭下拉
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!user) {
    return (
      <div className="flex gap-2">
        <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg">
          登录
        </Link>
        <Link to="/register" className="px-4 py-2 text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 rounded-lg">
          注册
        </Link>
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 rounded-full transition"
      >
        <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:inline text-sm font-medium text-slate-700">{user.username}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 animate-pop-in">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="font-medium text-slate-900">{user.username}</div>
            <div className="text-xs text-slate-500 truncate">{user.email}</div>
          </div>
          <Link
            to="/wishlist"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Heart className="w-4 h-4" />
            我的心愿单
          </Link>
          <Link
            to="/trips"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <MapPin className="w-4 h-4" />
            我的行程
          </Link>
          {user.is_host ? (
            <Link
              to="/host"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-600 hover:bg-slate-50 font-medium"
            >
              <BarChart3 className="w-4 h-4" />
              房东后台
            </Link>
          ) : (
            <button
              onClick={async () => {
                if (becomingHost) return
                setBecomingHost(true)
                try {
                  await hostApi.becomeHost()
                  updateUser({ is_host: true })
                  setOpen(false)
                  toast.success('已成为房东, 进入后台')
                  navigate('/host')
                } catch (err: any) {
                  toast.error('操作失败, 请重试')
                } finally {
                  setBecomingHost(false)
                }
              }}
              disabled={becomingHost}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-brand-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <Home className="w-4 h-4" />
              {becomingHost ? '处理中...' : '成为房东'}
            </button>
          )}
          <button
            onClick={async () => {
              setOpen(false)
              await logout()
              navigate('/')
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}

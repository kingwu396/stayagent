import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/api/auth'
import { getToken, setToken, clearToken } from '@/api/client'
import type { User } from '@/api/auth'
import { apiErrorText } from '@/lib/utils'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null

  login: (account: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string, is_host?: boolean) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  /** Block 15: 部分更新 user 字段 (e.g. become_host 后 is_host=true) */
  updateUser: (patch: Partial<User>) => void
  clearError: () => void
}

// Block 24: client 拦截器续期失败时广播 —— 清干净登录态, 停掉后续必败请求
if (typeof window !== 'undefined') {
  window.addEventListener('stayagent:auth-expired', () => {
    clearToken()
    useAuthStore.setState({ token: null, user: null })
  })
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: getToken(),
      isLoading: false,
      error: null,

      async login(account, password) {
        set({ isLoading: true, error: null })
        try {
          const { access_token, user } = await authApi.login(account, password)
          setToken(access_token)
          set({ token: access_token, user, isLoading: false })
        } catch (err: any) {
          set({
            error: apiErrorText(err, '登录失败'),
            isLoading: false,
          })
          throw err
        }
      },

      async register(email, username, password, is_host = false) {
        set({ isLoading: true })
        try {
          const user = await authApi.register(email, username, password, is_host)
          // 注册成功后自动登录
          await get().login(username, password)
        } catch (err: any) {
          set({
            error: apiErrorText(err, '注册失败'),
            isLoading: false,
          })
          throw err
        }
      },

      logout() {
        clearToken()
        set({ user: null, token: null })
      },

      updateUser(patch: Partial<User>) {
        const cur = get().user
        if (!cur) return
        set({ user: { ...cur, ...patch } })
      },

      async fetchMe() {
        if (!get().token) return
        set({ isLoading: true, error: null })
        try {
          const user = await authApi.me()
          set({ user, isLoading: false })
        } catch (err: any) {
          set({ user: null, token: null, isLoading: false })
          clearToken()
        }
      },

      clearError() {
        set({ error: null })
      },
    }),
    {
      name: 'stayagent-auth',
      partialize: (state) => ({ token: state.token }),  // 只持久化 token
    }
  )
)

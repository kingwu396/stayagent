import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/api/auth'
import { getToken, setToken, clearToken } from '@/api/client'
import type { User } from '@/api/auth'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null

  login: (account: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
  clearError: () => void
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
            error: err.response?.data?.detail || '登录失败',
            isLoading: false,
          })
          throw err
        }
      },

      async register(email, username, password) {
        set({ isLoading: true, error: null })
        try {
          await authApi.register(email, username, password)
          // 注册成功后自动登录
          await get().login(username, password)
        } catch (err: any) {
          set({
            error: err.response?.data?.detail || '注册失败',
            isLoading: false,
          })
          throw err
        }
      },

      logout() {
        clearToken()
        set({ user: null, token: null })
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

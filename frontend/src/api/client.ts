import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const TOKEN_KEY = 'stayagent_token'

// ============ Access Token 存储（localStorage）============
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// ============ Axios 实例 ============
export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // ⭐ 让 cookie 自动随请求发送
})

// Block 24: 解析 JWT exp(本地判断是否过期, 30s 容差)
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now() + 30_000
  } catch {
    return false  // 非 JWT 格式, 交由服务端判断
  }
}

// 请求拦截器：自动加 access token;token 已过期时先静默续期,
// 避免把注定 401 的请求打到业务端点上(消除控制台红色报错刷屏)
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token = getToken()
  if (token && isTokenExpired(token)) {
    const fresh = await refreshAccessToken()
    if (!fresh) {
      // 续期失败(cookie 也失效) → 通知 auth store 清理, 并拒发这条必败请求(不产生 401)
      clearToken()
      window.dispatchEvent(new CustomEvent('stayagent:auth-expired'))
      const err = new Error('登录已过期') as Error & { handled?: boolean }
      err.handled = true
      return Promise.reject(err)
    }
    token = fresh
  }
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

// ============ 401 自动 refresh ============

// 跳过 refresh 的端点（避免循环）
const SKIP_REFRESH_URLS = ['/auth/login', '/auth/register', '/auth/refresh']

// 单 in-flight refresh Promise（去重）
let refreshInFlight: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  // POST /api/auth/refresh，cookie 自动带
  try {
    const res = await axios.post(
      '/auth/refresh',
      {},
      { baseURL: '/api', withCredentials: true }
    )
    const newAccess = res.data.access_token
    setToken(newAccess)
    return newAccess
  } catch {
    return null
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

// 响应拦截器：401 时尝试自动 refresh + 重试
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean }
    const status = error.response?.status
    const url = original?.url || ''

    // 不是 401 / 没有原请求 / 已经重试过 / 是 auth 端点 → 直接失败
    if (status !== 401 || !original || original._retried || SKIP_REFRESH_URLS.some(u => url.includes(u))) {
      if (status === 401 && !SKIP_REFRESH_URLS.some(u => url.includes(u))) {
        // refresh 失败导致的 401：清状态跳登录
        clearToken()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }

    // 尝试 refresh
    const newAccess = await refreshAccessToken()
    if (!newAccess) {
      // refresh 失败 → 清状态跳登录
      clearToken()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // refresh 成功 → 用新 token 重发原请求
    original._retried = true
    original.headers.set('Authorization', `Bearer ${newAccess}`)
    return api.request(original)
  }
)

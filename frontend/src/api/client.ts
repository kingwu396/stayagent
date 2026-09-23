import axios from 'axios'

// vite.config.ts 里配置了 /api -> http://127.0.0.1:8000 的代理
// 所以前端直接用 '/api' 就行
export const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Block 2 起会加请求拦截器（自动带 JWT）
// Block 2 起会加响应拦截器（统一错误处理）

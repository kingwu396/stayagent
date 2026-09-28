import { api } from './client'

export interface User {
  id: number
  email: string
  username: string
  avatar_url: string | null
  created_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export const authApi = {
  async register(email: string, username: string, password: string): Promise<User> {
    const res = await api.post<User>('/auth/register', { email, username, password })
    return res.data
  },

  async login(account: string, password: string): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('/auth/login', { account, password })
    return res.data
  },

  async me(): Promise<User> {
    const res = await api.get<User>('/auth/me')
    return res.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },
}

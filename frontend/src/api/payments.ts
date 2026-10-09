import { api } from './client'
import type { Payment, PaymentMethod } from '@/types/payment'

export const paymentsApi = {
  /** 为待支付订单创建支付单(method 可重复调用切换支付方式, 幂等) */
  async create(payload: { booking_id: number; method: PaymentMethod }): Promise<Payment> {
    const res = await api.post<Payment>('/payments', payload)
    return res.data
  },

  /** 模拟支付网关: 支付成功(幂等) */
  async pay(paymentId: number): Promise<Payment> {
    const res = await api.post<Payment>(`/payments/${paymentId}/pay`)
    return res.data
  },

  async get(paymentId: number): Promise<Payment> {
    const res = await api.get<Payment>(`/payments/${paymentId}`)
    return res.data
  },
}

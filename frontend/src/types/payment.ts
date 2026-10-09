/** Block 26: 支付类型(对齐后端 schemas/payment.py) */

export type PaymentMethod = 'alipay' | 'wechat' | 'card'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed'

export interface Payment {
  id: number
  booking_id: number
  amount: string
  method: PaymentMethod
  status: PaymentStatus
  created_at: string
  paid_at: string | null
}

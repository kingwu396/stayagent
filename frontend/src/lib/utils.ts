// 通用工具函数

/** 格式化日期为 YYYY-MM-DD */
export const formatDate = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

/** 格式化价格：整数 + ¥ 前缀 */
export const formatPrice = (v: string | number): string => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (Number.isNaN(n)) return '¥--'
  return `¥${Math.round(n)}`
}

/** 格式化评分："4.5 (458)" */
export const formatRating = (rating: string | number, count: number): string => {
  const r = typeof rating === 'string' ? parseFloat(rating) : rating
  return `${r.toFixed(1)} (${count})`
}

// 通用工具函数

/** FastAPI 错误响应转展示文本。
 *  422 校验失败时 detail 是对象数组，直接当字符串渲染会导致 React 崩溃。 */
export const apiErrorText = (err: any, fallback = '请求失败'): string => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item: any) => {
        const field =
          Array.isArray(item?.loc) && item.loc.length > 1
            ? item.loc[item.loc.length - 1]
            : null
        const msg = typeof item?.msg === 'string' ? item.msg : ''
        return field ? `${field}: ${msg}` : msg
      })
      .filter(Boolean)
    if (msgs.length) return msgs.join('；')
  }
  return fallback
}

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

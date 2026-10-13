// 通用工具函数

/** FastAPI 错误响应转展示文本。
 *  422 校验失败时 detail 是对象数组，直接当字符串渲染会导致 React 崩溃。
 *  顺便把 Pydantic 的英文校验消息翻成用户能看懂的中文。 */
const FIELD_LABELS: Record<string, string> = {
  username: '用户名',
  email: '邮箱',
  password: '密码',
  account: '账号',
  is_host: '房东身份',
}

/** Pydantic 常见英文校验消息 → 中文（按顺序匹配，命中即返回） */
const MSG_RULES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/Field required/, () => '不能为空'],
  [/String should have at least (\d+) characters?/, (m) => `至少 ${m[1]} 个字符`],
  [/String should have at most (\d+) characters?/, (m) => `至多 ${m[1]} 个字符`],
  [/not a valid email address/i, () => '邮箱格式不正确'],
  [/String should match pattern/, () => '格式不正确'],
]

function translateMsg(field: string, msg: string): string {
  const label = FIELD_LABELS[field]
  for (const [re, to] of MSG_RULES) {
    const m = msg.match(re)
    if (m) {
      const text = typeof to === 'function' ? to(m) : to
      return label ? `${label}${text}` : text
    }
  }
  // 未命中的消息保持原样, 但字段名仍换成中文标签
  return label ? `${label}: ${msg}` : msg
}

export const apiErrorText = (err: any, fallback = '请求失败'): string => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item: any) => {
        const field =
          Array.isArray(item?.loc) && item.loc.length > 1
            ? String(item.loc[item.loc.length - 1])
            : ''
        const msg = typeof item?.msg === 'string' ? item.msg : ''
        return msg ? translateMsg(field, msg) : ''
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

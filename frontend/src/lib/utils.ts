// 通用工具函数，后续 Block 会扩展
export const formatDate = (d: Date | string) => {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

/** 待收藏暂存 (Block 32 优化)
 *
 * 未登录点收藏 → 暂存房源到 localStorage 并跳登录页;
 * 登录成功后由 AnimatedLayout 取出并弹出「保存到心愿单」选择框.
 * 30 分钟过期 (点了收藏但放弃登录, 不会几天后突然弹窗).
 */
import type { ListingSummary } from '@/types/listing'

const KEY = 'stayagent-pending-favorite'
const TTL_MS = 30 * 60 * 1000

export function setPendingFavorite(listing: ListingSummary): void {
  localStorage.setItem(KEY, JSON.stringify({ listing, ts: Date.now() }))
}

/** 读即删 (防重复弹窗); 过期/损坏返回 null */
export function takePendingFavorite(): ListingSummary | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  localStorage.removeItem(KEY)
  try {
    const { listing, ts } = JSON.parse(raw)
    if (!listing?.id || Date.now() - ts > TTL_MS) return null
    return listing as ListingSummary
  } catch {
    return null
  }
}

/**
 * 主页「最近浏览 / 继续搜索」的 localStorage 记录。
 * 匿名 / 登录态都可用；容量上限防止无限膨胀。
 */

const VIEWED_KEY = 'stayagent-recent-viewed'
const SEARCH_KEY = 'stayagent-recent-searches'
const VIEWED_LIMIT = 20
const SEARCH_LIMIT = 6

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 隐私模式 / 容量满：静默失败，浏览记录是增强功能不该阻塞主流程
  }
}

// ============ 最近浏览 ============

/** 详情页加载成功后调用：去重、最新在前、上限 VIEWED_LIMIT */
export function recordViewed(listingId: number) {
  const prev = readJSON<number[]>(VIEWED_KEY, [])
  const next = [listingId, ...prev.filter((id) => id !== listingId)].slice(0, VIEWED_LIMIT)
  writeJSON(VIEWED_KEY, next)
}

export function getViewedIds(): number[] {
  return readJSON<number[]>(VIEWED_KEY, [])
}

// ============ 继续搜索 ============

export interface RecentSearch {
  city: string
  checkIn: string
  checkOut: string
  guests: { adults: number; children: number; infants: number; pets: number }
  ts: number
}

/** 搜索页带 city 进入时调用：同 city 覆盖（保留最新参数）、最新在前、上限 SEARCH_LIMIT */
export function recordSearch(search: Omit<RecentSearch, 'ts'>) {
  if (!search.city.trim()) return
  const prev = readJSON<RecentSearch[]>(SEARCH_KEY, [])
  const next: RecentSearch[] = [
    { ...search, ts: Date.now() },
    ...prev.filter((s) => s.city !== search.city),
  ].slice(0, SEARCH_LIMIT)
  writeJSON(SEARCH_KEY, next)
}

export function getRecentSearches(): RecentSearch[] {
  return readJSON<RecentSearch[]>(SEARCH_KEY, [])
}

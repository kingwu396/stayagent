/** 本地占位图 (Block 32: picsum 图片本地化, 不再依赖第三方占位图服务)
 *
 * 文件由 backend/scripts/localize_images.py 下载到 backend/uploads/images/,
 * 通过 GET /api/uploads/images/{subdir}/{filename} 访问 (vite proxy 免改).
 */
export const PLACEHOLDER_IMAGE = '/api/uploads/images/picsum/placeholder-400x300.jpg'
export const PLACEHOLDER_IMAGE_LARGE = '/api/uploads/images/picsum/placeholder-800x600.jpg'

/** 城市缩略图 (WelcomeBack 用), 文件名 = 城市名 (后端 path 参数自动 URL decode) */
export function cityImage(city: string): string {
  return `/api/uploads/images/cities/${encodeURIComponent(city)}.jpg`
}

/** 评价图 (ReviewsSection 固定 8 张轮换) */
export function reviewImage(n: number): string {
  return `/api/uploads/images/reviews/review-${n}.jpg`
}

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface ImageGalleryProps {
  images: string[]
  title: string
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const closeLightbox = useCallback(() => setLightboxIdx(null), [])
  const nextImg = useCallback(
    () => setLightboxIdx((i) => (i === null ? null : Math.min(images.length - 1, i + 1))),
    [images.length]
  )
  const prevImg = useCallback(
    () => setLightboxIdx((i) => (i === null ? null : Math.max(0, i - 1))),
    []
  )

  // Lightbox 键盘
  useEffect(() => {
    if (lightboxIdx === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowRight') nextImg()
      else if (e.key === 'ArrowLeft') prevImg()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIdx, closeLightbox, nextImg, prevImg])

  if (images.length === 0) {
    return (
      <div className="aspect-[16/9] rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
        暂无图片
      </div>
    )
  }

  const main = images[0]
  // 桌面端 2x2 网格需要至少 5 张图
  const thumbs = images.slice(1, 5)
  const hasMore = images.length > 5

  return (
    <>
      {/* 桌面端：左大右 2x2 */}
      <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[480px] rounded-2xl overflow-hidden">
        <button
          onClick={() => setLightboxIdx(0)}
          className="col-span-2 row-span-2 relative bg-slate-100 group"
        >
          <img src={main} alt={title} className="w-full h-full object-cover group-hover:brightness-95 transition" />
        </button>
        {thumbs.map((src, i) => (
          <button
            key={i}
            onClick={() => setLightboxIdx(i + 1)}
            className="relative bg-slate-100 group overflow-hidden"
          >
            <img src={src} alt={`${title} ${i + 2}`} className="w-full h-full object-cover group-hover:brightness-95 transition" />
            {hasMore && i === 3 && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-medium">
                +{images.length - 5} 张
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 移动端：单列滚动 */}
      <div className="md:hidden overflow-x-auto flex gap-2 snap-x snap-mandatory">
        {images.map((src, i) => (
          <button
            key={i}
            onClick={() => setLightboxIdx(i)}
            className="flex-shrink-0 w-full snap-center"
          >
            <img src={src} alt={`${title} ${i + 1}`} className="w-full h-72 object-cover rounded-xl" />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          {/* 顶栏 */}
          <div className="absolute top-4 right-4 flex items-center gap-4">
            <span className="text-white text-sm">
              {lightboxIdx + 1} / {images.length}
            </span>
            <button
              onClick={closeLightbox}
              className="text-white hover:text-slate-300"
              aria-label="关闭"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          {/* 主体图 */}
          <img
            src={images[lightboxIdx]}
            alt={`${title} ${lightboxIdx + 1}`}
            className="max-w-full max-h-[85vh] object-contain"
          />

          {/* 左右按钮 */}
          {lightboxIdx > 0 && (
            <button
              onClick={prevImg}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              aria-label="上一张"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
          )}
          {lightboxIdx < images.length - 1 && (
            <button
              onClick={nextImg}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              aria-label="下一张"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          )}
        </div>
      )}
    </>
  )
}

/** Block 13 (F5): 路由过渡包装器
 *
 * 用 framer-motion 的 AnimatePresence + motion.div 让路由切换有 fade + 8px slide.
 * mode="wait" 让旧页面完全消失再进新页面, 避免重叠闪烁.
 */
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** location.key (或任意唯一 id), AnimatePresence 用它判断是新页面还是同一个 */
  pageKey: string
}

export function PageTransition({ children, pageKey }: Props) {
  return (
    <motion.div
      key={pageKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

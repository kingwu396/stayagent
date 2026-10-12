import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { motion, useMotionValue } from 'framer-motion'
import { useAgentStore } from '@/stores/agent'

const POS_KEY = 'agent-fab-pos'
const FAB_MARGIN = 24 // bottom-6 / right-6 = 24px

/** 从 localStorage 恢复拖动位置, 并 clamp 到当前视口内 */
function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) {
      const { x, y } = JSON.parse(raw)
      return clampPos(x, y)
    }
  } catch { /* 解析失败回默认 */ }
  return { x: 0, y: 0 }
}

/** 按钮布局位置在右下角, transform 偏移只能是负值(往左上拖) */
function clampPos(x: number, y: number) {
  return {
    x: Math.min(Math.max(x, -(window.innerWidth - 56 - FAB_MARGIN * 2)), 0),
    y: Math.min(Math.max(y, -(window.innerHeight - 56 - FAB_MARGIN * 2)), 0),
  }
}

/** 右下角浮动按钮(可拖动), 点开 AgentPanel */
export function AgentFab() {
  const isOpen = useAgentStore((s) => s.isOpen)
  const togglePanel = useAgentStore((s) => s.togglePanel)
  const openPanel = useAgentStore((s) => s.openPanel)
  const setMode = useAgentStore((s) => s.setMode)
  // Block 22: 任一会话在生成 → 绿点脉冲
  const isStreaming = useAgentStore((s) => s.streamingKeys.length > 0)

  // 拖动: framer-motion drag + 全视口约束层; 位置用 motionValue 控制以便持久化
  const constraintsRef = useRef<HTMLDivElement>(null)
  const [initialPos] = useState(loadPos)
  const x = useMotionValue(initialPos.x)
  const y = useMotionValue(initialPos.y)
  // 拖动后松手会派发 click —— 用标志位吞掉, 避免误开面板
  // (framer 的 onTap 在 drag 场景下判定不可靠, 实测拖动松手仍触发)
  const draggedRef = useRef(false)

  // 窗口缩放后把按钮拉回视口内
  useEffect(() => {
    function onResize() {
      const p = clampPos(x.get(), y.get())
      x.set(p.x)
      y.set(p.y)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [x, y])

  // Block 24: 移动端浮动窗空间不足, FAB 直接进全屏模式
  function handleTap() {
    if (window.innerWidth < 768) {
      setMode('fullscreen')
      openPanel()
      return
    }
    togglePanel()
  }

  return (
    <>
      {/* 拖动约束层: 覆盖全视口, 不吃事件 */}
      <div ref={constraintsRef} className="fixed inset-0 z-40 pointer-events-none" />
      <motion.button
        drag
        dragConstraints={constraintsRef}
        dragMomentum={false}
        dragElastic={0.05}
        style={{ x, y }}
        onDragStart={() => {
          draggedRef.current = true
        }}
        onDragEnd={() => {
          localStorage.setItem(POS_KEY, JSON.stringify({ x: x.get(), y: y.get() }))
        }}
        onClick={() => {
          if (draggedRef.current) {
            draggedRef.current = false
            return
          }
          handleTap()
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        className={[
          'fixed bottom-6 right-6 z-40',
          'w-14 h-14 rounded-full shadow-lg',
          'flex items-center justify-center',
          'cursor-grab active:cursor-grabbing touch-none',
          isOpen
            ? 'bg-slate-700 hover:bg-slate-800'
            : 'bg-brand-500 hover:bg-brand-600',
        ].join(' ')}
        aria-label={isOpen ? '关闭 StayAgent' : '打开 StayAgent'}
      >
        <Sparkles
          className={`w-6 h-6 text-white ${isStreaming ? 'animate-pulse' : ''}`}
        />
        {isStreaming && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 ring-2 ring-white rounded-full"
          />
        )}
      </motion.button>
    </>
  )
}

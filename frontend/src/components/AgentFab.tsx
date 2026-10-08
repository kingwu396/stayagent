import { Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAgentStore } from '@/stores/agent'

/** 右下角浮动按钮, 点开 AgentPanel */
export function AgentFab() {
  const isOpen = useAgentStore((s) => s.isOpen)
  const togglePanel = useAgentStore((s) => s.togglePanel)
  const openPanel = useAgentStore((s) => s.openPanel)
  const setMode = useAgentStore((s) => s.setMode)
  // Block 22: 任一会话在生成 → 绿点脉冲
  const isStreaming = useAgentStore((s) => s.streamingKeys.length > 0)

  // Block 24: 移动端浮动窗空间不足, FAB 直接进全屏模式
  function handleClick() {
    if (window.innerWidth < 768) {
      setMode('fullscreen')
      openPanel()
      return
    }
    togglePanel()
  }

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={[
        'fixed bottom-6 right-6 z-40',
        'w-14 h-14 rounded-full shadow-lg',
        'flex items-center justify-center',
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
  )
}

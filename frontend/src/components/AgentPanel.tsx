import React, { useEffect, useRef, useState } from 'react'
import { X, Trash2, Sparkles, Maximize2, Minimize2 } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'
import { AgentMessage } from './AgentMessage'
import { AgentInput } from './AgentInput'
import { AgentHistoryList } from './AgentHistoryList'
const S1 = String.fromCharCode(19996, 20140, 26377, 23460, 20844, 38388) + '?'
const S2 = String.fromCharCode(24110, 25105, 25214, 32, 50, 32, 20010, 24052, 21033, 30340, 21344, 22618, 23545, 23545) + '?'
const S3 = String.fromCharCode(26597, 30475, 25105, 30340, 24515, 24895, 21333)
const SUGGESTIONS = [S1, S2, S3]
function AgentHeader(props: { onMaximize: () => void; onMinimize: () => void; onClear: () => void; onClose: () => void; messagesCount: number; mode: 'floating' | 'fullscreen' }) {
  return (
    <div className='flex items-center justify-between px-4 py-3 border-b border-slate-200 select-none'>
      <div className='flex items-center gap-2'>
        <div className='w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center'>
          <Sparkles className='w-4 h-4 text-white' />
        </div>
        <div>
          <div className='font-semibold text-slate-900 text-sm'>StayAgent</div>
          <div className='text-xs text-slate-500'>你的 AI 旅術助理</div>
        </div>
      </div>
      <div className='flex items-center gap-1'>
        {props.messagesCount > 0 && (
          <button onClick={props.onClear} className='p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition' aria-label='清空对话' title='清空对话'>
            <Trash2 className='w-4 h-4' />
          </button>
        )}
        {props.mode === 'floating' ? (
          <button onClick={props.onMaximize} className='p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition' aria-label='展张全屏' title='展张全屏'>
            <Maximize2 className='w-4 h-4' />
          </button>
        ) : (
          <button onClick={props.onMinimize} className='p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition' aria-label='收起为浮动' title='收起为浮动'>
            <Minimize2 className='w-4 h-4' />
          </button>
        )}
        <button onClick={props.onClose} className='p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition' aria-label='关闭' title='关闭'>
          <X className='w-5 h-5' />
        </button>
      </div>
    </div>
  )
}
function EmptyState(props: { onSuggestion: (s: string) => void }) {
  return (
    <div className='flex flex-col items-center justify-center py-12 px-4 text-center'>
      <div className='w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mb-4'>
        <Sparkles className='w-7 h-7 text-brand-500' />
      </div>
      <h3 className='text-base font-semibold text-slate-900 mb-1'>Hi, 我是 StayAgent</h3>
      <p className='text-sm text-slate-500 max-w-xs mb-6'>能帮你搜房源、订房、加心愿单。试试下面的建议:</p>
      <div className='flex flex-col gap-2 w-full max-w-xs'>
        {SUGGESTIONS.map(function(s) { return (
          <button key={s} onClick={function() { props.onSuggestion(s) }} className='px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-left text-slate-700 text-sm hover:border-brand-300 hover:bg-brand-50 transition'>
            {s}
          </button>
        )})}
      </div>
    </div>
  )
}

function AgentPanelFloat() {
  const closePanel = useAgentStore(function(s) { return s.closePanel })
  const clearHistory = useAgentStore(function(s) { return s.clearHistory })
  const messages = useAgentStore(function(s) { return s.messages })
  const sendMessage = useAgentStore(function(s) { return s.sendMessage })
  const toggleFullscreen = useAgentStore(function(s) { return s.toggleFullscreen })
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // ============ Block 11.5: 拖动 ============
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 跳过按钮点击 (避免和最大化/关闭冲突)
    if ((e.target as HTMLElement).closest('button')) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: position?.x ?? rect.left,
      originY: position?.y ?? rect.top,
    }
    e.preventDefault()
  }

  useEffect(function() {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      let nx = d.originX + dx
      let ny = d.originY + dy
      const w = panelRef.current?.offsetWidth ?? 560
      const h = panelRef.current?.offsetHeight ?? 700
      nx = Math.max(0, Math.min(window.innerWidth - w, nx))
      ny = Math.max(0, Math.min(window.innerHeight - h, ny))
      setPosition({ x: nx, y: ny })
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return function() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [position])

  const panelStyle: React.CSSProperties = position
    ? { position: 'fixed', left: position.x, top: position.y, zIndex: 40 }
    : { position: 'fixed', right: '16px', bottom: '72px', zIndex: 40 }

  useEffect(function() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, messages.length > 0 ? messages[messages.length - 1].content : null, messages.length > 0 ? messages[messages.length - 1].id : null])

  return (
    <div ref={panelRef} style={panelStyle} className='w-[560px] max-w-[95vw] h-[700px] max-h-[80vh] rounded-2xl shadow-2xl bg-white flex flex-col overflow-hidden border border-slate-200'>
      <div onMouseDown={handleHeaderMouseDown} className='cursor-move'>
        <AgentHeader onMaximize={toggleFullscreen} onMinimize={toggleFullscreen} onClose={closePanel} onClear={clearHistory} messagesCount={messages.length} mode='floating' />
      </div>
      <div ref={scrollRef} className='flex-1 overflow-y-auto overscroll-contain px-4 py-5 bg-slate-50/50'>
        {messages.length === 0 ? (
          <EmptyState onSuggestion={sendMessage} />
        ) : (
          <div className='space-y-7'>
            {messages.map(function(m) { return <AgentMessage key={m.id} message={m} /> })}
          </div>
        )}
      </div>
      <AgentInput />
    </div>
  )
}
function AgentPanelFullscreen() {
  const closePanel = useAgentStore(function(s) { return s.closePanel })
  const clearHistory = useAgentStore(function(s) { return s.clearHistory })
  const messages = useAgentStore(function(s) { return s.messages })
  const sendMessage = useAgentStore(function(s) { return s.sendMessage })
  const toggleFullscreen = useAgentStore(function(s) { return s.toggleFullscreen })
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(function() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, messages.length > 0 ? messages[messages.length - 1].content : null, messages.length > 0 ? messages[messages.length - 1].id : null])

  return (
    <div className='fixed inset-0 z-[80] bg-white flex'>
      <aside className='w-[240px] flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col'>
        <div className='px-4 py-3 border-b border-slate-200 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center'>
              <Sparkles className='w-3.5 h-3.5 text-white' />
            </div>
            <div className='font-semibold text-slate-900 text-sm'>StayAgent</div>
          </div>
          <button onClick={toggleFullscreen} className='p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition' aria-label='收起为浮动' title='收起为浮动'>
            <Minimize2 className='w-4 h-4' />
          </button>
        </div>
        <AgentHistoryList />
      </aside>
      <main
        className='flex-1 grid bg-slate-50/30 min-w-0 overflow-hidden'
        style={{ gridTemplateRows: 'auto 1fr auto' }}
      >
        <div className='bg-white border-b border-slate-200'>
          <AgentHeader onMaximize={toggleFullscreen} onMinimize={toggleFullscreen} onClose={closePanel} onClear={clearHistory} messagesCount={messages.length} mode='fullscreen' />
        </div>
        <div ref={scrollRef} className='overflow-y-auto overscroll-contain px-6 py-6 max-w-3xl w-full mx-auto'>
          {messages.length === 0 ? (
            <EmptyState onSuggestion={sendMessage} />
          ) : (
            <div className='space-y-7'>
              {messages.map(function(m) { return <AgentMessage key={m.id} message={m} /> })}
            </div>
          )}
        </div>
        <div className='bg-white border-t border-slate-200'>
          <AgentInput />
        </div>
      </main>
    </div>
  )
}

export function AgentPanel() {
  const isOpen = useAgentStore(function(s) { return s.isOpen })
  const mode = useAgentStore(function(s) { return s.mode })

  // Block 11.5 修复: 全屏模式时锁 body 滚动, 防止背景页面 (房源列表 + 搜索栏) 跟动
  // - 锁住 body 后, 右侧滚动条消失, wheel 事件无法 bubble 到 body
  // - 卸下全屏 / 关闭面板时, cleanup 自动恢复
  useEffect(function() {
    if (!isOpen || mode !== 'fullscreen') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return function() {
      document.body.style.overflow = prev
    }
  }, [isOpen, mode])

  if (!isOpen) return null
  return mode === 'fullscreen' ? React.createElement(AgentPanelFullscreen): React.createElement(AgentPanelFloat)
}
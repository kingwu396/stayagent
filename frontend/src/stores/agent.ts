/** Agent Panel 全局状态 (Block 10)
 *
 * 消息历史仅 in-memory (Block 13 才接 DB 历史展示).
 * AbortController 在 sendMessage 时创建, cancelStream() 中断.
 */

import { create } from 'zustand'
import { agentApi } from '@/api/agent'
import type {
  AgentChatMessage,
  AgentStep,
  AgentStreamEvent,
  ConversationSummary,
  AgentRunDetail,
} from '@/types/agent'

interface AgentState {
  isOpen: boolean
  messages: AgentChatMessage[]
  isStreaming: boolean
  conversationId: number | null
  abortController: AbortController | null
  error: string | null

  // ============ Block 11 ============
  mode: 'floating' | 'fullscreen'
  conversations: ConversationSummary[]
  isHistoryLoaded: boolean
  isLoadingHistory: boolean

  // ============ actions ============
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  clearHistory: () => void
  cancelStream: () => void
  sendMessage: (text: string) => Promise<void>

  setMode: (mode: 'floating' | 'fullscreen') => void
  toggleFullscreen: () => void
  loadHistory: () => Promise<void>
  loadConversation: (convId: number) => Promise<void>
  startNewChat: () => void

  // 内部: 把 stream event 应用到 messages
  _applyEvent: (evt: AgentStreamEvent, msgId: string) => void
}

function makeMessageId() {
  return Math.random().toString(36).slice(2, 10)
}

export const useAgentStore = create<AgentState>((set, get) => ({
  isOpen: false,
  messages: [],
  isStreaming: false,
  conversationId: null,
  abortController: null,
  error: null,

  mode: 'floating',
  conversations: [],
  isHistoryLoaded: false,
  isLoadingHistory: false,

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
  clearHistory: () => set({
    messages: [],
    conversationId: null,
    error: null,
  }),

  cancelStream: () => {
    const ctrl = get().abortController
    if (ctrl) {
      ctrl.abort()
      set({ abortController: null, isStreaming: false })
    }
  },


  setMode: (mode: 'floating' | 'fullscreen') => set({ mode }),

  toggleFullscreen: () =>
    set((s) => ({ mode: s.mode === 'floating' ? 'fullscreen' : 'floating' })),

  loadHistory: async () => {
    set({ isLoadingHistory: true })
    try {
      const list = await agentApi.listConversations()
      set({ conversations: list, isHistoryLoaded: true, isLoadingHistory: false })
    } catch (err) {
      console.error('loadHistory failed', err)
      set({ isLoadingHistory: false })
    }
  },

  loadConversation: async (convId: number) => {
    try {
      const runs = await agentApi.getConversationRuns(convId)
      const messages: AgentChatMessage[] = []
      runs.sort((a, b) => a.started_at.localeCompare(b.started_at)).forEach((run, i) => {
        messages.push({ id: run.id + '-u-' + i, role: 'user', content: run.user_message })
        if (run.final_content) {
          messages.push({
            id: run.id + '-a-' + i,
            role: 'assistant',
            content: run.final_content,
            steps: run.steps || [],
            status: run.status,
            runId: run.id,
            conversationId: convId,
          })
        }
      })
      set({ messages, conversationId: convId, error: null, mode: 'fullscreen' })
    } catch (err) {
      console.error('loadConversation failed', err)
    }
  },

  startNewChat: () => set({ messages: [], conversationId: null, error: null }),

  _applyEvent: (evt, msgId) => {
    set((s) => {
      const messages = s.messages.map((m) => {
        if (m.id !== msgId) return m
        if (evt.type === 'run_started') {
          return {
            ...m,
            runId: evt.run_id,
            conversationId: evt.conversation_id,
          }
        }
        if (evt.type === 'step_started') {
          const newStep: AgentStep = {
            step_index: evt.step_index,
            tool_name: evt.tool_name,
            tool_args: evt.tool_args,
            tool_result: null,
            tool_error: null,
            reasoning: evt.reasoning,
            duration_ms: null,
          }
          return { ...m, steps: [...(m.steps || []), newStep] }
        }
        if (evt.type === 'step_completed') {
          const steps = (m.steps || []).map((st) =>
            st.step_index === evt.step_index
              ? {
                  ...st,
                  tool_result: evt.tool_result,
                  tool_error: evt.tool_error,
                  duration_ms: evt.duration_ms,
                }
              : st,
          )
          return { ...m, steps }
        }
        if (evt.type === 'final') {
          return {
            ...m,
            content: evt.content || '',
            status: evt.status,
            promptTokens: evt.prompt_tokens,
            completionTokens: evt.completion_tokens,
          }
        }
        if (evt.type === 'error') {
          return { ...m, status: 'failed', error: evt.message }
        }
        return m
      })
      const last = messages[messages.length - 1]
      const conversationId = last?.conversationId ?? s.conversationId
      return { messages, conversationId }
    })
  },

  sendMessage: async (text: string) => {
    if (!text.trim()) return
    if (get().isStreaming) return  // 防并发

    const userMsg: AgentChatMessage = {
      id: makeMessageId(),
      role: 'user',
      content: text.trim(),
    }
    const assistantMsg: AgentChatMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: '',
      steps: [],
      status: 'streaming',
    }

    // 1. 立即追加 user + 占位 assistant
    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isStreaming: true,
      error: null,
      isOpen: true,
    }))

    // 2. 创建 abort controller
    const ctrl = new AbortController()
    set({ abortController: ctrl })

    // 3. 消费 stream events
    try {
      const stream = agentApi.chatStream(
        { message: text.trim(), conversation_id: get().conversationId },
        ctrl.signal,
      )
      for await (const evt of stream) {
        get()._applyEvent(evt, assistantMsg.id)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, status: 'failed', error: '已停止' }
              : m,
          ),
        }))
      } else {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, status: 'failed', error: err.message || String(err) }
              : m,
          ),
          error: err.message || String(err),
        }))
      }
    } finally {
      set({ isStreaming: false, abortController: null })
    }
  },
}))

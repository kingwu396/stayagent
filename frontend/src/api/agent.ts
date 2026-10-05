/** Agent API: SSE 流式 chat (Block 10)
 *
 * 用 fetch + ReadableStream 解析 SSE (不用 EventSource, 因为需要 POST + Authorization).
 * 每次 chatStream() 返回一个 AsyncGenerator, 调用方逐个 yield event.
 */

import { api } from './client'
import { getToken } from './client'
import type {
  AgentStreamEvent,
  ConversationSummary,
  AgentRunDetail,
} from '@/types/agent'

export interface ChatStreamParams {
  message: string
  conversation_id?: number | null
}

export const agentApi = {
  /**
   * 流式 agent chat. 返回 AsyncGenerator, 逐个 yield event.
   *
   * 用法:
   *   for await (const evt of agentApi.chatStream({ message: '...' }, abortController.signal)) {
   *     // evt.type, evt.run_id 等
   *   }
   *
   * 支持 AbortSignal 中断 (前端 'stop' button).
   */
  async *chatStream(
    params: ChatStreamParams,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentStreamEvent> {
    const token = getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch('/api/agent/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: params.message,
        conversation_id: params.conversation_id ?? null,
      }),
      signal,
      credentials: 'include',
    })

    if (!response.ok) {
      // 401 / 4xx / 5xx
      const text = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}: ${text}`)
    }
    if (!response.body) {
      throw new Error('No response body (SSE unavailable)')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let rawBuffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        rawBuffer += decoder.decode(value, { stream: true })

        // SSE 消息以 \n\n 分隔
        const parts = rawBuffer.split('\n\n')
        rawBuffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.trim()) continue
          // 每段含 event: <type>\ndata: <json>
          const lines = part.split('\n')
          let evtType = 'message'
          let dataLine = ''
          for (const line of lines) {
            if (line.startsWith('event:')) {
              evtType = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              dataLine += line.slice(5).trim()
            }
          }
          if (!dataLine) continue
          if (evtType === 'done') return  // 终止
          try {
            const parsed = JSON.parse(dataLine) as AgentStreamEvent
            yield parsed
          } catch {
            // 忽略解析失败 (避免崩溃流)
            console.warn('[agentApi] parse SSE failed:', dataLine.slice(0, 100))
          }
        }
      }
    } finally {
      try {
        reader.releaseLock()
      } catch {
        // ignore
      }
    }
  },

  /** 同步 chat (Block 9 兼容, Block 10 UI 暂未使用) */
  async chat(params: ChatStreamParams) {
    const res = await api.post('/agent/chat', {
      message: params.message,
      conversation_id: params.conversation_id ?? null,
    })
    return res.data
  },

  /** 拉用户所有对话 (Block 11 全屏侧栏用) */
  async listConversations(): Promise<ConversationSummary[]> {
    const res = await api.get<ConversationSummary[]>('/agent/conversations')
    return res.data
  },

  /** 拉某对话的所有 run + steps (Block 11 切换历史用) */
  async getConversationRuns(convId: number): Promise<AgentRunDetail[]> {
    const res = await api.get<AgentRunDetail[]>(`/agent/conversations/${convId}/runs`)
    return res.data
  },
}

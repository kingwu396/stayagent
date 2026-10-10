/** Agent Panel 全局状态 (Block 10 → Block 22 重构)
 *
 * Block 22 核心:流与会话解耦 ——
 * - 消息按会话分桶(buckets),流式事件写入发起流的桶,与当前正在查看哪个会话无关
 *   → 生成中切到别的会话,原会话继续在后台打字,切回即续播
 * - 流式状态按会话(streamingKeys/controllers)→ A 会话生成中,B 会话可正常发送
 * - run_started 时乐观插入 conversations → 左侧列表立即出现新会话
 * - 输入框草稿按会话(drafts)→ 切换不串扰、不丢内容
 * - loadConversation 按 run.status 重建完整状态(running/cancelled/failed 都有明确视觉)
 */

import { create } from 'zustand'
import { agentApi } from '@/api/agent'
import { useAuthStore } from './auth'
import type {
  AgentChatMessage,
  AgentStep,
  AgentStreamEvent,
  ConversationSummary,
  PdfAttachment,
} from '@/types/agent'

/** 桶 key:数字会话 id 的字符串形式;未落库的新对话用 'new' */
export type ConvKey = string
export const NEW_KEY: ConvKey = 'new'

export function keyOf(conversationId: number | null): ConvKey {
  return conversationId === null ? NEW_KEY : String(conversationId)
}

const EMPTY_MESSAGES: AgentChatMessage[] = []

/** 组件用:当前查看会话的消息桶(稳定引用,空桶不触发重渲染) */
export function selectActiveMessages(s: AgentState): AgentChatMessage[] {
  return s.buckets[keyOf(s.conversationId)] ?? EMPTY_MESSAGES
}

export interface AgentDraft {
  text: string
  attachment: PdfAttachment | null
}

interface AgentState {
  isOpen: boolean
  /** 当前查看的会话;null = 新对话视图 */
  conversationId: number | null
  /** Block 22: 消息按会话分桶,key = keyOf(conversationId) */
  buckets: Record<ConvKey, AgentChatMessage[]>
  /** Block 22: 正在流式输出的会话 key 列表 */
  streamingKeys: ConvKey[]
  /** Block 22: 每个流对应的 AbortController */
  controllers: Record<ConvKey, AbortController>
  /** Block 22: 每个会话独立的输入草稿 */
  drafts: Record<ConvKey, AgentDraft>
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
  cancelStream: (key?: ConvKey) => void
  sendMessage: (text: string, attachment?: PdfAttachment | null) => Promise<void>

  setMode: (mode: 'floating' | 'fullscreen') => void
  toggleFullscreen: () => void
  loadHistory: (silent?: boolean) => Promise<void>
  loadConversation: (convId: number) => Promise<void>
  startNewChat: () => void

  // Block 22: 草稿
  setDraft: (key: ConvKey, patch: Partial<AgentDraft>) => void

  // ============ Block 11.5: HITL ============
  confirmRun: (runId: number, approved: boolean) => Promise<void>

  // ============ Block 17: 删除对话 ============
  deleteConversation: (convId: number) => Promise<void>

  // 内部: 把 stream event 应用到指定会话桶
  _applyEvent: (evt: AgentStreamEvent, msgId: string, key: ConvKey) => void
}

function makeMessageId() {
  return Math.random().toString(36).slice(2, 10)
}

/** 在指定桶里按 msgId 应用事件(纯函数) */
function applyEventToMessages(
  messages: AgentChatMessage[],
  msgId: string,
  evt: AgentStreamEvent
): AgentChatMessage[] {
  return messages.map((m) => {
    if (m.id !== msgId) return m
    if (evt.type === 'run_started') {
      // Block 29 fix: 占位消息必须在此绑定 runId —— confirmRun 靠它匹配消息,
      // 缺失会导致确认成功后消息不被更新, 确认卡永远转圈 (后端其实已下单)
      return { ...m, runId: evt.run_id, conversationId: evt.conversation_id }
    }
    if (evt.type === 'content_delta') {
      // Block 17: 累积 LLM 输出的 token (打字机效果)
      return { ...m, content: (m.content || '') + (evt.delta || ''), status: 'streaming' }
    }
    if (evt.type === 'content_discard') {
      // Block 17 v3: 丢弃 preamble, 保留 steps
      return { ...m, content: '', status: 'streaming' }
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
          : st
      )
      return { ...m, steps }
    }
    if (evt.type === 'final') {
      return {
        ...m,
        content: evt.content ?? m.content,
        status: evt.status,
        promptTokens: evt.prompt_tokens,
        completionTokens: evt.completion_tokens,
      }
    }
    if (evt.type === 'pending_confirmation') {
      return {
        ...m,
        // 防御: 即使 run_started 分支漏了, 这里也把 runId 补上
        runId: m.runId ?? evt.run_id,
        status: 'pending_confirmation',
        pendingConfirmation: {
          run_id: evt.run_id,
          step_index: evt.step_index,
          tool_name: evt.tool_name,
          tool_args: evt.tool_args,
        },
      }
    }
    if (evt.type === 'error') {
      return { ...m, status: 'failed', error: evt.message }
    }
    return m
  })
}

/** 标记某桶里一条消息为失败/中断 */
function markMessageInBucket(
  buckets: Record<ConvKey, AgentChatMessage[]>,
  key: ConvKey,
  msgId: string,
  patch: Partial<AgentChatMessage>
): Record<ConvKey, AgentChatMessage[]> {
  const bucket = buckets[key]
  if (!bucket) return buckets
  return {
    ...buckets,
    [key]: bucket.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
  }
}

export const useAgentStore = create<AgentState>((set, get) => ({
  isOpen: false,
  conversationId: null,
  buckets: {},
  streamingKeys: [],
  controllers: {},
  drafts: {},
  error: null,

  mode: 'floating',
  conversations: [],
  isHistoryLoaded: false,
  isLoadingHistory: false,

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

  clearHistory: () => {
    const key = keyOf(get().conversationId)
    // 流式中的会话先停
    if (get().streamingKeys.includes(key)) get().cancelStream(key)
    // 清空当前会话桶,并切到新对话视图(新对话桶非流式时清空)
    set((s) => ({
      buckets: {
        ...s.buckets,
        [key]: [],
        [NEW_KEY]: s.streamingKeys.includes(NEW_KEY) ? s.buckets[NEW_KEY] ?? [] : [],
      },
      conversationId: null,
      error: null,
    }))
  },

  cancelStream: (key?: ConvKey) => {
    const k = key ?? keyOf(get().conversationId)
    const ctrl = get().controllers[k]
    if (ctrl) {
      ctrl.abort()
      // streamingKeys/controllers 的清理在 sendMessage 的 finally 里统一做
    }
  },

  setMode: (mode: 'floating' | 'fullscreen') => set({ mode }),

  toggleFullscreen: () =>
    set((s) => ({ mode: s.mode === 'floating' ? 'fullscreen' : 'floating' })),

  loadHistory: async (silent = false) => {
    if (!silent) set({ isLoadingHistory: true })
    try {
      const list = await agentApi.listConversations()
      set({ conversations: list, isHistoryLoaded: true, isLoadingHistory: false })
    } catch (err) {
      console.error('loadHistory failed', err)
      if (!silent) set({ isLoadingHistory: false })
    }
  },

  loadConversation: async (convId: number) => {
    const key = String(convId)
    // Block 22: 立即切视图(草稿/桶自动跟随),不打断任何流
    set({ conversationId: convId, error: null })
    // 该会话正在后台流式 → 桶就是最新真相,跳过 fetch
    if (get().streamingKeys.includes(key)) return
    try {
      const runs = await agentApi.getConversationRuns(convId)
      const messages: AgentChatMessage[] = []
      runs.sort((a, b) => a.started_at.localeCompare(b.started_at)).forEach((run, i) => {
        messages.push({ id: run.id + '-u-' + i, role: 'user', content: run.user_message })
        // Block 22: 按 run.status 重建完整状态 —— 中断/失败都有明确视觉,不再只剩用户消息
        if (run.final_content) {
          messages.push({
            id: run.id + '-a-' + i,
            role: 'assistant',
            content: run.final_content,
            steps: run.steps || [],
            status: run.status, // completed / cancelled(含部分内容) / failed(带部分内容)
            runId: run.id,
            conversationId: convId,
          })
        } else if (run.status === 'running') {
          // 另一个标签页正在生成 / 短暂未完结:显示生成中占位
          messages.push({
            id: run.id + '-a-' + i,
            role: 'assistant',
            content: '',
            steps: run.steps || [],
            status: 'streaming',
            runId: run.id,
            conversationId: convId,
          })
        } else if (run.status === 'cancelled') {
          messages.push({
            id: run.id + '-a-' + i,
            role: 'assistant',
            content: '',
            steps: run.steps || [],
            status: 'cancelled',
            error: '已中断',
            runId: run.id,
            conversationId: convId,
          })
        } else if (run.status === 'pending_confirmation' && run.pending_tool_call) {
          // Block 29 fix: 刷新/换窗口后重建 HITL 确认卡片 (此前 pending run 落进 else 分支显示"生成失败")
          messages.push({
            id: run.id + '-a-' + i,
            role: 'assistant',
            content: '',
            steps: run.steps || [],
            status: 'pending_confirmation',
            runId: run.id,
            conversationId: convId,
            pendingConfirmation: {
              run_id: run.id,
              step_index: (run.steps?.length ?? 1) - 1,
              tool_name: run.pending_tool_call.tool_name,
              tool_args: run.pending_tool_call.tool_args,
            },
          })
        } else {
          // failed / timeout 且没有任何内容
          messages.push({
            id: run.id + '-a-' + i,
            role: 'assistant',
            content: '',
            steps: run.steps || [],
            status: run.status,
            error: run.error || (run.status === 'timeout' ? '回复超时' : '回复生成失败'),
            runId: run.id,
            conversationId: convId,
          })
        }
      })
      // fetch 期间用户可能已切走:只在仍看向该会话时写入
      if (get().conversationId === convId) {
        set((s) => ({ buckets: { ...s.buckets, [key]: messages } }))
      }
    } catch (err) {
      console.error('loadConversation failed', err)
    }
  },

  startNewChat: () => {
    // Block 22: 切到新对话视图。'new' 桶只在非流式时清空
    // (流式中说明用户刚点过发送还没拿到 run_started,保留内容避免丢消息)
    set((s) => ({
      conversationId: null,
      error: null,
      buckets: s.streamingKeys.includes(NEW_KEY)
        ? s.buckets
        : { ...s.buckets, [NEW_KEY]: [] },
    }))
  },

  setDraft: (key, patch) =>
    set((s) => {
      const prev = s.drafts[key] ?? { text: '', attachment: null }
      return {
        drafts: { ...s.drafts, [key]: { ...prev, ...patch } },
      }
    }),

  confirmRun: async (runId, approved) => {
    try {
      const run2 = await agentApi.confirmRun(runId, approved)
      // 找到对应的 assistant 消息(可能在任意桶), 用响应里的 final_content/steps/status 更新
      set((s) => {
        const buckets: Record<ConvKey, AgentChatMessage[]> = {}
        for (const [k, bucket] of Object.entries(s.buckets)) {
          buckets[k] = bucket.map((m) => {
            if (m.runId !== runId) return m
            const newSteps = (run2.steps || []).map((st) => ({
              step_index: st.step_index,
              tool_name: st.tool_name,
              tool_args: st.tool_args as any,
              tool_result: st.tool_result as any,
              tool_error: st.tool_error,
              reasoning: st.reasoning,
              duration_ms: st.duration_ms,
            }))
            return {
              ...m,
              content: run2.final_content || m.content,
              status: run2.status,
              steps: newSteps,
              pendingConfirmation: undefined,
              error: run2.error || undefined,
            }
          })
        }
        return { buckets }
      })
    } catch (err: any) {
      console.error('confirmRun failed', err)
      set({ error: err.message || String(err) })
      // Block 29 fix: rethrow 让确认卡片感知失败, 重置 loading —— 否则卡片永远转圈
      throw err
    }
  },

  deleteConversation: async (convId: number) => {
    const key = String(convId)
    // Block 22: 删除时顺带停掉该会话的流,清理桶与草稿
    if (get().streamingKeys.includes(key)) get().cancelStream(key)
    try {
      await agentApi.deleteConversation(convId)
      set((s) => {
        const buckets = { ...s.buckets }
        delete buckets[key]
        const drafts = { ...s.drafts }
        delete drafts[key]
        return {
          conversations: s.conversations.filter((c) => c.id !== convId),
          buckets,
          drafts,
          ...(s.conversationId === convId
            ? { conversationId: null, error: null }
            : {}),
        }
      })
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || '删除失败'
      throw new Error(msg)
    }
  },

  _applyEvent: (evt, msgId, key) => {
    set((s) => {
      const bucket = s.buckets[key]
      if (!bucket) return {}
      return { buckets: { ...s.buckets, [key]: applyEventToMessages(bucket, msgId, evt) } }
    })
  },

  sendMessage: async (text: string, attachment?: PdfAttachment | null) => {
    if (!text.trim() && !attachment) return
    const trimmed = text.trim()
    const startKey = keyOf(get().conversationId)

    // Block 22: 防并发改为按会话 —— 本会话在流才拒绝(调用方 AgentInput 会先 toast)
    if (get().streamingKeys.includes(startKey)) return

    const userMsg: AgentChatMessage = {
      id: makeMessageId(),
      role: 'user',
      content: trimmed,
      attachment: attachment
        ? {
            filename: attachment.filename,
            char_count: attachment.char_count,
            page_count: attachment.page_count,
          }
        : undefined,
    }
    const assistantMsg: AgentChatMessage = {
      id: makeMessageId(),
      role: 'assistant',
      content: '',
      steps: [],
      status: 'streaming',
    }

    // Block 22: 未登录拦截(EmptyState 建议按钮直接调这里, 不经过 AgentInput 的检查)
    // → 不发请求, 用引导登录的卡片代替裸 401
    if (!useAuthStore.getState().token) {
      set((s) => ({
        buckets: {
          ...s.buckets,
          [startKey]: [
            ...(s.buckets[startKey] ?? []),
            userMsg,
            {
              id: assistantMsg.id,
              role: 'assistant',
              content: '',
              status: 'failed',
              error: '请先登录后再与 StayAgent 对话',
              needLogin: true,
            },
          ],
        },
        isOpen: true,
      }))
      return
    }

    // 1. 立即追加 user + 占位 assistant 到当前桶
    set((s) => ({
      buckets: {
        ...s.buckets,
        [startKey]: [...(s.buckets[startKey] ?? []), userMsg, assistantMsg],
      },
      error: null,
      isOpen: true,
    }))

    // 2. 每个流独立 AbortController
    const ctrl = new AbortController()
    set((s) => ({
      controllers: { ...s.controllers, [startKey]: ctrl },
      streamingKeys: [...s.streamingKeys, startKey],
    }))

    let streamKey = startKey // run_started 后从未落库的 'new' 迁移到真实会话 key

    // 3. 消费 stream events
    try {
      const stream = agentApi.chatStream(
        { message: trimmed, conversation_id: get().conversationId, attachment },
        ctrl.signal,
      )
      for await (const evt of stream) {
        if (evt.type === 'run_started') {
          const convKey = String(evt.conversation_id)
          // (a) 立即反馈: 乐观插入左侧列表头部
          set((s) => {
            const buckets = { ...s.buckets }
            if (convKey !== startKey) {
              buckets[convKey] = buckets[startKey] ?? []
              if (startKey === NEW_KEY) delete buckets[NEW_KEY]
            }
            const conversations = s.conversations.some((c) => c.id === evt.conversation_id)
              ? s.conversations
              : [
                  {
                    id: evt.conversation_id,
                    title: trimmed.slice(0, 24),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    run_count: 1,
                  },
                  ...s.conversations,
                ]
            // 只有用户仍停在新对话视图时才跟随跳转,不劫持其他会话的浏览
            const conversationId =
              s.conversationId === null ? evt.conversation_id : s.conversationId
            return { buckets, conversations, conversationId }
          })
          // 流迁移到真实会话 key
          const controllers = { ...get().controllers }
          if (convKey !== startKey) {
            controllers[convKey] = controllers[startKey]
            delete controllers[startKey]
            set({ controllers })
            set((s) => ({
              streamingKeys: s.streamingKeys.map((k) => (k === startKey ? convKey : k)),
            }))
            streamKey = convKey
          }
          // 占位消息打上 run 标记
          get()._applyEvent(evt, assistantMsg.id, streamKey)
          continue
        }
        get()._applyEvent(evt, assistantMsg.id, streamKey)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // 用户主动停止: 已生成的部分保留, 灰色「已中断」标记(与后端 cancelled 状态视觉一致)
        set((s) => ({
          buckets: markMessageInBucket(s.buckets, streamKey, assistantMsg.id, {
            status: 'cancelled',
            error: undefined,
          }),
        }))
      } else {
        // 401 (token 过期/失效) → 同样给引导登录卡片, 不显示裸错误
        const is401 = err.response?.status === 401 || /401/.test(err.message || '')
        set((s) => ({
          buckets: markMessageInBucket(s.buckets, streamKey, assistantMsg.id, {
            status: 'failed',
            error: is401 ? '登录已过期, 请重新登录后再与 StayAgent 对话' : err.message || String(err),
            needLogin: is401 || undefined,
          }),
          error: is401 ? undefined : err.message || String(err),
        }))
      }
    } finally {
      // 清理本流的运行态;(a) 流结束后静默校准左侧列表排序/标题
      set((s) => {
        const controllers = { ...s.controllers }
        delete controllers[streamKey]
        return {
          streamingKeys: s.streamingKeys.filter((k) => k !== streamKey),
          controllers,
        }
      })
      get().loadHistory(true)
    }
  },
}))

// Block 22: 登录成功后清掉未登录期间留下的「新对话」桶(用户消息 + 需要登录卡片),
// 否则登录后再打开面板还会看到「需要登录」
useAuthStore.subscribe((state, prev) => {
  if (state.token && !prev.token) {
    useAgentStore.setState((s) => {
      const bucket = s.buckets[NEW_KEY]
      if (!bucket || bucket.length === 0) return {}
      return { buckets: { ...s.buckets, [NEW_KEY]: [] } }
    })
  }
})

/** 对齐后端 app/schemas/agent.py 的输出 */

export interface AgentStep {
  step_index: number
  tool_name: string | null
  tool_args: (string | number | boolean | null | object)[] | object | null
  tool_result: object | null
  tool_error: string | null
  reasoning: string | null
  duration_ms: number | null
}

export interface AgentChatMessage {
  id: string             // client-side uuid (用于 React key)
  role: 'user' | 'assistant'
  content: string
  steps?: AgentStep[]    // assistant 消息附带的 tool step 轨迹
  status?: string  // 'streaming' | 'completed' | 'failed' | 'timeout'
  error?: string
  runId?: number
  conversationId?: number
}

// ============ SSE 流事件 ============

export interface RunStartedEvent {
  type: 'run_started'
  run_id: number
  conversation_id: number
}

export interface StepStartedEvent {
  type: 'step_started'
  step_index: number
  tool_name: string | null
  tool_args: AgentStep['tool_args']
  reasoning: string | null
}

export interface StepCompletedEvent {
  type: 'step_completed'
  step_index: number
  tool_result: AgentStep['tool_result']
  tool_error: string | null
  duration_ms: number | null
}

export interface FinalEvent {
  type: 'final'
  run_id: number
  conversation_id: number
  status: 'completed' | 'failed' | 'timeout'
  content: string | null
  prompt_tokens: number
  completion_tokens: number
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export type AgentStreamEvent =
  | RunStartedEvent
  | StepStartedEvent
  | StepCompletedEvent
  | FinalEvent
  | ErrorEvent


// ============ Block 11: 历史对话 ============

export interface ConversationSummary {
  id: number
  title: string | null
  created_at: string
  updated_at: string
  run_count: number
}

export interface AgentRunDetail {
  id: number
  user_message: string
  status: string
  final_content: string | null
  steps: AgentStep[]
  started_at: string
  finished_at: string | null
}

import { useEffect, useRef, useState } from 'react'
import { Send, Square, Sparkles, Paperclip, X, Loader2, FileText } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/auth'
import { uploadsApi } from '@/api/uploads'
import type { PdfAttachment } from '@/types/agent'

export function AgentInput() {
  const [text, setText] = useState('')
  // Block 12: PDF 附件状态 (本地 state, 不上 store, 发送完即清)
  const [attachment, setAttachment] = useState<PdfAttachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendMessage = useAgentStore((s) => s.sendMessage)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const cancelStream = useAgentStore((s) => s.cancelStream)
  const token = useAuthStore((s) => s.token)
  const toast = useToast()

  // 自动 grow textarea (1 → 6 行)
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 24
    const maxHeight = lineHeight * 6
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
  }, [text])

  function handleSend() {
    if (!text.trim() && !attachment) return
    if (!token) {
      toast.warning('请先登录后再使用 StayAgent')
      window.location.href = '/login'
      return
    }
    // Block 12 fix: 不再把 PDF text 拼到 message 里, 走单独 attachment 字段.
    // 用户消息气泡只显示打的文字 (attachment 元数据单独渲染 chip).
    sendMessage(text.trim(), attachment)
    setText('')
    setAttachment(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // 重置 input value, 允许重复选同一文件
    e.target.value = ''
    if (!token) {
      toast.warning('请先登录后再上传 PDF')
      return
    }
    if (file.type !== 'application/pdf') {
      toast.error('仅支持 PDF 文件')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('文件超过 10MB 上限')
      return
    }
    setUploading(true)
    try {
      const att = await uploadsApi.uploadPdf(file)
      setAttachment(att)
      toast.success(`已解析 ${att.filename} (${att.page_count} 页, ${att.char_count} 字)`)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || '上传失败'
      toast.error(`上传失败: ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border-t border-slate-200 p-3 bg-white">
      {/* Block 12: 附件 chip */}
      {attachment && (
        <div className="mb-2 flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-1.5 text-xs">
          <FileText className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
          <div className="flex-1 min-w-0 truncate">
            <span className="font-medium text-slate-800">{attachment.filename}</span>
            <span className="text-slate-500 ml-2">
              {attachment.page_count} 页 · {attachment.char_count} 字
            </span>
          </div>
          <button
            onClick={() => setAttachment(null)}
            className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition"
            aria-label="移除附件"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200 focus-within:border-brand-300 transition">
        <Sparkles className="w-4 h-4 text-brand-500 flex-shrink-0 mb-1.5" />

        {/* Block 12: paperclip 上传按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || isStreaming || !token}
          className="flex-shrink-0 mb-1 p-1 text-slate-400 hover:text-brand-500 disabled:opacity-30 transition"
          aria-label="上传 PDF"
          title="上传 PDF (10MB 以内)"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachment ? '补充点问题, 或直接发送...' : '问点什么, 比如东京便宜公寓...'}
          className="flex-1 resize-none bg-transparent outline-none text-sm leading-6 placeholder:text-slate-400 max-h-32"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            onClick={cancelStream}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-800 text-white flex items-center justify-center transition"
            aria-label="停止"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() && !attachment}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white flex items-center justify-center transition disabled:cursor-not-allowed"
            aria-label="发送"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="text-[10px] text-slate-400 text-center mt-2">
        Enter 发送 · Shift+Enter 换行 · 📎 上传 PDF
      </div>
    </div>
  )
}

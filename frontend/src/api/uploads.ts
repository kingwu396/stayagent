/** 上传 API (Block 12)
 *
 * PDF 上传 -> 后端 pdfplumber 抽文本 -> 返回 PdfAttachment
 */
import { api } from './client'
import type { PdfAttachment } from '@/types/agent'

export const uploadsApi = {
  async uploadPdf(file: File): Promise<PdfAttachment> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<PdfAttachment>('/uploads/pdf', formData, {
      headers: {
        // multipart 需手动指定 type, 浏览器会自动加 boundary
        'Content-Type': 'multipart/form-data',
      },
      // 上传 PDF 可能慢, 拉长 timeout 到 30s
      timeout: 30000,
    })
    return res.data
  },
}

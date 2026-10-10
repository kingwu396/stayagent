/** 上传 API (Block 12 PDF + Block 27 图片)
 *
 * PDF 上传 -> 后端 pdfplumber 抽文本 -> 返回 PdfAttachment
 * 图片上传 -> 存后端本地 -> 返回可直接存进 Listing.images 的相对 URL
 */
import { api } from './client'
import type { PdfAttachment } from '@/types/agent'

export interface ImageUploadResponse {
  url: string
  filename: string
  size: number
}

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

  /** Block 27: 房源图片上传 (jpeg/png/webp, <= 5MB) */
  async uploadImage(file: File): Promise<ImageUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await api.post<ImageUploadResponse>('/uploads/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    })
    return res.data
  },
}

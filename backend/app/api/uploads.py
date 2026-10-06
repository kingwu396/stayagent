"""PDF 上传 API (Block 12)

POST /api/uploads/pdf: multipart 上传 PDF, 用 pdfplumber 抽取文本, 返回 {file_id, text, ...}

约束:
- 需要登录 (CurrentUser)
- 仅 application/pdf
- 单文件 <= 10 MB
- 保存到 /tmp/stayagent_uploads/{uuid}.pdf (不立即清理, 靠 OS 周期性 tmp 清理)

后续 Block 可以加 DELETE /api/uploads/pdf/{file_id}, 本次不做.
"""
import logging
import os
import uuid

import pdfplumber
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.deps import CurrentUser
from app.schemas.upload import PdfUploadResponse

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = "/tmp/stayagent_uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"application/pdf"}


@router.post("/pdf", response_model=PdfUploadResponse)
async def upload_pdf(
    current_user: CurrentUser,
    file: UploadFile = File(..., description="PDF 文件"),
):
    """上传 PDF, 后端用 pdfplumber 提取全文"""
    # 1. 类型校验
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"仅接受 PDF (当前 content_type={file.content_type})",
        )

    # 3. 读字节 + 大小校验
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"文件超过 {MAX_FILE_SIZE // (1024 * 1024)} MB 上限",
        )
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件为空",
        )

    # 4. 保存到 /tmp
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_id = uuid.uuid4().hex
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    try:
        with open(save_path, "wb") as f:
            f.write(content)
    except OSError as e:
        logger.exception("PDF save failed")
        raise HTTPException(status_code=500, detail=f"保存失败: {e}")

    # 5. pdfplumber 抽文本
    text_parts: list[str] = []
    page_count = 0
    try:
        with pdfplumber.open(save_path) as pdf:
            page_count = len(pdf.pages)
            for page in pdf.pages:
                t = page.extract_text() or ""
                if t.strip():
                    text_parts.append(t)
    except Exception as e:
        logger.exception("pdfplumber extract failed")
        # 清理已保存的文件
        try:
            os.remove(save_path)
        except OSError:
            pass
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"PDF 解析失败: {e}",
        )

    text = "\n\n".join(text_parts).strip()
    if not text:
        # PDF 是图片型 (扫描件), 没抽出文字
        try:
            os.remove(save_path)
        except OSError:
            pass
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="PDF 解析为空 (可能是扫描件, 不支持 OCR)",
        )

    logger.info(
        "PDF upload: user=%d, file=%s (%d KB, %d pages, %d chars)",
        current_user.id, file.filename or "?", len(content) // 1024, page_count, len(text),
    )

    return PdfUploadResponse(
        file_id=file_id,
        filename=file.filename or "untitled.pdf",
        text=text,
        char_count=len(text),
        page_count=page_count,
        summary=None,  # 不在上传时生成 summary (省 LLM 调用, 让前端拿到 text 后自己决定)
    )

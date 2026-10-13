"""上传 API

- POST /api/uploads/pdf  (Block 12): PDF 上传 + pdfplumber 抽文本
- POST /api/uploads/image (Block 27): 房源图片上传
- GET  /api/uploads/images/{filename} (Block 27): 图片访问 (挂在 /api 下, vite proxy 免改)

PDF 约束:
- 需要登录 (CurrentUser)
- 仅 application/pdf
- 单文件 <= 10 MB
- 保存到 /tmp/stayagent_uploads/{uuid}.pdf (不立即清理, 靠 OS 周期性 tmp 清理)

图片约束 (Block 27):
- 需要登录 (CurrentUser)
- 仅 jpeg / png / webp
- 单文件 <= 5 MB
- 存 settings.upload_dir (默认 ./uploads/images, .gitignore 已排除)
- 演示项目不做孤儿图片清理 (房源删了文件保留)
"""
import logging
import os
import uuid

import pdfplumber
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.config import settings
from app.deps import CurrentUser
from app.schemas.upload import ImageUploadResponse, PdfUploadResponse

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


# ============ Block 27: 房源图片上传 ============

IMAGE_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/image", response_model=ImageUploadResponse)
async def upload_image(
    current_user: CurrentUser,
    file: UploadFile = File(..., description="图片文件 (jpeg/png/webp)"),
):
    """上传房源图片, 返回可直接存进 Listing.images 的相对 URL"""
    ext = IMAGE_CONTENT_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"仅接受 JPEG/PNG/WebP (当前 content_type={file.content_type})",
        )

    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"图片超过 {MAX_IMAGE_SIZE // (1024 * 1024)} MB 上限",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="文件为空")

    os.makedirs(settings.upload_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(settings.upload_dir, filename)
    try:
        with open(save_path, "wb") as f:
            f.write(content)
    except OSError as e:
        logger.exception("image save failed")
        raise HTTPException(status_code=500, detail=f"保存失败: {e}")

    logger.info(
        "Image upload: user=%d, file=%s (%d KB) -> %s",
        current_user.id, file.filename or "?", len(content) // 1024, filename,
    )
    return ImageUploadResponse(
        url=f"/api/uploads/images/{filename}",
        filename=file.filename or "untitled",
        size=len(content),
    )


# Block 32: 本地化图片子目录白名单 (localize_images.py 下载的 picsum/城市/评价图)
IMAGE_SUBDIRS = {"picsum", "cities", "reviews"}


@router.get("/images/{file_path:path}")
async def get_image(file_path: str):
    """图片访问 (无需登录, 房源图本就是公开数据). 挂 /api 前缀走 vite proxy.

    支持两种路径:
    - {filename}          用户上传图 (Block 27)
    - {subdir}/{filename} 本地化图 (Block 32, subdir 限白名单)
    """
    # 防目录穿越
    if not file_path or ".." in file_path or "\\" in file_path:
        raise HTTPException(status_code=400, detail="非法文件名")
    parts = file_path.split("/")
    if len(parts) == 1:
        rel = parts[0]
    elif len(parts) == 2 and parts[0] in IMAGE_SUBDIRS and parts[1]:
        rel = os.path.join(parts[0], parts[1])
    else:
        raise HTTPException(status_code=400, detail="非法文件名")
    path = os.path.join(settings.upload_dir, rel)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="图片不存在")
    return FileResponse(path)

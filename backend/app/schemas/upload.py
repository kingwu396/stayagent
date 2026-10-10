"""上传相关 schema (Block 12)"""
from pydantic import BaseModel, Field


class PdfUploadResponse(BaseModel):
    """PDF 上传后返回的元数据 + 抽取文本"""
    file_id: str = Field(description="UUID, 用于引用本次上传")
    filename: str = Field(description="原始文件名")
    text: str = Field(description="pdfplumber 抽取的全文")
    char_count: int = Field(description="text 字符数")
    page_count: int = Field(description="PDF 页数")
    summary: str | None = Field(default=None, description="1 句中文摘要 (可选)")


class PdfUploadError(BaseModel):
    error: str
    code: str  # "INVALID_TYPE" | "TOO_LARGE" | "EXTRACT_FAILED"


class ImageUploadResponse(BaseModel):
    """Block 27: 图片上传返回可直接存进 Listing.images 的相对 URL"""
    url: str = Field(description='相对 URL, 如 "/api/uploads/images/xxx.jpg"')
    filename: str = Field(description="原始文件名")
    size: int = Field(description="字节数")

"""TravelTip: RAG 知识库 (Block 12)

字段说明:
- embedding: JSON 列存储 list[float], sentence-transformers all-MiniLM-L6-v2 输出 384 维
- content: 旅行贴士正文, 中英文皆可 (LLM 在 RAG 时会读)
- category: 枚举字符串 (visa/transport/food/safety/culture), 不上 DB enum 方便后续扩展
- destination: 可选关联城市 (如 Tokyo), 用于按城市过滤

索引策略:
- category 过滤频繁, 加 idx_category
- destination 过滤也用得到, 加 idx_destination
- 不建 embedding 向量索引 (库小, 全量 30 条排序即可; 规模上去后改用向量 DB)
"""
from datetime import datetime
from sqlalchemy import (
    BigInteger, String, Text, DateTime, JSON, Index, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TravelTip(Base):
    __tablename__ = "travel_tips"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    destination: Mapped[str | None] = mapped_column(String(100), nullable=True)
    embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_category", "category"),
        Index("idx_destination", "destination"),
        Index("idx_category_destination", "category", "destination"),
    )

    def __repr__(self) -> str:
        return f"<TravelTip id={self.id} title='{self.title[:30]}' cat={self.category}>"

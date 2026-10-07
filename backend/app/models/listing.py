from datetime import datetime
from decimal import Decimal
from sqlalchemy import BigInteger, String, Text, Integer, DECIMAL, DateTime, Enum, ForeignKey, JSON, func, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    host_name: Mapped[str] = mapped_column(String(100), nullable=False)

    city: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 7), nullable=True)

    property_type: Mapped[str] = mapped_column(
        Enum("apartment", "house", "villa", "hotel", "studio", name="property_type_enum"),
        nullable=False,
    )

    price_per_night: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    cleaning_fee: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), default=Decimal("0"))
    service_fee: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), default=Decimal("0"))

    max_guests: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    bedrooms: Mapped[int] = mapped_column(Integer, default=1)
    beds: Mapped[int] = mapped_column(Integer, default=1)
    bathrooms: Mapped[int] = mapped_column(Integer, default=1)

    rating: Mapped[Decimal] = mapped_column(DECIMAL(2, 1), default=Decimal("0"))
    review_count: Mapped[int] = mapped_column(Integer, default=0)

    # Block 15: 多租户 + 访问计数
    host_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")

    # JSON 字段：amenities 和 images 都是 list[str]
    # SQLAlchemy 2.0 的 JSON 类型跨 MySQL/PostgreSQL/SQLite 都通用
    amenities: Mapped[list | None] = mapped_column(JSON, nullable=True)
    images: Mapped[list | None] = mapped_column(JSON, nullable=True)

    @property
    def primary_image(self) -> str | None:
        """首图。schema 的 from_attributes 序列化（如 wishlist items）依赖此属性"""
        return (self.images or [None])[0] if self.images else None

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_city", "city"),
        Index("idx_price", "price_per_night"),
        Index("idx_city_type", "city", "property_type"),
    )

    def __repr__(self) -> str:
        return f"<Listing id={self.id} city={self.city} type={self.property_type}>"

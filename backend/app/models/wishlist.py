from datetime import datetime
from sqlalchemy import (
    BigInteger, String, DateTime, ForeignKey, UniqueConstraint, Index, Enum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Wishlist(Base):
    __tablename__ = "wishlists"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    items: Mapped[list["WishlistItem"]] = relationship(
        back_populates="wishlist", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uk_user_name"),
        Index("idx_user", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Wishlist id={self.id} user={self.user_id} name={self.name!r}>"


class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    wishlist_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("wishlists.id", ondelete="CASCADE"), nullable=False
    )
    listing_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    wishlist: Mapped["Wishlist"] = relationship(back_populates="items")
    listing: Mapped["Listing"] = relationship()

    __table_args__ = (
        UniqueConstraint("wishlist_id", "listing_id", name="uk_wishlist_listing"),
    )

    def __repr__(self) -> str:
        return f"<WishlistItem wishlist={self.wishlist_id} listing={self.listing_id}>"

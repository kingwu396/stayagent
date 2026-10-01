# 导入所有模型，让 Base.metadata 能找到它们（create_all 用）
from app.models.user import User  # noqa: F401
from app.models.listing import Listing  # noqa: F401
from app.models.wishlist import Wishlist, WishlistItem  # noqa: F401
from app.models.booking import Booking  # noqa: F401

__all__ = ["User", "Listing", "Wishlist", "WishlistItem", "Booking"]

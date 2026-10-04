"""FastAPI 依赖注入"""
from typing import Annotated
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import decode_token
from app.core.redis_client import get_redis, is_available
from app.models import User


DBSession = Annotated[Session, Depends(get_db)]


async def get_current_user(
    db: DBSession,
    authorization: str | None = Header(default=None),
) -> User:
    """
    从 Authorization: Bearer <token> 解析当前用户
    - 没有 token → 401
    - token 无效/过期 → 401
    - access 被登出撤销（在黑名单里）→ 401
    - 用户不存在 → 401
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="认证格式错误，应为 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(parts[1], expected_type="access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌无效或已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    jti = payload.get("jti")
    if not user_id_str or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌内容无效",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 🔥 检查 access 黑名单（Redis 可选）
    if await is_available():
        try:
            redis = await get_redis()
            is_blacklisted = await redis.exists(f"access_blacklist:{jti}")
            if is_blacklisted:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="令牌已被撤销",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except HTTPException:
            raise
        except Exception:
            # Redis 故障不阻断请求，但记日志（这里简单 pass）
            pass

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌内容无效",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]

"""认证相关 API：注册 / 登录 / 刷新 / 登出 / 当前用户"""
from typing import Annotated
from datetime import datetime, timezone
from fastapi import APIRouter, Cookie, Header, HTTPException, Response, status
from sqlalchemy import or_, select
from jose import jwt as jose_jwt

from app.deps import DBSession, CurrentUser
from app.models import User
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    CurrentUserResponse,
    LogoutResponse,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.redis_client import get_redis, is_available
from app.config import settings

router = APIRouter()

async def _require_redis():
    """Redis 不可用时返 503"""
    if not await is_available():
        raise HTTPException(
            status_code=503,
            detail="Redis 不可用，认证功能暂时关闭。请跑 `make redis` 或 `redis-server` 启动 Redis。",
        )

REFRESH_COOKIE_NAME = "refresh_token"


# ============ Cookie 辅助 ============

def _set_refresh_cookie(response: Response, refresh_token: str, max_age: int) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/auth")


def _extract_jti(token: str) -> str:
    """从 JWT 中提取 jti（不验签，只读 payload）"""
    try:
        payload = jose_jwt.get_unverified_claims(token)
        return payload.get("jti", "")
    except Exception:
        return ""


# ============ 注册 ============

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: DBSession):
    existing = db.execute(
        select(User).where(
            or_(User.email == payload.email, User.username == payload.username)
        )
    ).scalar_one_or_none()

    if existing:
        if existing.email == payload.email:
            raise HTTPException(status_code=400, detail="邮箱已被注册")
        if existing.username == payload.username:
            raise HTTPException(status_code=400, detail="用户名已被占用")

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_host=payload.is_host,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ============ 登录 ============

@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, response: Response, db: DBSession):
    user = db.execute(
        select(User).where(
            or_(User.email == payload.account, User.username == payload.account)
        )
    ).scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")

    # 签发 access + refresh
    access_token, _access_jti, access_exp = create_access_token(user.id)
    refresh_token, refresh_jti, refresh_exp = create_refresh_token(user.id)

    # Redis: refresh 白名单
    await _require_redis()
    redis = await get_redis()
    await redis.set(f"refresh:{refresh_jti}", str(user.id), ex=refresh_exp)

    # 设 refresh cookie
    _set_refresh_cookie(response, refresh_token, refresh_exp)

    return LoginResponse(
        access_token=access_token,
        expires_in=access_exp,
        user=RegisterResponse.model_validate(user),
    )


# ============ 刷新（rotation）============

@router.post("/refresh", response_model=LoginResponse)
async def refresh(
    response: Response,
    db: DBSession,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
):
    await _require_redis()
    if not refresh_token:
        raise HTTPException(status_code=401, detail="缺少 refresh token")

    payload = decode_token(refresh_token, expected_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="refresh token 无效或已过期")

    user_id_str = payload.get("sub")
    old_jti = payload.get("jti")
    if not user_id_str or not old_jti:
        raise HTTPException(status_code=401, detail="refresh token 内容无效")

    redis = await get_redis()

    # 白名单校验
    stored_user_id = await redis.get(f"refresh:{old_jti}")
    if stored_user_id is None:
        raise HTTPException(status_code=401, detail="refresh token 已撤销，请重新登录")

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="refresh token 内容无效")

    if int(stored_user_id) != user_id:
        raise HTTPException(status_code=401, detail="refresh token 与用户不匹配")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    # Rotation：删旧 → 签新
    await redis.delete(f"refresh:{old_jti}")
    new_access, _na_jti, access_exp = create_access_token(user.id)
    new_refresh, new_refresh_jti, refresh_exp = create_refresh_token(user.id)
    await redis.set(f"refresh:{new_refresh_jti}", str(user.id), ex=refresh_exp)

    _set_refresh_cookie(response, new_refresh, refresh_exp)

    return LoginResponse(
        access_token=new_access,
        expires_in=access_exp,
        user=RegisterResponse.model_validate(user),
    )


# ============ 登出 ============

@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    authorization: Annotated[str | None, Header()] = None,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)] = None,
):
    await _require_redis()
    redis = await get_redis()

    # 1. 撤销 refresh
    if refresh_token:
        payload = decode_token(refresh_token, expected_type="refresh")
        if payload and payload.get("jti"):
            await redis.delete(f"refresh:{payload['jti']}")

    # 2. access 黑名单（TTL = 剩余有效秒数）
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            payload = decode_token(parts[1], expected_type="access")
            if payload and payload.get("jti") and payload.get("exp"):
                remaining = int(payload["exp"]) - int(datetime.now(timezone.utc).timestamp())
                if remaining > 0:
                    await redis.set(f"access_blacklist:{payload['jti']}", "1", ex=remaining)

    _clear_refresh_cookie(response)
    return LogoutResponse()


# ============ 当前用户 ============

@router.get("/me", response_model=CurrentUserResponse)
async def get_me(current_user: CurrentUser):
    return current_user

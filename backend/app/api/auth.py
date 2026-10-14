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

# 原子 GET+DEL (等价 GETDEL, 但兼容 Redis 2.6+; 旧版本没有 GETDEL 命令)
_GETDEL_LUA = """
local v = redis.call('GET', KEYS[1])
if v then
  redis.call('DEL', KEYS[1])
end
return v
"""


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


# ============ 单会话 (Block 34): 新登录踢掉其他设备 ============
# 每用户在 Redis 只保留"当前会话"的 jti 对. 新登录时:
#   1. 旧 access jti 进黑名单 → deps.py 每请求都查黑名单, 旧设备下一次请求立即 401
#   2. 旧 refresh 白名单条目删除 → 旧设备续期失败, 前端 auth-expired 流程自动登出

async def _kick_previous_session(redis, user_id: int) -> None:
    """把该用户之前的会话作废 (旧 access 拉黑 + 旧 refresh 白名单删除)"""
    old_access_jti = await redis.get(f"session_access:{user_id}")
    if old_access_jti:
        # 不知道旧 token 剩余寿命, 按 access 最长寿命拉黑 (15 分钟后自动过期, 无残留)
        await redis.set(
            f"access_blacklist:{old_access_jti}", "1",
            ex=settings.access_token_expire_minutes * 60,
        )
    old_refresh_jti = await redis.get(f"session_refresh:{user_id}")
    if old_refresh_jti:
        await redis.delete(f"refresh:{old_refresh_jti}")


async def _bind_session(redis, user_id: int, access_jti: str, refresh_jti: str) -> None:
    """记录该用户当前会话的 jti 对, TTL 与对应 token 一致"""
    await redis.set(
        f"session_access:{user_id}", access_jti,
        ex=settings.access_token_expire_minutes * 60,
    )
    await redis.set(
        f"session_refresh:{user_id}", refresh_jti,
        ex=settings.refresh_token_expire_days * 86400,
    )


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

def _find_user_by_account(db, account: str) -> User | None:
    """账号可以是 email 或 username (登录端点与 MCP login 工具共用)"""
    return db.execute(
        select(User).where(or_(User.email == account, User.username == account))
    ).scalar_one_or_none()


async def issue_session(
    redis, user: User, *, kick: bool
) -> tuple[str, str, int, int]:
    """签发 access + refresh 并写入 refresh 白名单.

    kick=True: 执行 Block 34 单会话踢人 + 会话绑定 (HTTP login 用)
    kick=False: 只发 token, 不碰 session_* 槽 (MCP 独立会话用,
                避免与浏览器会话互踢 —— Block 35)
    返回: (access_token, refresh_token, access_exp, refresh_exp)
    """
    access_token, access_jti, access_exp = create_access_token(user.id)
    refresh_token, refresh_jti, refresh_exp = create_refresh_token(user.id)
    await redis.set(f"refresh:{refresh_jti}", str(user.id), ex=refresh_exp)
    if kick:
        await _kick_previous_session(redis, user.id)
        await _bind_session(redis, user.id, access_jti, refresh_jti)
    return access_token, refresh_token, access_exp, refresh_exp


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, response: Response, db: DBSession):
    user = _find_user_by_account(db, payload.account)

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")

    await _require_redis()
    redis = await get_redis()
    access_token, refresh_token, access_exp, refresh_exp = await issue_session(
        redis, user, kick=True
    )

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

    # 白名单校验 + 一次性消费（原子 GET+DEL）:
    # 并发两个请求带同一 refresh cookie 时（如双标签页同时静默续期），
    # 只有第一个能拿到值，第二个拿到 None → 401。
    # 保证 rotation 的"一个 refresh token 只能换一次"是原子语义，而不是 check-then-delete 竞态。
    # 用 Lua 而非 GETDEL: GETDEL 需要 Redis 6.2+, 服务器 Redis 旧版本会 unknown command → 500
    stored_user_id = await redis.eval(_GETDEL_LUA, 1, f"refresh:{old_jti}")
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

    # Rotation：旧 token 已被 getdel 原子消费，直接签发新 token 对
    new_access, _na_jti, access_exp = create_access_token(user.id)
    new_refresh, new_refresh_jti, refresh_exp = create_refresh_token(user.id)
    await redis.set(f"refresh:{new_refresh_jti}", str(user.id), ex=refresh_exp)

    # Block 34: rotation 更新会话绑定; 旧 access 拉黑 (正常流转时它已过期, 拉黑是防御性兜底)
    old_access_jti = await redis.get(f"session_access:{user_id}")
    if old_access_jti:
        await redis.set(
            f"access_blacklist:{old_access_jti}", "1",
            ex=settings.access_token_expire_minutes * 60,
        )
    await _bind_session(redis, user.id, _na_jti, new_refresh_jti)

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
    user_id_for_session: int | None = None
    if refresh_token:
        payload = decode_token(refresh_token, expected_type="refresh")
        if payload and payload.get("jti"):
            await redis.delete(f"refresh:{payload['jti']}")
            try:
                user_id_for_session = int(payload.get("sub", ""))
            except ValueError:
                pass

    # 2. access 黑名单（TTL = 剩余有效秒数）
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            payload = decode_token(parts[1], expected_type="access")
            if payload and payload.get("jti") and payload.get("exp"):
                remaining = int(payload["exp"]) - int(datetime.now(timezone.utc).timestamp())
                if remaining > 0:
                    await redis.set(f"access_blacklist:{payload['jti']}", "1", ex=remaining)

    # 3. Block 34: 清会话绑定 (登出后重新登录不再"踢"到幽灵会话)
    if user_id_for_session:
        await redis.delete(f"session_access:{user_id_for_session}", f"session_refresh:{user_id_for_session}")

    _clear_refresh_cookie(response)
    return LogoutResponse()


# ============ 当前用户 ============

@router.get("/me", response_model=CurrentUserResponse)
async def get_me(current_user: CurrentUser):
    return current_user

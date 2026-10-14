"""MCP 登录态管理 (Block 35)

进程内存保存当前会话 (access + refresh token), 不落盘 —— stdio 进程生命周期
= 客户端会话生命周期, 重启最多重新 login 一次.

与 Block 34 单会话的关系: MCP 登录用 issue_session(kick=False) 建立独立会话,
不碰 session_* 槽, 与浏览器会话互不干扰 (详见 docs/mcp.md 的边界说明).
"""
import logging
from typing import Optional

from app.core.security import decode_token
from app.core.redis_client import is_available, get_redis
from app.api.auth import _find_user_by_account, issue_session
from app.core.security import verify_password
from app.models import User
from app.services.agent.tools import ToolError

logger = logging.getLogger(__name__)

# 进程级单会话 (本地个人 MCP 场景: 一个 server 实例对应一个登录用户)
_session: Optional[dict] = None


def logged_in() -> bool:
    return _session is not None


def current_user_id() -> Optional[int]:
    return _session["user_id"] if _session else None


def reset() -> None:
    """清空登录态 (测试用)"""
    global _session
    _session = None


async def login(db, account: str, password: str) -> dict:
    """MCP 登录: 账号(email/username) + 密码 → 独立会话. 返回用户摘要."""
    global _session
    if not account or not account.strip():
        raise ToolError("账号不能为空", code="INVALID_ARGS")
    if not password:
        raise ToolError("密码不能为空", code="INVALID_ARGS")
    if not await is_available():
        raise ToolError(
            "Redis 不可用，认证功能暂时关闭。请先启动 Redis (make redis)。",
            code="REDIS_UNAVAILABLE",
        )

    user = _find_user_by_account(db, account.strip())
    if not user or not verify_password(password, user.password_hash):
        raise ToolError("账号或密码错误", code="AUTH_FAILED")

    redis = await get_redis()
    # kick=False: 独立会话, 不踢浏览器
    access_token, refresh_token, access_exp, refresh_exp = await issue_session(
        redis, user, kick=False
    )
    _session = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user_id": user.id,
        "access_exp": access_exp,  # 剩余秒数
    }
    logger.info("MCP login: user %s (独立会话)", user.id)
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "is_host": bool(user.is_host),
        "message": "登录成功。收藏/下单/行程类工具已解锁；本会话独立于浏览器登录，互不影响。",
    }


async def _rotation(db) -> None:
    """用 refresh token 换新 access (照抄 /refresh 端点的语义, 但无 cookie/HTTP)."""
    global _session
    redis = await get_redis()
    payload = decode_token(_session["refresh_token"], expected_type="refresh")
    if not payload:
        raise ToolError("登录已过期，请调用 stayagent_login 重新登录", code="AUTH_EXPIRED")
    user_id_str, old_jti = payload.get("sub"), payload.get("jti")
    if not user_id_str or not old_jti:
        raise ToolError("登录已过期，请调用 stayagent_login 重新登录", code="AUTH_EXPIRED")

    # 原子消费旧 refresh (与 auth.py 同款 Lua GET+DEL, 兼容旧版 Redis)
    from app.api.auth import _GETDEL_LUA

    stored_user_id = await redis.eval(_GETDEL_LUA, 1, f"refresh:{old_jti}")
    if stored_user_id is None or int(stored_user_id) != int(user_id_str):
        raise ToolError("登录已过期，请调用 stayagent_login 重新登录", code="AUTH_EXPIRED")

    user = db.get(User, int(user_id_str))
    if not user:
        raise ToolError("登录已过期，请调用 stayagent_login 重新登录", code="AUTH_EXPIRED")

    access_token, refresh_token, access_exp, refresh_exp = await issue_session(
        redis, user, kick=False
    )
    _session = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user_id": user.id,
        "access_exp": access_exp,
    }


async def resolve_user(db) -> User:
    """校验当前会话并返回 User; access 失效时自动用 refresh 续期."""
    if not _session:
        raise ToolError("请先调用 stayagent_login 登录后使用该工具", code="AUTH_REQUIRED")

    payload = decode_token(_session["access_token"], expected_type="access")
    valid = payload is not None
    if valid:
        # 与 deps.py 同款黑名单检查 (Redis 故障放行, 不阻断)
        try:
            if await is_available():
                redis = await get_redis()
                if await redis.exists(f"access_blacklist:{payload['jti']}"):
                    valid = False
        except Exception:
            logger.warning("Redis 黑名单检查失败, 放行", exc_info=True)

    if not valid:
        await _rotation(db)

    user = db.get(User, _session["user_id"])
    if not user:
        raise ToolError("登录已过期，请调用 stayagent_login 重新登录", code="AUTH_EXPIRED")
    return user

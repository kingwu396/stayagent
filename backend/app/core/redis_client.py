"""Redis 异步连接池（单例 + 软启动 + lazy health check）

设计要点：
1. lifespan 里尝试连接 Redis：成功 -> _pool 复用；失败 -> 保留 _pool 客户端对象但 _available=False
2. is_available() 每次动态 ping（带 5s 节流），不依赖启动时状态锁
3. 这样 Redis 后启动也不需要重启 uvicorn
"""
import asyncio
import logging
import time
from typing import Optional

import redis.asyncio as aioredis

from app.config import settings


_pool: Optional[aioredis.Redis] = None
_available: bool = False
_last_ping_at: float = 0.0
_last_ping_ok: bool = False
_ping_lock = asyncio.Lock()

PING_TTL_SECONDS = 5.0  # 5 秒内复用上次探测结果，避免每次请求都 ping

logger = logging.getLogger(__name__)


async def connect() -> Optional[aioredis.Redis]:
    """
    lifespan 启动时调用。
    成功 -> 标记 _available=True
    失败 -> **不抛错**，但保留客户端对象以便后续重新探测
    """
    global _pool, _available, _last_ping_ok
    try:
        client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=2.0,
        )
        await client.ping()
        _pool = client
        _available = True
        _last_ping_ok = True
        logger.info("✅ Redis 已连接 (%s)", settings.redis_url)
        return _pool
    except Exception as e:
        # 关键：保留 client 对象，is_available() 会 lazy 重新 ping
        if _pool is None:
            _pool = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20,
                socket_connect_timeout=2.0,
            )
        _available = False
        _last_ping_ok = False
        logger.warning(
            "⚠️  Redis 连接失败（%s）: %s — 认证相关 API 会返 503，"
            "其他功能正常。会自动重试，无需手动干预。",
            settings.redis_url, e,
        )
        return None


async def close() -> None:
    """关闭时调用"""
    global _pool, _available
    _available = False
    if _pool is not None:
        try:
            await _pool.aclose()
        except Exception:
            pass
        _pool = None


async def _ensure_available() -> bool:
    """内部：动态探测 Redis（5s 节流）"""
    global _last_ping_at, _last_ping_ok, _available
    now = time.monotonic()
    if now - _last_ping_at < PING_TTL_SECONDS and _pool is not None:
        return _last_ping_ok
    async with _ping_lock:
        # double-check
        now = time.monotonic()
        if now - _last_ping_at < PING_TTL_SECONDS and _pool is not None:
            return _last_ping_ok
        try:
            await _pool.ping()
            _last_ping_ok = True
            _available = True
        except Exception:
            _last_ping_ok = False
            _available = False
        _last_ping_at = now
    return _last_ping_ok


async def is_available() -> bool:
    """路由层用：动态检查 Redis（5s 节流）"""
    if _pool is None:
        return False
    return await _ensure_available()


def is_available_sync() -> bool:
    """同步上下文用：只看缓存的 _available，不发请求"""
    return _available and _pool is not None


async def get_redis() -> aioredis.Redis:
    """获取连接：先 lazy 探测，探测失败抛 RuntimeError"""
    if _pool is None:
        raise RuntimeError("Redis 客户端未初始化（lifespan 未跑）")
    if not await _ensure_available():
        raise RuntimeError("Redis 不可用")
    return _pool

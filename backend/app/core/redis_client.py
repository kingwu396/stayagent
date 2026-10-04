"""Redis 异步连接池（单例，软启动：连接失败不抛错）"""
import logging
import redis.asyncio as aioredis
from typing import Optional

from app.config import settings


_pool: Optional[aioredis.Redis] = None
_available: bool = False

logger = logging.getLogger(__name__)


async def connect() -> Optional[aioredis.Redis]:
    """
    启动时调用。Redis 不可用不抛错（开发期不需要 Redis 也能跑大部分功能），
    会把 _pool = None 且 _available = False，路由层用 is_available() 判断后返 503。
    """
    global _pool, _available
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
        logger.info("✅ Redis 已连接 (%s)", settings.redis_url)
        return _pool
    except Exception as e:
        _pool = None
        _available = False
        logger.warning(
            "⚠️  Redis 连接失败（%s）: %s — 认证相关 API（登录/登出/刷新）会返 503，"
            "其他功能正常。如需认证请跑 `make redis` 或 `redis-server`。",
            settings.redis_url, e,
        )
        return None


async def close() -> None:
    """关闭时调用"""
    global _pool, _available
    _available = False
    if _pool is not None:
        await _pool.aclose()
        _pool = None


def get_redis() -> aioredis.Redis:
    """获取已建好的连接（依赖 connect() 先调用过）"""
    if _pool is None or not _available:
        raise RuntimeError("Redis 不可用")
    return _pool


def is_available() -> bool:
    """路由层用：检查 Redis 是否连得上"""
    return _available

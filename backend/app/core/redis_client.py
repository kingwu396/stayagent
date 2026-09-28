"""Redis 异步连接池（单例）"""
import redis.asyncio as aioredis
from typing import Optional

from app.config import settings


_pool: Optional[aioredis.Redis] = None


async def connect() -> aioredis.Redis:
    """启动时调用，建立全局连接池"""
    global _pool
    _pool = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    # 触发一次 PING 验证连通
    await _pool.ping()
    return _pool


async def close() -> None:
    """关闭时调用"""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


def get_redis() -> aioredis.Redis:
    """获取已建好的连接（依赖 connect() 先调用过）"""
    if _pool is None:
        raise RuntimeError("Redis 客户端未初始化，请先调用 redis_client.connect()")
    return _pool

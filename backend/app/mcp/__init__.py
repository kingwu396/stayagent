"""StayAgent MCP Server 入口 (Block 35)

用法: cd backend && uv run python -m app.mcp
接入 Claude Code / Claude Desktop 见 docs/mcp.md
"""
import logging
import sys

from app.core import redis_client
from app.mcp.server import server

logger = logging.getLogger("stayagent-mcp")


async def main() -> None:
    from mcp.server.stdio import stdio_server

    # Redis 软启动: 连不上只 warning (与 FastAPI lifespan 行为一致),
    # 只读工具不受影响, 登录/用户工具会在调用时报 Redis 不可用
    await redis_client.connect()
    if not redis_client._available:
        logger.warning("Redis 未连接 —— 登录/收藏/下单类工具将不可用")

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    import anyio

    try:
        anyio.run(main)
    except KeyboardInterrupt:
        sys.exit(0)

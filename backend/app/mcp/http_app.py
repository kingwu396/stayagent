"""StayAgent MCP Server —— Streamable HTTP 传输 (Block 36, 可部署到服务器)

与 stdio 版 (app/mcp/__main__.py) 共用同一个低层 Server (app/mcp/server.py) 和
登录态 (app/mcp/state.py), 只是传输通道不同。

安全: 公网部署必须在 .env 配 MCP_HTTP_TOKEN, 所有请求需带
Authorization: Bearer <token> (401 拒绝)。token 只做 server 门禁,
用户身份仍由 stayagent_login 工具建立 (独立会话, 见 docs/mcp.md)。

运行: cd backend && MCP_HTTP_TOKEN=xxx uv run uvicorn app.mcp.http_app:app --port 8001
客户端: claude mcp add --transport http stayagent-remote https://<host>/mcp --header "Authorization: Bearer <token>"
"""
import contextlib
import logging
import sys

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager

from app.config import settings
from app.core import redis_client
from app.mcp.server import server

# HTTP 模式日志同样走 stderr (uvicorn 已是 stderr, 这里保持一致)
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("stayagent-mcp-http")

# stateless=True: 不维护跨请求的 mcp-session-id, uvicorn 重启客户端无感;
# 工具型 server 无需服务端主动通知, stateless 足够且最抗代理/重启
session_manager = StreamableHTTPSessionManager(
    app=server,
    json_response=True,
    stateless=True,
)


async def _authorize(request: Request) -> bool:
    """Bearer 门禁: token 在 .env 的 MCP_HTTP_TOKEN 配置"""
    if not settings.mcp_http_token:
        return False
    auth = request.headers.get("authorization", "")
    return auth == f"Bearer {settings.mcp_http_token}"


async def handle_mcp(request: Request):
    if not await _authorize(request):
        return JSONResponse(
            {"error": "未授权: 请在请求头带 Authorization: Bearer <MCP_HTTP_TOKEN>"},
            status_code=401,
        )
    # 交给 SDK 的会话管理器 (内部完成 JSON-RPC 解析 + 调用 lowlevel server)
    await session_manager.handle_request(request.scope, request.receive, request._send)


@contextlib.asynccontextmanager
async def lifespan(app):
    if not settings.mcp_http_token:
        raise RuntimeError(
            "MCP HTTP 服务需要门禁 token: 在 backend/.env 加 MCP_HTTP_TOKEN=<随机长串>"
        )
    # 与 FastAPI lifespan 同款: Redis 软启动 (登录类工具依赖), 只读工具不受影响
    await redis_client.connect()
    if not redis_client._available:
        logger.warning("Redis 未连接 —— 登录/收藏/下单类工具将不可用")
    async with session_manager.run():
        logger.info("StayAgent MCP HTTP server ready at /mcp")
        yield


app = Starlette(
    routes=[Route("/mcp", handle_mcp, methods=["GET", "POST", "DELETE"])],
    lifespan=lifespan,
)

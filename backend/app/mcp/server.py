"""StayAgent MCP Server (Block 35) — 工具列表与分发

复用 agent 工具层, 不重写业务逻辑:
- schema 单一事实源 = tool_schemas.py 的 ALL_TOOL_SCHEMAS (原样透传, 零漂移)
- 实现单一事实源 = tools.py 的 TOOL_DISPATCH

用官方 SDK 低层 Server 而非 FastMCP: FastMCP 从函数注解生成 schema,
无法直接塞入已有 JSON Schema; 低层 list_tools 可原样透传.
"""
import functools
import inspect
import json
import logging
import sys
from typing import Any

import anyio
import mcp.types as types
from mcp.server.lowlevel import Server
from fastapi import HTTPException

from app.db.session import SessionLocal
from app.services.agent.tools import TOOL_DISPATCH, ToolError
from app.services.agent.tool_schemas import ALL_TOOL_SCHEMAS
from app.mcp import state

# stdio 模式严禁 stdout 输出 (会破坏 MCP 握手协议), 日志全部走 stderr
logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("stayagent-mcp")

# ============ 工具白名单 (显式列举; tool_schemas 新增工具默认不自动进 MCP) ============

TOOL_NAMES_READ_ONLY = [
    "search_listings",
    "get_listing_detail",
    "compare_listings",
    "check_availability",
    "get_listing_calendar",
    "search_travel_tips",
    "parse_travel_plan_pdf",
    "recommend_from_plan",
]
TOOL_NAMES_USER = [
    "list_wishlists",
    "create_wishlist",
    "add_to_wishlist",
    "remove_from_wishlist",
    "create_booking",
    "list_my_trips",
]
_ALLOWED = set(TOOL_NAMES_READ_ONLY) | set(TOOL_NAMES_USER)

LOGIN_TOOL = "stayagent_login"
LOGIN_SCHEMA = {
    "type": "object",
    "properties": {
        "account": {"type": "string", "description": "账号 (邮箱或用户名)"},
        "password": {"type": "string", "description": "密码"},
    },
    "required": ["account", "password"],
}
LOGIN_DESCRIPTION = (
    "登录 StayAgent 账号 (邮箱或用户名 + 密码)。"
    "收藏/心愿单/下单/行程类工具需要先登录; 未登录时搜索/详情/空位/日历/旅行贴士等只读工具可直接使用。"
    "MCP 登录会建立独立会话, 不影响浏览器里的登录状态。"
)

server = Server("stayagent")


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    schema_by_name = {t["function"]["name"]: t["function"] for t in ALL_TOOL_SCHEMAS}
    out = [
        types.Tool(
            name=LOGIN_TOOL,
            description=LOGIN_DESCRIPTION,
            inputSchema=LOGIN_SCHEMA,
        )
    ]
    for name in TOOL_NAMES_READ_ONLY + TOOL_NAMES_USER:
        fn = schema_by_name[name]
        out.append(types.Tool(name=name, description=fn["description"], inputSchema=fn["parameters"]))
    return out


def _dump(result: Any) -> types.CallToolResult:
    """成功结果: JSON 文本 (Decimal/date 用 default=str)"""
    return types.CallToolResult(
        content=[types.TextContent(type="text", text=json.dumps(result, ensure_ascii=False, default=str))],
        isError=False,
    )


def _error(text: str) -> types.CallToolResult:
    """MCP 约定: 工具级错误用 isError=True + 文本内容, 客户端(LLM)能看到并自行调整"""
    return types.CallToolResult(
        content=[types.TextContent(type="text", text=text)],
        isError=True,
    )


def _run_dispatch(fn, user, db, args: dict) -> Any:
    """同步分发 (在 worker thread 里跑, 不阻塞事件循环)"""
    return fn(user=user, db=db, **args)


async def _dispatch(name: str, user, db, args: dict) -> Any:
    fn = TOOL_DISPATCH[name]
    if inspect.iscoroutinefunction(fn):
        # parse_travel_plan_pdf / recommend_from_plan 是 async (内部 LLM 客户端绑定事件循环),
        # 必须留在事件循环里直接 await
        return await fn(user=user, db=db, **args)
    # 同步 pymysql 调用丢 worker thread
    return await anyio.to_thread.run_sync(functools.partial(_run_dispatch, fn, user, db, args))


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    args = arguments or {}
    db = SessionLocal()
    try:
        if name == LOGIN_TOOL:
            result = await state.login(db, args.get("account", ""), args.get("password", ""))
            return _dump(result)

        if name not in _ALLOWED:
            return _error(f"[UNKNOWN_TOOL] 未知工具: {name}")

        if name in TOOL_NAMES_USER:
            user = await state.resolve_user(db)
        else:
            user = None  # 只读工具不读 user

        # 工具实现是同步 pymysql 调用, 丢 worker thread 防止冻结 stdio 事件循环
        result = await _dispatch(name, user, db, args)
        return _dump(result)
    except ToolError as e:
        # 与 orchestrator 喂 LLM 的格式一致: [code] 中文消息
        return _error(f"[{e.code}] {e}")
    except HTTPException as e:
        logger.warning("工具 %s 抛 HTTPException: %s", name, e.detail)
        return _error(f"[TOOL_ERROR] {e.detail if isinstance(e.detail, str) else '服务暂时不可用'}")
    except Exception:
        logger.exception("工具 %s 执行失败", name)
        return _error("[INTERNAL_ERROR] 服务内部错误，请稍后重试")
    finally:
        db.close()

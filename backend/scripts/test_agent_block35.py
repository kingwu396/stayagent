"""Block 35 验证脚本 (MCP Server: 独立会话登录 + 工具分发 + schema 零漂移)

Test 1: list_tools — 15 个工具, create_booking inputSchema 与 tool_schemas.py 逐字段相等
Test 2: state.login — 错误密码 / Redis 不可用 / 正常登录且**不触碰浏览器会话槽** (方案 B 核心)
Test 3: 会话自愈 — access jti 被拉黑后 resolve_user 自动 rotation 续期
Test 4: 分发 — 白名单外拒绝 / 未登录调用户工具 AUTH_REQUIRED / 只读工具 user=None 正常
Test 5: stdio 子进程握手 — 等价 Claude Desktop 连接路径
运行: uv run python -m scripts.test_agent_block35
"""
import asyncio
import logging
import sys
import uuid
from datetime import date, timedelta

import mcp.types as types

from app.core.security import hash_password, create_access_token
from app.core.redis_client import get_redis
from app.db.session import SessionLocal
from app.models import User, Listing, Wishlist
from app.services.agent.tools import ToolError
from app.services.agent.tool_schemas import ALL_TOOL_SCHEMAS
from app.mcp import state
from app.mcp.server import server, TOOL_NAMES_READ_ONLY, TOOL_NAMES_USER

logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger(__name__)
PASS = 0
FAIL = 0


def check(name: str, cond: bool, detail: str = ""):
    global PASS, FAIL
    if cond:
        PASS += 1
        logger.info("  ✅ %s", name)
    else:
        FAIL += 1
        logger.error("  ❌ %s %s", name, detail)


async def call_tool(name: str, args: dict):
    """直接走 server 的 CallToolRequest handler (不经传输层)"""
    req = types.CallToolRequest(
        method="tools/call",
        params=types.CallToolRequestParams(name=name, arguments=args),
    )
    handler = server.request_handlers[types.CallToolRequest]
    return await handler(req)


def setup_user(db, email: str, username: str) -> User:
    u = User(
        email=email,
        username=username,
        password_hash=hash_password("TestPass123!"),
        is_host=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


async def main() -> int:
    today = date.today()
    suffix = uuid.uuid4().hex[:8]
    from app.core import redis_client
    await redis_client.connect()
    db = SessionLocal()
    redis = await get_redis()
    state.reset()
    user = listing = None
    try:
        user = setup_user(db, f"b35-{suffix}@test.com", f"b35u{suffix}")
        uid = user.id
        listing = Listing(
            host_id=uid, host_name=user.username, title="B35 测试房源",
            description="t", city="东京", country="日本", property_type="apartment",
            price_per_night="500", max_guests=2, bedrooms=1, beds=1, bathrooms=1,
            amenities=[], images=[],
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)

        # ===== Test 1: list_tools + schema 零漂移 =====
        logger.info("Test 1: list_tools")
        handler = server.request_handlers[types.ListToolsRequest]
        tools = (await handler(None)).root.tools
        names = [t.name for t in tools]
        check("工具数 15", len(tools) == 15, f"实际 {len(tools)}")
        check("含 stayagent_login", "stayagent_login" in names)
        check(
            "create_booking schema 零漂移",
            next(t for t in tools if t.name == "create_booking").inputSchema
            == next(t for t in ALL_TOOL_SCHEMAS if t["function"]["name"] == "create_booking")["function"]["parameters"],
        )

        # ===== Test 2: state.login =====
        logger.info("Test 2: state.login")
        # 模拟浏览器已登录: 会话槽 + refresh 白名单
        browser_access_jti = f"browser-access-{suffix}"
        browser_refresh_jti = f"browser-refresh-{suffix}"
        await redis.set(f"session_access:{uid}", browser_access_jti)
        await redis.set(f"session_refresh:{uid}", browser_refresh_jti)
        await redis.set(f"refresh:{browser_refresh_jti}", str(uid), ex=3600)

        # 错误密码
        try:
            await state.login(db, f"b35-{suffix}@test.com", "wrong-password")
            check("错误密码被拒", False)
        except ToolError as e:
            check("错误密码被拒", e.code == "AUTH_FAILED")

        # Redis 不可用 (monkeypatch state 命名空间里的 is_available)
        orig = state.is_available
        state.is_available = lambda: _false()
        try:
            await state.login(db, f"b35-{suffix}@test.com", "TestPass123!")
            check("Redis 不可用被拒", False)
        except ToolError as e:
            check("Redis 不可用被拒", e.code == "REDIS_UNAVAILABLE")
        finally:
            state.is_available = orig

        # 正常登录 → 浏览器会话槽与 refresh 白名单**未被触碰** (方案 B 核心)
        r = await state.login(db, f"b35-{suffix}@test.com", "TestPass123!")
        check("登录成功返回用户", r["id"] == uid and state.logged_in())
        check("浏览器 session_access 槽未被踢", await redis.get(f"session_access:{uid}") == browser_access_jti)
        check("浏览器 session_refresh 槽未被踢", await redis.get(f"session_refresh:{uid}") == browser_refresh_jti)
        check("浏览器 refresh 白名单仍在", await redis.get(f"refresh:{browser_refresh_jti}") is not None)
        check("MCP 自己的 refresh 白名单已写入", state._session["refresh_token"] is not None)

        # ===== Test 3: access 被拉黑 → rotation 自愈 =====
        logger.info("Test 3: rotation 自愈")
        payload = __import__("app.core.security", fromlist=["decode_token"]).decode_token(
            state._session["access_token"], expected_type="access"
        )
        # 模拟浏览器 rotation 把 MCP access 拉黑 (Block 34 行为)
        await redis.set(f"access_blacklist:{payload['jti']}", "1", ex=600)
        u2 = await state.resolve_user(db)
        check("拉黑后 resolve_user 走 rotation 返回用户", u2.id == uid)
        new_payload = __import__("app.core.security", fromlist=["decode_token"]).decode_token(
            state._session["access_token"], expected_type="access"
        )
        check("rotation 后拿到新 access jti", new_payload["jti"] != payload["jti"])

        # ===== Test 4: 分发 =====
        logger.info("Test 4: 工具分发")
        res = await call_tool("not_a_tool", {})
        check("白名单外拒绝", res.root.isError and "UNKNOWN_TOOL" in res.root.content[0].text)

        state.reset()
        res = await call_tool("list_wishlists", {})
        check("未登录调用户工具 → AUTH_REQUIRED", res.root.isError and "AUTH_REQUIRED" in res.root.content[0].text)

        # 登录后走 call_tool 全链路: 建 wishlist
        await state.login(db, f"b35-{suffix}@test.com", "TestPass123!")
        res = await call_tool("create_wishlist", {"name": "b35 心愿单"})
        check("登录后 create_wishlist OK", not res.root.isError and "b35 心愿单" in res.root.content[0].text,
              f"res={res.root.content[0].text[:120]}")

        # 只读工具 user=None
        res = await call_tool("get_listing_detail", {"listing_id": listing.id})
        check("只读工具 get_listing_detail OK", not res.root.isError, res.root.content[0].text[:120])
        res = await call_tool("check_availability", {
            "listing_id": listing.id,
            "check_in": (today + timedelta(days=5)).isoformat(),
            "check_out": (today + timedelta(days=7)).isoformat(),
        })
        check("check_availability OK (user=None)", not res.root.isError and '"available":true' in res.root.content[0].text.replace(" ", ""),
              res.root.content[0].text[:120])

        # ToolError → isError 中文透传
        res = await call_tool("get_listing_detail", {"listing_id": 999999999})
        check("NOT_FOUND 中文透传", res.root.isError and "不存在" in res.root.content[0].text)

        # ===== Test 5: stdio 子进程握手 =====
        logger.info("Test 5: stdio 子进程握手 (等价 Claude Desktop 连接路径)")
        import os
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        params = StdioServerParameters(
            command=sys.executable,
            args=["-m", "app.mcp"],
            cwd=os.getcwd(),  # backend/, 保证 .env 相对路径可读
            env={**os.environ},
        )
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                init = await session.initialize()
                check("握手成功 server name", init.serverInfo.name == "stayagent")
                tools_res = await session.list_tools()
                check("子进程 list_tools 15 个", len(tools_res.tools) == 15)
                check("子进程暴露 create_booking", "create_booking" in [t.name for t in tools_res.tools])

        logger.info("=" * 40)
        logger.info("结果: %d 通过, %d 失败", PASS, FAIL)
        return 0 if FAIL == 0 else 1
    finally:
        # 清理
        try:
            from sqlalchemy import delete as _del
            if listing:
                db.execute(_del(Wishlist).where(Wishlist.user_id == user.id))
                db.execute(_del(Listing).where(Listing.id == listing.id))
            if user:
                db.execute(_del(User).where(User.id == user.id))
            db.commit()
            if user:
                # 清 Redis 残留 (刷新白名单/会话槽/黑名单的测试 key)
                import re as _re
                for jti in [f"browser-refresh-{suffix}"]:
                    await redis.delete(f"refresh:{jti}", f"session_access:{user.id}", f"session_refresh:{user.id}")
        except Exception:
            logger.exception("清理失败 (不影响判定)")
        db.close()
        state.reset()


async def _false() -> bool:
    return False


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

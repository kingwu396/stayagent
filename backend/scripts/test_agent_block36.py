"""Block 36 验证脚本 (MCP Streamable HTTP 传输 + Bearer 门禁)

Test 1: 门禁 — 无 token / 错 token 401
Test 2: 官方 streamablehttp_client 全链路 — 握手 / list_tools 15 / 只读工具免登录 / 用户工具 AUTH_REQUIRED
运行: uv run python -m scripts.test_agent_block36   (自动起 8121 端口的 uvicorn 子进程, 结束自动清理)
"""
import asyncio
import logging
import os
import signal
import socket
import subprocess
import sys
import time

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

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


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def main() -> int:
    token = "test-token-b36"
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        ["uv", "run", "uvicorn", "app.mcp.http_app:app", "--port", str(port)],
        cwd=os.getcwd(),
        env={**os.environ, "MCP_HTTP_TOKEN": token},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        # 等 uvicorn 就绪
        for _ in range(30):
            with socket.socket() as s:
                if s.connect_ex(("127.0.0.1", port)) == 0:
                    break
            time.sleep(0.3)

        # ===== Test 1: 门禁 (裸 HTTP) =====
        logger.info("Test 1: Bearer 门禁")
        import httpx
        async with httpx.AsyncClient() as hc:
            r = await hc.post(f"{base}/mcp", json={})
            check("无 token 401", r.status_code == 401, f"实际 {r.status_code}")
            r = await hc.post(f"{base}/mcp", json={}, headers={"Authorization": "Bearer wrong"})
            check("错 token 401", r.status_code == 401, f"实际 {r.status_code}")

        # ===== Test 2: 官方 streamablehttp_client 全链路 =====
        logger.info("Test 2: HTTP 全链路")
        headers = {"Authorization": f"Bearer {token}"}
        async with streamablehttp_client(f"{base}/mcp", headers=headers) as (read, write, _):
            async with ClientSession(read, write) as session:
                init = await session.initialize()
                check("握手成功", init.serverInfo.name == "stayagent")
                tools = await session.list_tools()
                check("list_tools 15 个", len(tools.tools) == 15, f"实际 {len(tools.tools)}")

                # 只读工具免登录 (user=None)
                res = await session.call_tool("get_listing_detail", {"listing_id": 999999999})
                check("只读工具透传 NOT_FOUND 中文", res.isError and "不存在" in res.content[0].text)

                # 用户工具未登录 → AUTH_REQUIRED
                res = await session.call_tool("list_wishlists", {})
                check("未登录 AUTH_REQUIRED", res.isError and "AUTH_REQUIRED" in res.content[0].text)

        logger.info("=" * 40)
        logger.info("结果: %d 通过, %d 失败", PASS, FAIL)
        return 0 if FAIL == 0 else 1
    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

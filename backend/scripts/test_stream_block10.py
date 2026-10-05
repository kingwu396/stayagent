"""Block 10 SSE 验证脚本
用 httpx.stream 模拟前端 fetch 流式读取, 断言事件顺序.
"""
import asyncio
import json
import sys

import httpx
from sqlalchemy import delete, select

from app.core.security import hash_password
from app.core.llm_client import reset as llm_reset
from app.db.session import SessionLocal
from app.models import (
    User, Conversation, Message, AgentRun, AgentStep,
    Wishlist, WishlistItem, Booking,
)


BASE_URL = "http://127.0.0.1:8765"


def setup_user():
    """注册测试用户"""
    with SessionLocal() as db:
        u = User(
            email="b10stream@test.com",
            username="b10stream",
            password_hash=hash_password("TestPass123!"),
        )
        db.add(u); db.commit(); db.refresh(u)
        return u


def cleanup(db, user):
    db.execute(delete(Conversation).where(Conversation.user_id == user.id))
    db.execute(delete(Wishlist).where(Wishlist.user_id == user.id))
    db.execute(delete(Booking).where(Booking.user_id == user.id))
    db.execute(delete(User).where(User.id == user.id))
    db.commit()


async def get_token(client: httpx.AsyncClient) -> str:
    """注册新用户拿 token (用户名带时间戳避免冲突)"""
    ts = str(asyncio.get_event_loop().time())
    username = f"b10s{ts.replace('.', '')[:10]}"
    r = await client.post(f"{BASE_URL}/api/auth/register", json={
        "email": f"{username}@test.com",
        "username": username,
        "password": "TestPass123!",
    })
    r.raise_for_status()
    # 注册后单独 login
    r = await client.post(f"{BASE_URL}/api/auth/login", json={
        "account": username,
        "password": "TestPass123!",
    })
    r.raise_for_status()
    return r.json()["access_token"]


async def test_stream_chat() -> bool:
    """主测试: 流式 chat, 断言事件顺序"""
    print("\n[Test] SSE stream chat")
    llm_reset()  # 重置 client (避免之前测试残留)
    async with httpx.AsyncClient(timeout=60) as client:
        token = await get_token(client)
        headers = {"Authorization": f"Bearer {token}"}
        body = {"message": "东京便宜公寓"}
        events = []
        final = None

        async with client.stream(
            "POST",
            f"{BASE_URL}/api/agent/chat/stream",
            headers=headers,
            json=body,
        ) as response:
            print(f"  HTTP status: {response.status_code}")
            assert response.status_code == 200

            async for line in response.aiter_lines():
                if line.startswith("event:"):
                    evt_type = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    data_str = line.split(":", 1)[1].strip()
                    if not data_str or evt_type == "done":
                        continue
                    try:
                        data = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    events.append({"type": evt_type, "data": data})
                    if evt_type == "final":
                        final = data

        # 断言
        types = [e["type"] for e in events]
        print(f"  events: {types}")

        assert "run_started" in types, f"missing run_started: {types}"
        assert "step_started" in types, f"missing step_started: {types}"
        assert "step_completed" in types, f"missing step_completed: {types}"
        assert "final" in types, f"missing final: {types}"

        # 顺序: run_started 在最前
        assert types[0] == "run_started", f"first event should be run_started, got {types[0]}"
        # final 在最后 (done 不算)
        assert types[-1] == "final", f"last event should be final, got {types[-1]}"

        # final event 含完整字段
        assert final is not None
        assert final["status"] == "completed", f"status={final['status']}"
        assert final.get("content"), "empty content"
        content = final["content"]
        print(f"  content length: {len(content)}")
        assert len(content) > 50, f"content too short: {len(content)}"

        # 至少 1 个 step
        step_started = [e for e in events if e["type"] == "step_started"]
        step_completed = [e for e in events if e["type"] == "step_completed"]
        print(f"  steps: {len(step_completed)}")
        assert len(step_started) == len(step_completed), "started/completed count mismatch"
        for s, c in zip(step_started, step_completed):
            sd = s["data"]
            cd = c["data"]
            assert sd["tool_name"], f"missing tool_name in {sd}"
            assert sd["step_index"] == cd["step_index"], "index mismatch"
            assert cd["duration_ms"] is not None, f"missing duration_ms in {cd}"
            print(f"    - {sd['tool_name']} ({cd['duration_ms']}ms)")

        print("✅ TEST PASSED")
        return True


async def main():
    print("=" * 60)
    print("🚀 Block 10 SSE 验证")
    print("=" * 60)
    try:
        passed = await test_stream_chat()
        return 0 if passed else 1
    finally:
        # cleanup test users
        with SessionLocal() as db:
            db.execute(delete(User).where(User.username.like("b10s%")))
            db.commit()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

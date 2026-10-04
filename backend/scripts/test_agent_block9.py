"""Block 9 验证脚本 (5 个 E2E)

Test A: basic search_listings (1 步)
Test B: search + compare (2 步)
Test C: wishlist 操作 (add + create)
Test D: 多轮对话 (conversation 复用)
Test E: tenacity 重试行为 (mock 网络错)

运行: uv run python -m scripts.test_agent_block9
"""
import asyncio
import logging
import sys
import time
from sqlalchemy import select, delete

from app.core.llm_client import close as llm_close, reset as llm_reset
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import (
    User, Conversation, Message, AgentRun, AgentStep,
    Wishlist, WishlistItem, Booking,
)
from app.services.agent.orchestrator import run_agent
from app.services.agent.retry import retry_on_llm_error

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ============ Setup / Cleanup ============

def setup_user(db, name: str = "b9test") -> User:
    from app.core.security import hash_password
    u = User(
        email=f"{name}@test.com",
        username=name,
        password_hash=hash_password("TestPass123!"),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def cleanup(db, user: User) -> None:
    """CASCADE 删: Conversation → AgentStep; Wishlist → WishlistItem"""
    db.execute(delete(Conversation).where(Conversation.user_id == user.id))
    db.execute(delete(Wishlist).where(Wishlist.user_id == user.id))
    db.execute(delete(Booking).where(Booking.user_id == user.id))
    db.execute(delete(User).where(User.id == user.id))
    db.commit()


# ============ Tests ============

def assert_completed(run: AgentRun, label: str) -> None:
    assert run.status == "completed", f"{label}: status={run.status}, error={run.error}"
    assert run.final_content, f"{label}: empty final_content"
    assert run.finished_at is not None
    logger.info(
        "  ✓ %s: steps=%d, tokens=%d/%d, content_len=%d",
        label, len(run.steps), run.prompt_tokens, run.completion_tokens, len(run.final_content),
    )


def run_test_a(db, user) -> bool:
    """Test A: basic search_listings (1 步)"""
    print("\n[Test A] basic search")
    llm_reset()

    run = asyncio.run(run_agent(db, user, "东京有便宜的公寓吗？找几个给我。"))
    assert_completed(run, "A")
    assert len(run.steps) >= 1, "no steps recorded"
    assert run.steps[0].tool_name == "search_listings", f"got {run.steps[0].tool_name}"
    assert "Tokyo" in run.final_content or "东京" in run.final_content or "公寓" in run.final_content, \
        f"content doesn't mention Tokyo/公寓: {run.final_content[:200]}"
    return True


def run_test_b(db, user) -> bool:
    """Test B: search + compare (2 步)"""
    print("\n[Test B] multi-step (search + compare)")
    llm_reset()

    run = asyncio.run(run_agent(
        db, user,
        "帮我找 2 个东京的公寓，然后比较一下价格和评分。",
    ))
    assert_completed(run, "B")
    tools_used = [s.tool_name for s in run.steps]
    logger.info("  tools: %s", tools_used)
    assert "search_listings" in tools_used, "no search_listings"
    assert "compare_listings" in tools_used, "no compare_listings"
    return True


def run_test_c(db, user) -> bool:
    """Test C: wishlist 操作 (create + add)"""
    print("\n[Test C] wishlist operations")
    llm_reset()

    run = asyncio.run(run_agent(
        db, user,
        "帮我建一个心愿单叫 '东京旅行'，然后把 #5 加进去。",
    ))
    assert_completed(run, "C")
    # 校验 DB
    wishlists = db.execute(
        select(Wishlist).where(Wishlist.user_id == user.id)
    ).scalars().all()
    names = [w.name for w in wishlists]
    logger.info("  wishlists: %s", names)
    assert "东京旅行" in names, f"missing '东京旅行' in {names}"
    target = next(w for w in wishlists if w.name == "东京旅行")
    items = db.execute(
        select(WishlistItem).where(WishlistItem.wishlist_id == target.id)
    ).scalars().all()
    item_listing_ids = [it.listing_id for it in items]
    assert 5 in item_listing_ids, f"listing #5 not in wishlist: {item_listing_ids}"
    logger.info("  ✓ wishlist '东京旅行' contains listing #5")
    return True


def run_test_d(db, user) -> bool:
    """Test D: 多轮对话"""
    print("\n[Test D] multi-turn conversation")
    # 1st turn
    llm_reset()
    run1 = asyncio.run(run_agent(db, user, "找 3 个东京的公寓"))
    assert_completed(run1, "D1")
    conv_id = run1.conversation_id

    # 2nd turn
    llm_reset()
    run2 = asyncio.run(run_agent(
        db, user,
        "第一个便宜点吗？列出设施。",
        conversation_id=conv_id,
    ))
    assert_completed(run2, "D2")
    assert run2.conversation_id == conv_id, "different conversation!"
    logger.info("  ✓ 2 runs in same conversation #%d", conv_id)
    return True


async def run_test_e() -> bool:
    """Test E: tenacity 重试 (mock 网络错, 不真发请求)"""
    print("\n[Test E] tenacity retry behavior (mock)")
    attempts: list[float] = []

    @retry_on_llm_error
    async def flaky():
        attempts.append(time.monotonic())
        if len(attempts) < 3:
            # 模拟网络错 (触发 retry_on_llm_error 的 catch)
            import httpx
            raise httpx.ConnectError("Simulated connection failure")
        return "success"

    result = await flaky()
    assert result == "success"
    assert len(attempts) == 3, f"expected 3 attempts, got {len(attempts)}"
    logger.info("  ✓ retried 3 times then succeeded (total %.2fs)", attempts[-1] - attempts[0])
    return True


# ============ Main ============

def main() -> int:
    print("=" * 60)
    print("🚀 Block 9 验证开始")
    print("=" * 60)

    # Test E (mock, 不依赖 DB)
    try:
        if not asyncio.run(run_test_e()):
            print("❌ Test E 失败")
            return 1
    except Exception as e:
        print(f"❌ Test E 异常: {type(e).__name__}: {e}")
        return 1

    # Test A-D (实际 LLM 调用, 需要 DEEPSEEK_API_KEY)
    try:
        # 重置 llm client 单例 (Test E 用了独立 loop, 跨 loop 复用会崩)
        llm_reset()
        with SessionLocal() as db:
            user = setup_user(db)
            try:
                for label, fn in [("A", run_test_a), ("B", run_test_b), ("C", run_test_c), ("D", run_test_d)]:
                    try:
                        if not fn(db, user):
                            print(f"❌ Test {label} 失败")
                            return 1
                    except AssertionError as e:
                        print(f"❌ Test {label} 断言失败: {e}")
                        return 1
                    except Exception as e:
                        print(f"❌ Test {label} 异常: {type(e).__name__}: {e}")
                        return 1
            finally:
                cleanup(db, user)
    finally:
        asyncio.run(llm_close())

    print("\n" + "=" * 60)
    print("✅ 5/5 全部通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())

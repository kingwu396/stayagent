"""Block 11.5 验证脚本 (HITL + tools 增强)

Test C: tool 增强 (compare_listings + remove_from_wishlist + _compute_booking_totals)
Test A1: HITL approve 端到端
Test A2: HITL reject 端到端
Test D: HITL 状态冲突 (非 pending_confirmation → 409)

运行: uv run python -m scripts.test_agent_block11_5

绕开 /api/auth/login (避免 redis 503 噪声), 直接 mint access token.
"""
import asyncio
import logging
import sys
import uuid
from datetime import date as date_cls, timedelta

from sqlalchemy import select, delete

from app.core.security import hash_password, create_access_token
from app.db.session import SessionLocal, engine
from app.models import (
    User, Listing, Booking, Conversation, Message,
    AgentRun, AgentStep, Wishlist, WishlistItem,
)
from app.services.agent.tools import (
    ToolError,
    create_booking, compare_listings, remove_from_wishlist,
    _compute_booking_totals,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ============ Setup / Cleanup ============

def setup_user(db) -> User:
    name = f"b115_{uuid.uuid4().hex[:6]}"
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
    db.execute(delete(Booking).where(Booking.user_id == user.id))
    db.execute(delete(Message).where(
        Message.conversation_id.in_(
            select(Conversation.id).where(Conversation.user_id == user.id)
        )
    ))
    db.execute(delete(Conversation).where(Conversation.user_id == user.id))
    db.execute(delete(Wishlist).where(Wishlist.user_id == user.id))
    db.execute(delete(User).where(User.id == user.id))
    db.commit()


def pick_listing(db) -> Listing:
    listing = db.execute(
        select(Listing).where(Listing.max_guests >= 2).limit(1)
    ).scalar_one_or_none()
    if listing is None:
        raise RuntimeError("no seed listings; run 'make seed' first")
    return listing


def make_token(user: User) -> str:
    """直接 mint access token (绕过 redis login)."""
    token, _jti, _exp = create_access_token(user.id)
    return token


# ============ Tests ============

def test_c_compare_enhanced(db, user: User) -> bool:
    """Test C: compare_listings 输出 amenities/bedrooms/coordinates + remove_from_wishlist 按 listing_name 删"""
    print("\n[Test C] tool enhancements (compare + remove_by_name)")
    listings = db.execute(select(Listing).limit(3)).scalars().all()
    ids = [l.id for l in listings]
    assert len(ids) >= 2, "need at least 2 seed listings"

    # C1: compare_listings 输出
    result = compare_listings(user=user, db=db, listing_ids=ids)
    item = result["items"][0]
    print(f"  compare item[0] keys: {sorted(item.keys())}")
    assert "amenities" in item
    assert "bedrooms" in item
    assert "coordinates" in item
    assert "latitude" in item["coordinates"]
    assert "longitude" in item["coordinates"]
    print("  ✓ compare_listings 输出 amenities/bedrooms/coordinates")

    # C2: remove_from_wishlist by listing_name
    wishlist = Wishlist(user_id=user.id, name=f"b115-wl-{uuid.uuid4().hex[:4]}")
    db.add(wishlist)
    db.commit()
    db.refresh(wishlist)
    target_listing = listings[0]
    db.add(WishlistItem(wishlist_id=wishlist.id, listing_id=target_listing.id))
    db.commit()

    name_part = target_listing.title[:5]
    result = remove_from_wishlist(
        user=user, db=db,
        wishlist_id=wishlist.id,
        listing_name=name_part,
    )
    print(f"  remove_by_name '{name_part}': status={result['status']}, matched_id={result.get('matched_listing_id')}")
    assert result["status"] == "removed"
    assert result["matched_listing_id"] == target_listing.id

    # C3: remove_from_wishlist 不传 listing_id 也不传 listing_name → INVALID_ARGS
    try:
        remove_from_wishlist(user=user, db=db, wishlist_id=wishlist.id)
        raise AssertionError("expected ToolError")
    except ToolError as e:
        print(f"  remove no-arg correctly -> {e.code}")
        assert e.code == "INVALID_ARGS"

    print("  ✓ remove_from_wishlist by_name 成功 + INVALID_ARGS 校验")
    return True


def test_e_compute_totals(listing: Listing) -> bool:
    """Test E: _compute_booking_totals helper"""
    print("\n[Test E] _compute_booking_totals")
    totals = _compute_booking_totals(
        listing,
        date_cls(2026, 11, 1),
        date_cls(2026, 11, 5),
    )
    print(f"  totals: nights={totals['nights']} subtotal={totals['subtotal']} total={totals['total']}")
    assert totals["nights"] == 4
    assert float(totals["subtotal"]) == float(listing.price_per_night) * 4
    try:
        _compute_booking_totals(listing, date_cls(2026, 11, 1), date_cls(2026, 11, 1))
        raise AssertionError("expected ToolError")
    except ToolError as e:
        assert e.code == "INVALID_ARGS"
        print(f"  same-day correctly -> {e.code}")
    print("  ✓ totals helper OK")
    return True


def test_a_approve(db, user: User, listing: Listing, token: str) -> bool:
    """Test A1: HITL approved 完整流程"""
    print("\n[Test A1] HITL approved flow")
    from fastapi.testclient import TestClient
    from app.main import app

    conv = Conversation(user_id=user.id, title="b115-approve")
    db.add(conv)
    db.commit()
    db.refresh(conv)

    check_in = date_cls.today() + timedelta(days=14)
    check_out = check_in + timedelta(days=3)
    run = AgentRun(
        conversation_id=conv.id,
        user_id=user.id,
        user_message=f"帮我订 #{listing.id}",
        status="pending_confirmation",
        pending_tool_call={"tool_name": "create_booking", "tool_args": {
            "listing_id": listing.id,
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "guests": 2,
        }},
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    print(f"  setup: AgentRun #{run.id} (status=pending_confirmation)")

    client = TestClient(app)
    resp = client.post(
        f"/api/agent/runs/{run.id}/confirm",
        json={"run_id": run.id, "approved": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"confirm failed: {resp.status_code} {resp.text}"
    body = resp.json()
    print(f"  response: status={body['status']} content='{body['final_content'][:50]}...'")
    assert body["status"] == "completed", f"expected completed, got {body['status']}"
    # Block 26 起下单改 pending 待支付, 话术从 "已下单" 变为 "订单已创建"(待支付)
    assert "订单已创建" in body["final_content"]

    db.commit()
    db.expire_all()
    bookings = db.execute(select(Booking).where(Booking.user_id == user.id)).scalars().all()
    print(f"  bookings: {[(b.id, b.listing_id, b.guests, b.nights, b.total) for b in bookings]}")
    assert len(bookings) == 1
    assert bookings[0].listing_id == listing.id
    # Block 26 起 agent 下单同步走待支付流程 (确认后由用户去支付页付款)
    assert bookings[0].status == "pending"
    assert bookings[0].guests == 2
    assert bookings[0].nights == 3
    print("  ✓ booking 落库 (pending 待支付), run.status=completed, content 含 '订单已创建'")
    return True


def test_a_reject(db, user: User, listing: Listing, token: str) -> bool:
    """Test A2: HITL reject 取消流程"""
    print("\n[Test A2] HITL rejected flow")
    from fastapi.testclient import TestClient
    from app.main import app

    conv = Conversation(user_id=user.id, title="b115-reject")
    db.add(conv)
    db.commit()
    db.refresh(conv)

    check_in = date_cls.today() + timedelta(days=20)
    check_out = check_in + timedelta(days=2)
    run = AgentRun(
        conversation_id=conv.id,
        user_id=user.id,
        user_message=f"帮我订 #{listing.id}",
        status="pending_confirmation",
        pending_tool_call={"tool_name": "create_booking", "tool_args": {
            "listing_id": listing.id,
            "check_in": check_in.isoformat(),
            "check_out": check_out.isoformat(),
            "guests": 1,
        }},
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    db.commit()
    db.expire_all()
    bookings_before = len(db.execute(select(Booking).where(Booking.user_id == user.id)).scalars().all())

    client = TestClient(app)
    resp = client.post(
        f"/api/agent/runs/{run.id}/confirm",
        json={"run_id": run.id, "approved": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    print(f"  response: status={body['status']} content='{body['final_content'][:30]}...'")
    assert body["status"] == "cancelled"
    assert "取消" in body["final_content"]

    bookings_after = len(db.execute(select(Booking).where(Booking.user_id == user.id)).scalars().all())
    print(f"  bookings before/after: {bookings_before}/{bookings_after}")
    assert bookings_after == bookings_before, "reject should not write booking"
    print("  ✓ run.status=cancelled, 无新 booking")
    return True


def test_d_status_conflict(db, user: User, token: str) -> bool:
    """Test D: 对非 pending_confirmation 的 run confirm → 409"""
    print("\n[Test D] HITL conflict (non-pending run)")
    from fastapi.testclient import TestClient
    from app.main import app

    conv = Conversation(user_id=user.id, title="b115-conflict")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    run = AgentRun(
        conversation_id=conv.id,
        user_id=user.id,
        user_message="hello",
        status="completed",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    client = TestClient(app)
    resp = client.post(
        f"/api/agent/runs/{run.id}/confirm",
        json={"run_id": run.id, "approved": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    print(f"  expected 409, got {resp.status_code}: {resp.json().get('detail','')[:80]}")
    assert resp.status_code == 409
    print("  ✓ 409 校验 OK")
    return True


# ============ Main ============

def main() -> int:
    print("=" * 60)
    print("🚀 Block 11.5 验证开始 (HITL + tools 增强)")
    print("=" * 60)

    with SessionLocal() as db:
        user = setup_user(db)
        token = make_token(user)
        listing = pick_listing(db)
        print(f"test user: {user.email}")
        print(f"test listing: #{listing.id} '{listing.title}'")

        try:
            tests = [
                ("C-compare+remove", lambda: test_c_compare_enhanced(db, user)),
                ("E-compute_totals", lambda: test_e_compute_totals(listing)),
                ("A1-approve",       lambda: test_a_approve(db, user, listing, token)),
                ("A2-reject",        lambda: test_a_reject(db, user, listing, token)),
                ("D-status_conflict", lambda: test_d_status_conflict(db, user, token)),
            ]
            for label, fn in tests:
                try:
                    if not fn():
                        print(f"❌ {label} 失败")
                        return 1
                except AssertionError as e:
                    print(f"❌ {label} 断言失败: {e}")
                    return 1
                except Exception as e:
                    print(f"❌ {label} 异常: {type(e).__name__}: {e}")
                    import traceback
                    traceback.print_exc()
                    return 1
        finally:
            cleanup(db, user)
    engine.dispose()

    print("\n" + "=" * 60)
    print("✅ Block 11.5 全部测试通过 (5/5)")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())

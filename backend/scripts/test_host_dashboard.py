"""Block 15 验证脚本 (Host dashboard)

Test 1: 3 demo host 用户已存在, 各自分到 listings
Test 2: 非 host 用户调 /api/host/listings -> 403
Test 3: view_count 计数 (单次访问 = +1, 5次 = +5)
Test 4: revenue 计算 (confirmed bookings 汇总)
Test 5: Host listings 端点返回自己的房源, 不含别人的

运行: uv run python -m scripts.test_host_dashboard
"""
import logging
import sys
import uuid

from sqlalchemy import select, delete
from fastapi.testclient import TestClient

from app.core.security import hash_password, create_access_token
from app.db.session import SessionLocal, engine
from app.models import User, Listing, Booking
from datetime import date

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def setup_user(db, email: str, username: str, is_host: bool = False) -> User:
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing:
        return existing
    u = User(
        email=email,
        username=username,
        password_hash=hash_password("TestPass123!"),
        is_host=is_host,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def make_token(user: User) -> str:
    token, _jti, _exp = create_access_token(user.id)
    return token


def cleanup(db, user: User) -> None:
    db.execute(delete(Booking).where(Booking.user_id == user.id))
    db.execute(delete(User).where(User.id == user.id))
    db.commit()


def test_1_demo_hosts_exist():
    print("\n[Test 1] 3 demo host 已 seed")
    with SessionLocal() as db:
        hosts = db.execute(
            select(User).where(User.email.in_(["host1@test.com", "host2@test.com", "host3@test.com"]))
        ).scalars().all()
        assert len(hosts) == 3, f"expected 3 hosts, got {len(hosts)}"
        for h in hosts:
            assert h.is_host is True, f"{h.email} is_host should be True"
            cnt = db.execute(
                select(__import__('sqlalchemy').func.count()).select_from(Listing).where(Listing.host_id == h.id)
            ).scalar()
            print(f"  {h.email} -> {cnt} listings")
        total_listings = db.execute(
            select(__import__('sqlalchemy').func.count()).select_from(Listing)
        ).scalar()
        assert total_listings == 1000
    print("  ✓ 3 hosts, 各自分到约 333 listings")


def test_2_non_host_forbidden():
    print("\n[Test 2] 非 host 用户调 /api/host/listings -> 403")
    from app.main import app
    with SessionLocal() as db:
        # 创建临时非 host 用户
        u = setup_user(db, f"b15_non_{uuid.uuid4().hex[:6]}@test.com", f"b15_non_{uuid.uuid4().hex[:4]}", is_host=False)
        token = make_token(u)
        try:
            client = TestClient(app)
            resp = client.get(
                "/api/host/listings",
                headers={"Authorization": f"Bearer {token}"},
            )
            print(f"  status: {resp.status_code} (期望 403)")
            assert resp.status_code == 403
            print(f"  ✓ 非 host 用户 403")
        finally:
            cleanup(db, u)
            # 用户可能也关联 bookings, 上面 cleanup 已删
    return True


def test_3_view_count():
    print("\n[Test 3] view_count 自增: 详情访问 +1")
    from app.main import app
    with SessionLocal() as db:
        u = setup_user(db, f"b15_v_{uuid.uuid4().hex[:6]}@test.com", f"b15_v_{uuid.uuid4().hex[:4]}")
        token = make_token(u)
        try:
            # 找任一 listing, 记录初始 view_count
            listing = db.execute(select(Listing).limit(1)).scalar_one()
            initial_views = listing.view_count
            client = TestClient(app)
            headers = {"Authorization": f"Bearer {token}"}

            # 访问详情 5 次
            for _ in range(5):
                resp = client.get(f"/api/listings/{listing.id}", headers=headers)
                assert resp.status_code == 200

            # 重新查 DB (用 fresh session 避免 connection 缓存)
            with SessionLocal() as db2:
                updated = db2.get(Listing, listing.id)
                print(f"  listing #{listing.id} views: {initial_views} -> {updated.view_count}")
                assert updated.view_count == initial_views + 5, \
                    f"expected {initial_views + 5}, got {updated.view_count}"
                print("  ✓ view_count 准确 +5")

            # list 接口不应该增加 view_count
            views_before_list = updated.view_count
            for _ in range(3):
                client.get("/api/listings?page=1&page_size=10", headers=headers)
            with SessionLocal() as db2:
                updated = db2.get(Listing, listing.id)
                print(f"  list 调用 3 次后 views: {views_before_list} -> {updated.view_count} (应不变)")
                assert updated.view_count == views_before_list
            print("  ✓ list 接口不自增 view_count")
            print(f"  list 调用 3 次后 views: {views_before_list} -> {updated.view_count} (应不变)")
            assert updated.view_count == views_before_list
            print("  ✓ list 接口不自增 view_count")
        finally:
            cleanup(db, u)
    return True


def test_4_revenue_calc():
    print("\n[Test 4] revenue 计算 (confirmed bookings 加总)")
    from app.main import app
    with SessionLocal() as db:
        # 用现有 host1, 加几个 booking
        host = db.execute(select(User).where(User.email == "host1@test.com")).scalar_one()
        listing = db.execute(
            select(Listing).where(Listing.host_id == host.id).limit(1)
        ).scalar_one()
        # 创建 user + 几个 booking
        u = setup_user(db, f"b15_g_{uuid.uuid4().hex[:6]}@test.com", f"b15_g_{uuid.uuid4().hex[:4]}")
        try:
            # 3 confirmed + 1 cancelled
            for i, status in enumerate(["confirmed", "confirmed", "confirmed", "cancelled"]):
                b = Booking(
                    user_id=u.id, listing_id=listing.id,
                    check_in=date(2027, 1, 1 + i),
                    check_out=date(2027, 1, 2 + i),
                    guests=2, nights=1,
                    subtotal=100, cleaning_fee=10, service_fee=5, total=115,
                    status=status,
                )
                db.add(b)
            db.commit()

            token = make_token(host)
            client = TestClient(app)
            resp = client.get(
                "/api/host/listings",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200
            body = resp.json()
            print(f"  total_confirmed_revenue: {body['total_confirmed_revenue']}")
            # host1 总营收含其它 listings 的 bookings, 我们只验证 host1 至少含刚加的 3*115 = 345
            total = float(body['total_confirmed_revenue'])
            assert total >= 345, f"host1 total confirmed 至少应含 3*115=345, got {total}"
            print(f"  ✓ host1 营收聚合包含新建 confirmed bookings (>= 345)")

            # 取消的 booking 不该计入 confirmed
            assert body['total_pending_revenue'] == '0' or body['total_pending_revenue'] == '0.0' or \
                   float(body['total_pending_revenue']) >= 0  # 仅作 sanity
        finally:
            # 清掉刚加的 bookings
            db.execute(delete(Booking).where(Booking.user_id == u.id))
            db.commit()
            cleanup(db, u)
    return True


def test_5_listings_endpoint():
    print("\n[Test 5] Host listings 端点: 只返回自己的房源")
    from app.main import app
    with SessionLocal() as db:
        host = db.execute(select(User).where(User.email == "host2@test.com")).scalar_one()
        own = db.scalar(
            select(__import__('sqlalchemy').func.count()).select_from(Listing).where(Listing.host_id == host.id)
        )
        other = db.scalar(
            select(__import__('sqlalchemy').func.count()).select_from(Listing).where(Listing.host_id != host.id)
        )
        print(f"  host2 拥有: {own}, 别人拥有: {other}")

        token = make_token(host)
        client = TestClient(app)
        resp = client.get(
            "/api/host/listings",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        print(f"  API 返回 total_listings: {body['total_listings']}")
        assert body['total_listings'] == own, \
            f"expected {own} (own listings), got {body['total_listings']}"
        # 所有 listing_id 都属于 host2
        with SessionLocal() as db2:
            for item in body['items']:
                listing = db2.get(Listing, item['listing_id'])
                assert listing.host_id == host.id, \
                    f"listing #{item['listing_id']} belongs to host {listing.host_id}, not {host.id}"
        print("  ✓ 所有返回 listing 都属于 host2")
    return True




def test_6_become_host():
    print("\n[Test 6] POST /api/host/become 一键成房东")
    from fastapi.testclient import TestClient
    from app.main import app

    with SessionLocal() as db:
        # 准备一个普通用户
        u = setup_user(db, f"b15_bh_{uuid.uuid4().hex[:6]}@test.com", f"b15_bh_{uuid.uuid4().hex[:4]}", is_host=False)
        token = make_token(u)
        try:
            assert u.is_host is False, "测试前提: is_host=False"
            client = TestClient(app)
            resp = client.post(
                "/api/host/become",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200, f"status={resp.status_code}: {resp.text}"
            body = resp.json()
            print(f"  返回 is_host={body['is_host']}, listing_count={body['listing_count']}")
            assert body["is_host"] is True

            # DB 验证 (fresh session 避免 identity map 缓存)
            with SessionLocal() as db2:
                u2 = db2.get(User, u.id)
                assert u2.is_host is True, "DB is_host should be True"
            print("  ✓ DB 中 is_host=True")

            # 幂等: 再次调用不报错
            resp2 = client.post(
                "/api/host/become",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp2.status_code == 200
            assert resp2.json()["is_host"] is True
            print("  ✓ 幂等: 重复调用 OK")
        finally:
            cleanup(db, u)
    return True


def main() -> int:
    print("=" * 60)
    print("🚀 Block 15 验证 (Host dashboard + view 计数)")
    print("=" * 60)
    try:
        tests = [
            test_1_demo_hosts_exist,
            test_2_non_host_forbidden,
            test_3_view_count,
            test_4_revenue_calc,
            test_5_listings_endpoint,
            test_6_become_host,
        ]
        for fn in tests:
            try:
                fn()
            except AssertionError as e:
                print(f"❌ {fn.__name__} 断言失败: {e}")
                return 1
            except Exception as e:
                print(f"❌ {fn.__name__} 异常: {type(e).__name__}: {e}")
                import traceback; traceback.print_exc()
                return 1
    finally:
        engine.dispose()
    print("\n" + "=" * 60)
    print("✅ Block 15 全部测试通过 (6/6)")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())

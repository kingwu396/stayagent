"""Block 27 验证脚本 (完善房东端: 房源 CRUD / 图片上传 / 订单管理 / 房态日历 / 冲突校验)

Test 1: 图片上传 — 合法 PNG 成功 + GET 可取回; 错误类型 415; 超 5MB 413
Test 2: 房源 CRUD — 创建 → dashboard 可见 → PATCH 改价 → 越权 403 → 非 host 403 → 删除约束
Test 3: 订单管理 — list 隔离 / confirm (pending→confirmed + Payment→succeeded) / cancel / complete 状态机
Test 4: 冲突校验 — 重叠 409 / 首尾相接不冲突 / cancelled 不占位 / agent 工具路径 CONFLICT
Test 5: 房态日历 — 返回当月正确占位区间

运行: uv run python -m scripts.test_host_block27
"""
import base64
import logging
import sys
import uuid
from datetime import date

from sqlalchemy import delete, func, text
from fastapi.testclient import TestClient

from app.core.security import hash_password, create_access_token
from app.db.session import SessionLocal, engine
from app.models import User, Listing, Booking, Payment

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 1x1 透明 PNG
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def setup_user(db, email: str, username: str, is_host: bool = False) -> User:
    existing = db.execute(select_(User).where(User.email == email)).scalar_one_or_none()
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


def select_(model):
    """延迟导入 select (避免和顶部 import 风格混用, 纯粹保持脚本自包含)"""
    from sqlalchemy import select
    return select(model)


def make_token(user: User) -> str:
    token, _jti, _exp = create_access_token(user.id)
    return token


def make_client() -> TestClient:
    from app.main import app
    return TestClient(app)


def full_cleanup(db, *users: User) -> None:
    """删 users 关联的 payments → bookings → listings → users"""
    for u in users:
        if not u:
            continue
        db.execute(
            delete(Payment).where(
                Payment.booking_id.in_(select_(Booking.id).where(Booking.user_id == u.id))
            )
        )
        db.execute(delete(Booking).where(Booking.user_id == u.id))
        # 该 user 作为 host 的房源 (其订单可能来自别人, 先按 listing 清)
        host_listing_ids = select_(Listing.id).where(Listing.host_id == u.id)
        db.execute(
            delete(Payment).where(
                Payment.booking_id.in_(select_(Booking.id).where(Booking.listing_id.in_(host_listing_ids)))
            )
        )
        db.execute(delete(Booking).where(Booking.listing_id.in_(host_listing_ids)))
        db.execute(delete(Listing).where(Listing.host_id == u.id))
    for u in users:
        if not u:
            continue
        db.execute(delete(User).where(User.id == u.id))
    db.commit()


def make_host_and_guest(db):
    tag = uuid.uuid4().hex[:6]
    host = setup_user(db, f"b27_host_{tag}@test.com", f"b27h{tag}", is_host=True)
    guest = setup_user(db, f"b27_guest_{tag}@test.com", f"b27g{tag}", is_host=False)
    return host, guest


def create_listing_via_api(client, host_token, **overrides) -> dict:
    payload = {
        "title": "测试房源-大学城精装两居",
        "description": "近地铁, 拎包入住",
        "city": "测试市",
        "country": "测试国",
        "property_type": "apartment",
        "price_per_night": "388.00",
        "cleaning_fee": "50.00",
        "service_fee": "20.00",
        "max_guests": 4,
        "bedrooms": 2,
        "beds": 2,
        "bathrooms": 1,
        "amenities": ["无线网络", "空调"],
        "images": [],
        "latitude": None,
        "longitude": None,
    }
    payload.update(overrides)
    resp = client.post("/api/host/listings", json=payload, headers=auth(host_token))
    assert resp.status_code == 201, f"create listing failed: {resp.status_code} {resp.text}"
    return resp.json()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_1_image_upload():
    print("\n[Test 1] 图片上传 API")
    with SessionLocal() as db:
        u = setup_user(db, f"b27_img_{uuid.uuid4().hex[:6]}@test.com", f"b27i{uuid.uuid4().hex[:4]}")
        token = make_token(u)
        try:
            client = make_client()
            # 合法 PNG
            resp = client.post(
                "/api/uploads/image",
                files={"file": ("tiny.png", TINY_PNG, "image/png")},
                headers=auth(token),
            )
            assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
            url = resp.json()["url"]
            assert url.startswith("/api/uploads/images/"), url
            print(f"  上传成功: {url}")

            # GET 取回
            resp2 = client.get(url)
            assert resp2.status_code == 200, f"GET {url} -> {resp2.status_code}"
            assert resp2.content == TINY_PNG
            assert resp2.headers["content-type"].startswith("image/png")
            print("  ✓ GET 可取回且字节一致")

            # 未登录 401
            resp3 = client.post(
                "/api/uploads/image",
                files={"file": ("tiny.png", TINY_PNG, "image/png")},
            )
            assert resp3.status_code == 401, f"未登录应 401, got {resp3.status_code}"
            print("  ✓ 未登录 401")

            # 错误类型 415
            resp4 = client.post(
                "/api/uploads/image",
                files={"file": ("a.txt", b"hello", "text/plain")},
                headers=auth(token),
            )
            assert resp4.status_code == 415, f"text/plain 应 415, got {resp4.status_code}"
            print("  ✓ 错误类型 415")

            # 超 5MB 413
            big = b"\x89PNG\r\n\x1a\n" + b"\x00" * (6 * 1024 * 1024)
            resp5 = client.post(
                "/api/uploads/image",
                files={"file": ("big.png", big, "image/png")},
                headers=auth(token),
            )
            assert resp5.status_code == 413, f"6MB 应 413, got {resp5.status_code}"
            print("  ✓ 超 5MB 413")

            # 目录穿越拒绝
            resp6 = client.get("/api/uploads/images/..%2F..%2Fetc%2Fpasswd")
            # fastapi 会先按路径段解析, 归一化后通常 404/400; 只要不是 200 且不吐文件
            assert resp6.status_code in (400, 404), f"穿越请求应被拒, got {resp6.status_code}"
            print("  ✓ 目录穿越被拒")
        finally:
            full_cleanup(db, u)
    return True


def test_2_listing_crud():
    print("\n[Test 2] 房源 CRUD")
    with SessionLocal() as db:
        host, guest = make_host_and_guest(db)
        host_token, guest_token = make_token(host), make_token(guest)
        try:
            client = make_client()

            # 非 host 403
            resp = client.post(
                "/api/host/listings",
                json={"title": "x", "city": "y", "country": "z", "property_type": "apartment",
                      "price_per_night": "100"},
                headers=auth(guest_token),
            )
            assert resp.status_code == 403, f"非 host 应 403, got {resp.status_code}"
            print("  ✓ 非 host 创建 403")

            # host 创建
            created = create_listing_via_api(client, host_token)
            lid = created["id"]
            assert created["host_name"] == host.username
            assert created["rating"] == "0" or float(created["rating"]) == 0.0
            print(f"  ✓ 创建 listing #{lid} (host_name={created['host_name']})")

            # dashboard 可见
            resp = client.get("/api/host/listings", headers=auth(host_token))
            ids = [i["listing_id"] for i in resp.json()["items"]]
            assert lid in ids, "新建 listing 应出现在 dashboard"
            print("  ✓ dashboard 列表包含新房源")

            # PATCH 改价
            resp = client.patch(
                f"/api/host/listings/{lid}",
                json={"price_per_night": "499.00"},
                headers=auth(host_token),
            )
            assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
            assert resp.json()["price_per_night"] == "499.00"
            print("  ✓ PATCH 改价生效 (388 → 499)")

            # guest PATCH 他人房源 403
            resp = client.patch(
                f"/api/host/listings/{lid}",
                json={"price_per_night": "1.00"},
                headers=auth(guest_token),
            )
            assert resp.status_code == 403, f"越权应 403, got {resp.status_code}"
            print("  ✓ 越权编辑 403")

            # 有订单 → 删除 409
            b = Booking(
                user_id=guest.id, listing_id=lid,
                check_in=date(2027, 3, 1), check_out=date(2027, 3, 3),
                guests=2, nights=2, subtotal=998, cleaning_fee=50, service_fee=20, total=1068,
                status="confirmed",
            )
            db.add(b)
            db.commit()
            resp = client.delete(f"/api/host/listings/{lid}", headers=auth(host_token))
            assert resp.status_code == 409, f"有订单删除应 409, got {resp.status_code}"
            print("  ✓ 有订单删除 409")

            # 清订单 → 删除成功
            db.execute(delete(Booking).where(Booking.id == b.id))
            db.commit()
            resp = client.delete(f"/api/host/listings/{lid}", headers=auth(host_token))
            assert resp.status_code == 204, f"无订单删除应 204, got {resp.status_code}"
            with SessionLocal() as db2:
                assert db2.get(Listing, lid) is None, "listing 应已删除"
            print("  ✓ 无订单删除成功 (204 + DB 无记录)")

            # 不存在的房源 404
            resp = client.delete(f"/api/host/listings/{lid}", headers=auth(host_token))
            assert resp.status_code == 404
        finally:
            full_cleanup(db, host, guest)
    return True


def test_3_host_bookings():
    print("\n[Test 3] 房东订单管理")
    with SessionLocal() as db:
        host, guest = make_host_and_guest(db)
        host_token, guest_token = make_token(host), make_token(guest)
        try:
            client = make_client()
            listing = create_listing_via_api(client, host_token)
            lid = listing["id"]

            # guest 下单 (走房客 API, 创建 pending)
            resp = client.post(
                "/api/bookings",
                json={"listing_id": lid, "check_in": "2027-03-01", "check_out": "2027-03-03", "guests": 2},
                headers=auth(guest_token),
            )
            assert resp.status_code == 201, f"{resp.status_code}: {resp.text}"
            booking_id = resp.json()["id"]

            # guest 创建 payment (pending)
            resp = client.post(
                "/api/payments",
                json={"booking_id": booking_id, "method": "alipay"},
                headers=auth(guest_token),
            )
            payment_ok = resp.status_code == 201
            assert payment_ok, f"payment 创建失败: {resp.status_code}: {resp.text}"
            print(f"  guest 下单 #{booking_id} + payment 创建 OK")

            # 房东订单列表: 能看到, 含房客名; 隔离 (guest 视角看不到)
            resp = client.get("/api/host/bookings", headers=auth(host_token))
            assert resp.status_code == 200
            items = resp.json()["items"]
            mine = [i for i in items if i["id"] == booking_id]
            assert len(mine) == 1, "房东应看到自己房源的订单"
            assert mine[0]["guest_username"] == guest.username
            assert mine[0]["listing_title"] == listing["title"]
            print("  ✓ 房东订单列表含房客名/房源标题")

            resp = client.get("/api/host/bookings", headers=auth(guest_token))
            assert resp.status_code == 403, "非 host 应 403"
            print("  ✓ 非 host 查订单 403")

            # confirm: pending → confirmed + payment → succeeded
            resp = client.post(f"/api/host/bookings/{booking_id}/confirm", headers=auth(host_token))
            assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
            assert resp.json()["status"] == "confirmed"
            if payment_ok:
                with SessionLocal() as db2:
                    p = db2.execute(
                        select_(Payment).where(Payment.booking_id == booking_id)
                    ).scalar_one_or_none()
                    if p:
                        assert p.status == "succeeded", f"payment 应 succeeded, got {p.status}"
                        print("  ✓ confirm 后 payment → succeeded")
            print("  ✓ confirm: pending → confirmed")

            # 已 confirmed 再 confirm → 400
            resp = client.post(f"/api/host/bookings/{booking_id}/confirm", headers=auth(host_token))
            assert resp.status_code == 400
            print("  ✓ 重复 confirm 400")

            # complete: 未退房 → 400
            resp = client.post(f"/api/host/bookings/{booking_id}/complete", headers=auth(host_token))
            assert resp.status_code == 400, "未退房 complete 应 400"
            print("  ✓ 未退房 complete 400")

            # 改成已退房的日期 → complete 成功
            with SessionLocal() as db2:
                b2 = db2.get(Booking, booking_id)
                b2.check_in = date(2026, 1, 1)
                b2.check_out = date(2026, 1, 2)
                db2.commit()
            resp = client.post(f"/api/host/bookings/{booking_id}/complete", headers=auth(host_token))
            assert resp.status_code == 200 and resp.json()["status"] == "completed"
            print("  ✓ 已退房 complete: confirmed → completed")

            # completed 不可取消
            resp = client.post(f"/api/host/bookings/{booking_id}/cancel", headers=auth(host_token))
            assert resp.status_code == 400
            print("  ✓ completed 不可取消")

            # 再来一单 pending → 房东 cancel → payment 作废
            resp = client.post(
                "/api/bookings",
                json={"listing_id": lid, "check_in": "2027-04-01", "check_out": "2027-04-02", "guests": 1},
                headers=auth(guest_token),
            )
            b2_id = resp.json()["id"]
            resp = client.post(
                "/api/payments",
                json={"booking_id": b2_id, "method": "wechat"},
                headers=auth(guest_token),
            )
            payment2_ok = resp.status_code == 201
            resp = client.post(f"/api/host/bookings/{b2_id}/cancel", headers=auth(host_token))
            assert resp.status_code == 200 and resp.json()["status"] == "cancelled"
            # Block 28: 房东取消应记 cancel_reason=host
            assert resp.json().get("cancel_reason") == "host"
            with SessionLocal() as db2:
                b2row = db2.get(Booking, b2_id)
                assert b2row.cancel_reason == "host"
            print("  ✓ 房东取消 cancel_reason=host")
            if payment2_ok:
                with SessionLocal() as db2:
                    p = db2.execute(
                        select_(Payment).where(Payment.booking_id == b2_id)
                    ).scalar_one_or_none()
                    if p:
                        assert p.status == "failed", f"pending 支付单应作废, got {p.status}"
            print("  ✓ 房东 cancel: pending → cancelled (支付单作废)")

            # 状态筛选
            resp = client.get("/api/host/bookings?status=cancelled", headers=auth(host_token))
            ids = [i["id"] for i in resp.json()["items"]]
            assert b2_id in ids and booking_id not in ids
            print("  ✓ status 筛选生效")
        finally:
            full_cleanup(db, host, guest)
    return True


def test_4_conflict_check():
    print("\n[Test 4] 预订日期冲突校验")
    with SessionLocal() as db:
        host, guest = make_host_and_guest(db)
        host_token, guest_token = make_token(host), make_token(guest)
        try:
            client = make_client()
            listing = create_listing_via_api(client, host_token)
            lid = listing["id"]

            # 第一单: 3/1 - 3/5
            resp = client.post(
                "/api/bookings",
                json={"listing_id": lid, "check_in": "2027-03-01", "check_out": "2027-03-05", "guests": 2},
                headers=auth(guest_token),
            )
            assert resp.status_code == 201
            print("  第一单 3/1~3/5 创建成功")

            # 重叠 409 (3/4 - 3/8)
            resp = client.post(
                "/api/bookings",
                json={"listing_id": lid, "check_in": "2027-03-04", "check_out": "2027-03-08", "guests": 2},
                headers=auth(guest_token),
            )
            assert resp.status_code == 409, f"重叠应 409, got {resp.status_code}: {resp.text}"
            print("  ✓ 重叠日期 409")

            # 完全包含 409 (3/2 - 3/3)
            resp = client.post(
                "/api/bookings",
                json={"listing_id": lid, "check_in": "2027-03-02", "check_out": "2027-03-03", "guests": 2},
                headers=auth(guest_token),
            )
            assert resp.status_code == 409
            print("  ✓ 区间包含 409")

            # 首尾相接 OK (3/5 - 3/7)
            resp = client.post(
                "/api/bookings",
                json={"listing_id": lid, "check_in": "2027-03-05", "check_out": "2027-03-07", "guests": 2},
                headers=auth(guest_token),
            )
            assert resp.status_code == 201, f"首尾相接应成功, got {resp.status_code}: {resp.text}"
            print("  ✓ 首尾相接 (3/5 入住) 不冲突")

            # agent 工具路径: 重叠 → ToolError CONFLICT
            from app.services.agent.tools import create_booking as tool_create_booking, ToolError
            # 先结束本 session 挂起的 REPEATABLE READ 事务,
            # 否则 db.get 看不到上面 API session 提交的 listing (旧快照 → NOT_FOUND)
            db.commit()
            try:
                tool_create_booking(
                    guest, db, listing_id=lid,
                    check_in=date(2027, 3, 6), check_out=date(2027, 3, 9), guests=1,
                )
                assert False, "agent 工具重叠日期应抛 ToolError"
            except ToolError as e:
                assert e.code == "CONFLICT", f"code 应为 CONFLICT, got {e.code}"
                print(f"  ✓ agent 工具路径冲突 → ToolError(CONFLICT): {e}")

            # cancelled 不占位
            with SessionLocal() as db2:
                db2.execute(
                    Booking.__table__.update().where(Booking.listing_id == lid).values(status="cancelled")
                )
                db2.commit()
            resp = client.post(
                "/api/bookings",
                json={"listing_id": lid, "check_in": "2027-03-01", "check_out": "2027-03-03", "guests": 2},
                headers=auth(guest_token),
            )
            assert resp.status_code == 201, f"全部 cancelled 后应可订, got {resp.status_code}"
            print("  ✓ cancelled 订单不占日期")

            # Block 28: 超时作废 → cancel_reason=expired
            # 建新单 + 支付单, 把支付单 created_at 回拨 16 分钟, 触发惰性过期
            resp = client.post(
                "/api/bookings",
                json={"listing_id": lid, "check_in": "2027-05-01", "check_out": "2027-05-02", "guests": 1},
                headers=auth(guest_token),
            )
            exp_bid = resp.json()["id"]
            resp = client.post(
                "/api/payments",
                json={"booking_id": exp_bid, "method": "alipay"},
                headers=auth(guest_token),
            )
            assert resp.status_code == 201
            exp_pid = resp.json()["id"]
            with SessionLocal() as db2:
                db2.execute(
                    Payment.__table__.update()
                    .where(Payment.id == exp_pid)
                    .values(created_at=func.date_sub(func.now(), text("INTERVAL 16 MINUTE")))
                )
                db2.commit()
            # 任意带 expire_stale_payments 的端点 (房客订单列表) 触发过期
            client.get("/api/bookings", headers=auth(guest_token))
            with SessionLocal() as db2:
                b3 = db2.get(Booking, exp_bid)
                p3 = db2.get(Payment, exp_pid)
                assert b3.status == "cancelled", f"超时应作废, got {b3.status}"
                assert b3.cancel_reason == "expired", f"应记 expired, got {b3.cancel_reason}"
                assert p3.status == "failed"
            print("  ✓ 超时未支付自动作废, cancel_reason=expired")
        finally:
            full_cleanup(db, host, guest)
    return True


def test_5_calendar():
    print("\n[Test 5] 房态日历")
    with SessionLocal() as db:
        host, guest = make_host_and_guest(db)
        host_token, guest_token = make_token(host), make_token(guest)
        try:
            client = make_client()
            listing = create_listing_via_api(client, host_token)
            lid = listing["id"]

            # 3 单: 2月尾跨3月 confirmed / 3月中 pending / 4月 (不应出现)
            for ci, co, st in [
                ("2027-02-27", "2027-03-02", "confirmed"),
                ("2027-03-15", "2027-03-18", "pending"),
                ("2027-04-01", "2027-04-03", "confirmed"),
            ]:
                db.add(Booking(
                    user_id=guest.id, listing_id=lid,
                    check_in=date.fromisoformat(ci), check_out=date.fromisoformat(co),
                    guests=1, nights=2, subtotal=776, cleaning_fee=0, service_fee=0, total=776,
                    status=st,
                ))
            db.commit()

            resp = client.get(
                f"/api/host/listings/{lid}/calendar",
                params={"month": "2027-03"},
                headers=auth(host_token),
            )
            assert resp.status_code == 200, f"{resp.status_code}: {resp.text}"
            body = resp.json()
            items = body["items"]
            # 4 月那单不该在, 2 月尾跨进 3 月的该在
            spans = [(i["check_in"], i["check_out"], i["status"]) for i in items]
            assert ("2027-02-27", "2027-03-02", "confirmed") in spans, spans
            assert ("2027-03-15", "2027-03-18", "pending") in spans, spans
            assert len(items) == 2, f"应只有 2 段, got {len(items)}: {spans}"
            print(f"  ✓ 3 月日历返回 2 段占位: {spans}")

            # 非 host 403
            resp = client.get(
                f"/api/host/listings/{lid}/calendar",
                params={"month": "2027-03"},
                headers=auth(guest_token),
            )
            assert resp.status_code == 403
            print("  ✓ 非 host 403")

            # 4 月查 → 只有 4 月那单
            resp = client.get(
                f"/api/host/listings/{lid}/calendar",
                params={"month": "2027-04"},
                headers=auth(host_token),
            )
            items4 = resp.json()["items"]
            assert len(items4) == 1 and items4[0]["check_in"] == "2027-04-01"
            print("  ✓ 4 月日历只含 4 月段")
        finally:
            full_cleanup(db, host, guest)
    return True


def main() -> int:
    print("=" * 60)
    print("🚀 Block 27 验证 (房源 CRUD / 图片上传 / 订单管理 / 日历 / 冲突校验)")
    print("=" * 60)
    try:
        tests = [
            test_1_image_upload,
            test_2_listing_crud,
            test_3_host_bookings,
            test_4_conflict_check,
            test_5_calendar,
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
    print("✅ Block 27 全部测试通过 (5/5)")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())

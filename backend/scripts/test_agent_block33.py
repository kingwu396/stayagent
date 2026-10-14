"""Block 33 验证脚本 (agent 空位查询 + 可订日历工具)

Test 1: 注册链路 — TOOL_DISPATCH / ALL_TOOL_SCHEMAS / TOOL_NAMES 都含两个新工具
Test 2: check_availability — 空房 true + 价格明细 / 重叠 false + 冲突区间 / 首尾相接不冲突 /
        cancelled 不占位 / pending 占位 / 价格计算正确
Test 3: check_availability 参数校验 — 过去日期 / 退房早于入住 / 格式错误 / 房源不存在
Test 4: get_listing_calendar — 占位区间裁剪到窗口 / available_days 统计 / days 上限 90 / 边界日期
运行: uv run python -m scripts.test_agent_block33
"""
import logging
import sys
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import delete

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User, Listing, Booking
from app.services.agent.tools import TOOL_DISPATCH, ToolError, check_availability, get_listing_calendar
from app.services.agent.tool_schemas import ALL_TOOL_SCHEMAS, TOOL_NAMES

logging.basicConfig(level=logging.INFO)
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


def expect_tool_error(name: str, fn, code: str):
    try:
        fn()
        check(name, False, "未抛 ToolError")
    except ToolError as e:
        check(name, e.code == code, f"code={e.code} (期望 {code}) msg={e}")


def main():
    today = date.today()
    suffix = uuid.uuid4().hex[:8]
    db = SessionLocal()
    try:
        # ===== 造数据: host + listing + bookings =====
        host = User(
            email=f"b33-host-{suffix}@test.com",
            username=f"b33host{suffix}",
            password_hash=hash_password("TestPass123!"),
            is_host=True,
        )
        db.add(host)
        db.commit()
        db.refresh(host)

        listing = Listing(
            host_id=host.id,
            host_name=host.username,
            title="Block33 测试房源",
            description="test",
            city="东京",
            country="日本",
            property_type="apartment",
            price_per_night="1000",
            cleaning_fee="200",
            service_fee="50",
            max_guests=4,
            bedrooms=1,
            beds=1,
            bathrooms=1,
            amenities=[],
            images=[],
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)
        lid = listing.id

        # ===== Test 1: 注册链路 =====
        logger.info("Test 1: 工具注册")
        check("TOOL_DISPATCH 含 check_availability", "check_availability" in TOOL_DISPATCH)
        check("TOOL_DISPATCH 含 get_listing_calendar", "get_listing_calendar" in TOOL_DISPATCH)
        check("schemas 含两个新工具", {"check_availability", "get_listing_calendar"} <= set(TOOL_NAMES))
        check("工具总数 14", len(TOOL_NAMES) == 14, f"实际 {len(TOOL_NAMES)}")

        # ===== Test 2: check_availability 业务逻辑 =====
        logger.info("Test 2: check_availability")
        d10 = today + timedelta(days=10)
        d12 = today + timedelta(days=12)

        # 空房
        r = check_availability(user=host, db=db, listing_id=lid, check_in=d10.isoformat(), check_out=d12.isoformat())
        check("空房 available=True", r["available"] is True and r["conflict"] is None)
        check("晚数=2", r["nights"] == 2)
        # 价格: 1000*2 + 200 + 50 = 2250
        check("总价 2250", abs(r["pricing"]["total"] - 2250) < 0.01, f"实际 {r['pricing']['total']}")

        # confirmed 重叠 → 不可订
        b_conf = Booking(
            user_id=host.id, listing_id=lid,
            check_in=d10, check_out=d12,
            guests=2, nights=2, status="confirmed",
            subtotal=Decimal("2000"), total=Decimal("2000"),
        )
        db.add(b_conf)
        db.commit()

        d11 = today + timedelta(days=11)
        r = check_availability(user=host, db=db, listing_id=lid, check_in=d11.isoformat(), check_out=d12.isoformat())
        check("重叠 available=False", r["available"] is False)
        check("冲突区间正确", r["conflict"] and r["conflict"]["check_in"] == d10.isoformat() and r["conflict"]["check_out"] == d12.isoformat())
        check("冲突状态 confirmed", r["conflict"]["status"] == "confirmed")

        # 首尾相接: 前一单 check_out == 新 check_in → 合法
        r = check_availability(user=host, db=db, listing_id=lid, check_in=d12.isoformat(), check_out=(d12 + timedelta(days=1)).isoformat())
        check("首尾相接 available=True", r["available"] is True)

        # cancelled 不占位
        d20 = today + timedelta(days=20)
        d22 = today + timedelta(days=22)
        db.add(Booking(user_id=host.id, listing_id=lid, check_in=d20, check_out=d22, guests=1, nights=2, status="cancelled", subtotal=Decimal("0"), total=Decimal("0")))
        db.commit()
        r = check_availability(user=host, db=db, listing_id=lid, check_in=d20.isoformat(), check_out=d22.isoformat())
        check("cancelled 不占位", r["available"] is True)

        # pending 占位
        d30 = today + timedelta(days=30)
        d31 = today + timedelta(days=31)
        db.add(Booking(user_id=host.id, listing_id=lid, check_in=d30, check_out=d31, guests=1, nights=1, status="pending", subtotal=Decimal("0"), total=Decimal("0")))
        db.commit()
        r = check_availability(user=host, db=db, listing_id=lid, check_in=d30.isoformat(), check_out=d31.isoformat())
        check("pending 占位", r["available"] is False and r["conflict"]["status"] == "pending")

        # ===== Test 3: 参数校验 =====
        logger.info("Test 3: check_availability 参数校验")
        expect_tool_error(
            "过去日期 INVALID_ARGS",
            lambda: check_availability(user=host, db=db, listing_id=lid,
                                       check_in=(today - timedelta(days=1)).isoformat(),
                                       check_out=today.isoformat()),
            "INVALID_ARGS",
        )
        expect_tool_error(
            "退房早于入住 INVALID_ARGS",
            lambda: check_availability(user=host, db=db, listing_id=lid,
                                       check_in=d10.isoformat(), check_out=d10.isoformat()),
            "INVALID_ARGS",
        )
        expect_tool_error(
            "日期格式错误 INVALID_ARGS",
            lambda: check_availability(user=host, db=db, listing_id=lid,
                                       check_in="10月13号", check_out=d12.isoformat()),
            "INVALID_ARGS",
        )
        expect_tool_error(
            "房源不存在 NOT_FOUND",
            lambda: check_availability(user=host, db=db, listing_id=999999999,
                                       check_in=d10.isoformat(), check_out=d12.isoformat()),
            "NOT_FOUND",
        )

        # ===== Test 4: get_listing_calendar =====
        logger.info("Test 4: get_listing_calendar")
        r = get_listing_calendar(user=host, db=db, listing_id=lid, days=40)
        check("窗口 40 天", r["total_days"] == 40 and r["to"] == (today + timedelta(days=40)).isoformat())
        # 占位: [d10,d12) confirmed + [d30,d31) pending (cancelled 不算) = 3 晚
        check("占位区间 2 段", len(r["occupied_ranges"]) == 2, f"实际 {r['occupied_ranges']}")
        check("available_days = 40-3 = 37", r["available_days"] == 37, f"实际 {r['available_days']}")

        # 窗口裁剪: 11 天窗口 [today, today+11), confirmed 订单 [d10, d12) 被裁成 [d10, today+11)
        r = get_listing_calendar(user=host, db=db, listing_id=lid, days=11)
        check("小窗口只含 1 段", len(r["occupied_ranges"]) == 1, f"实际 {r['occupied_ranges']}")
        check("区间右端裁剪到窗口右端", r["occupied_ranges"] and r["occupied_ranges"][0]["check_out"] == (today + timedelta(days=11)).isoformat()
              and r["occupied_ranges"][0]["check_in"] == d10.isoformat(), f"实际 {r['occupied_ranges']}")

        # days 缺省 30 / 上限 90 / 非法值兜底
        check("days 缺省 30", get_listing_calendar(user=host, db=db, listing_id=lid)["total_days"] == 30)
        check("days 上限 90", get_listing_calendar(user=host, db=db, listing_id=lid, days=500)["total_days"] == 90)
        check("days 非法兜底 30", get_listing_calendar(user=host, db=db, listing_id=lid, days="abc")["total_days"] == 30)

        # 边界: 订单 check_out == 今天 (已退房) 不占未来
        b_past = Booking(
            user_id=host.id, listing_id=lid,
            check_in=today - timedelta(days=2), check_out=today,
            guests=1, nights=2, status="confirmed",
            subtotal=Decimal("0"), total=Decimal("0"),
        )
        db.add(b_past)
        db.commit()
        r = get_listing_calendar(user=host, db=db, listing_id=lid)
        nights = sum((date.fromisoformat(x["check_out"]) - date.fromisoformat(x["check_in"])).days for x in r["occupied_ranges"])
        # 30 天窗口 [today, today+30): 只含 confirmed [d10,d12)=2 晚; d30 的 pending 恰在窗口外, 已退房的也不占
        check("已退房订单不占未来", nights == 2 and len(r["occupied_ranges"]) == 1, f"实际占 {nights} 晚 {r['occupied_ranges']}")

        logger.info("=" * 40)
        logger.info("结果: %d 通过, %d 失败", PASS, FAIL)
        return 0 if FAIL == 0 else 1
    finally:
        # 清理测试数据
        db.execute(delete(Booking).where(Booking.listing_id == lid))
        db.execute(delete(Listing).where(Listing.id == lid))
        db.execute(delete(User).where(User.id == host.id))
        db.commit()
        db.close()


if __name__ == "__main__":
    sys.exit(main())

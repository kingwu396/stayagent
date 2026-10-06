"""Block 14 验证脚本: 1000 条 + DB 端过滤 + DB端分页

Test 1: 1000 条总数
Test 2: 50 城市 distinct count
Test 3: 无过滤 list -> 1000 total, 第一页 20 条
Test 4: city 过滤 -> 20 条 (Tokyo)
Test 5: 价格区间 -> DB 过滤 (total 准确)
Test 6: amenities 过滤 -> JSON_CONTAINS (全 DB)
Test 7: 分页 -> DB OFFSET (page=2 应返回第 21-40)
Test 9: page 越界 -> 返回空 (不报错)
Test 10: 性能 -> 复杂查询 < 100ms

运行: uv run python -m scripts.test_listings_db_filter
"""
import logging
import sys
import time

from sqlalchemy import select, func, text

from app.db.session import SessionLocal, engine
from app.models import Listing

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_1_total_count():
    print("\n[Test 1] Total listings count == 1000")
    with SessionLocal() as db:
        n = db.scalar(select(func.count()).select_from(Listing))
    print(f"  actual: {n}")
    assert n == 1000, f"expected 1000, got {n}"
    print("  ✓ 1000 listings seeded")


def test_2_distinct_cities():
    print("\n[Test 2] Distinct cities == 50")
    with SessionLocal() as db:
        n = db.scalar(select(func.count(Listing.city.distinct())))
    print(f"  actual: {n} cities")
    assert n == 50, f"expected 50, got {n}"
    print("  ✓ 50 cities")


def test_3_list_endpoint_no_filter():
    print("\n[Test 3] GET /api/listings no filter")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    t0 = time.monotonic()
    resp = client.get("/api/listings")
    dt = (time.monotonic() - t0) * 1000
    assert resp.status_code == 200
    body = resp.json()
    print(f"  total={body['total']} page={body['page']} page_size={body['page_size']} items={len(body['items'])} ({dt:.1f}ms)")
    assert body['total'] == 1000
    assert len(body['items']) == 20  # 默认 page_size
    print(f"  ✓ 总 1000, 第一页 20 条, 响应 {dt:.1f}ms")


def test_4_city_filter():
    print("\n[Test 4] GET /api/listings?city=Tokyo -> 20")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    resp = client.get("/api/listings?city=Tokyo")
    body = resp.json()
    print(f"  total={body['total']}, items={len(body['items'])}")
    assert body['total'] == 20
    assert all(it['city'] == 'Tokyo' for it in body['items'])
    print("  ✓ Tokyo 城市 20 条")


def test_5_price_range_filter():
    print("\n[Test 5] GET /api/listings?min_price=200&max_price=500 -> DB")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    resp = client.get("/api/listings?min_price=200&max_price=500")
    body = resp.json()
    print(f"  total={body['total']} (price 200-500 的房源数)")
    assert body['total'] > 0
    assert body['total'] < 1000  # 不可能所有都满足
    assert all(200 <= float(it['price_per_night']) <= 500 for it in body['items'])
    print(f"  ✓ DB 端过滤, total 准确 ({body['total']} 条)")


def test_6_amenities_json_contains():
    print("\n[Test 6] amenities=wifi,pool (JSON_CONTAINS AND 语义)")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    # villa 通常同时有 wifi + pool
    resp = client.get("/api/listings?amenities=wifi,pool")
    body = resp.json()
    print(f"  total={body['total']} (同时含 wifi+pool 的房源)")
    # 验所有结果都满足 (DB 端过滤结果可信)
    assert body['total'] > 0
    # 从 DB 二次确认
    with SessionLocal() as db:
        rows = db.execute(
            select(Listing.amenities).where(
                func.json_contains(Listing.amenities, '["wifi","pool"]') == 1
            )
        ).scalars().all()
    assert len(rows) == body['total'], f"DB count ({len(rows)}) != API count ({body['total']})"
    print(f"  ✓ JSON_CONTAINS 准确, total {body['total']} 与 DB 二次查询一致")


def test_7_pagination_db_offset():
    print("\n[Test 7] DB OFFSET 分页: page=2 应返回第 21-40")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    resp1 = client.get("/api/listings?page=1&page_size=20")
    resp2 = client.get("/api/listings?page=2&page_size=20")
    items1 = resp1.json()['items']
    items2 = resp2.json()['items']
    ids1 = {it['id'] for it in items1}
    ids2 = {it['id'] for it in items2}
    print(f"  page=1 ids (前 5): {sorted(ids1)[:5]}")
    print(f"  page=2 ids (前 5): {sorted(ids2)[:5]}")
    assert not (ids1 & ids2), "page=1 和 page=2 应无重叠"
    assert len(items2) == 20
    print("  ✓ OFFSET 分页无重叠, page=2 取 21-40")


def test_8_page_out_of_range():
    print("\n[Test 8] page=99 (越界) 返回空 + 0")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    resp = client.get("/api/listings?page=99&page_size=20")
    body = resp.json()
    print(f"  total={body['total']} items={len(body['items'])}")
    assert body['total'] == 1000  # total 仍算全表
    assert len(body['items']) == 0  # items 空数组
    print("  ✓ 越界 page 返回空数组, total 仍正确")


def test_9_perf_complex_query():
    print("\n[Test 9] 性能: 复杂查询 < 100ms")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    # 多重过滤: city + price + amenities + 分页
    queries = [
        ("no filter", ""),
        ("city", "?city=Tokyo"),
        ("city+price", "?city=Tokyo&min_price=100&max_price=300"),
        ("city+price+amenities", "?city=Tokyo&min_price=100&max_price=300&amenities=wifi,pool"),
        ("page=10", "?page=10&page_size=20"),
    ]
    for label, qs in queries:
        # 跑 3 次取平均 (避开冷启动)
        times = []
        for _ in range(3):
            t0 = time.monotonic()
            r = client.get(f"/api/listings{qs}")
            times.append((time.monotonic() - t0) * 1000)
        avg = sum(times) / len(times)
        print(f"  {label:25s} avg={avg:.1f}ms (min={min(times):.1f}, max={max(times):.1f})  total={r.json()['total']}")
        assert r.status_code == 200
        assert avg < 100, f"query '{label}' took {avg:.1f}ms > 100ms"


def main() -> int:
    print("=" * 60)
    print("🚀 Block 14 验证 (1000 listings + DB 过滤/分页)")
    print("=" * 60)
    try:
        tests = [
            test_1_total_count,
            test_2_distinct_cities,
            test_3_list_endpoint_no_filter,
            test_4_city_filter,
            test_5_price_range_filter,
            test_6_amenities_json_contains,
            test_7_pagination_db_offset,
            test_8_page_out_of_range,
            test_9_perf_complex_query,
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
    print("✅ Block 14 全部测试通过 (9/9)")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())

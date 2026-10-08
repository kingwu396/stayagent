"""Block 12 验证脚本 (Tools 9-12 + PDF 上传 + RAG)

Test 1: TOOL_DISPATCH 总数 = 12
Test 2: list_my_trips (Tool 9) - 直接调函数, 验证返回结构
Test 3: parse_travel_plan_pdf (Tool 10) - 输入文本, 输出含 cities/dates
Test 4: recommend_from_plan (Tool 11) - 输入 Tokyo 计划, 推荐含 Tokyo 房源
Test 5: search_travel_tips (Tool 12) - 查 "日本签证" 返回 visa 类贴士 top-3
Test 6: PDF 上传 API - 上传测试 PDF → 返回 text 含内容

运行: uv run python -m scripts.test_agent_block12
"""
import io
import logging
import sys
import uuid
from datetime import date as date_cls, timedelta
from pathlib import Path

from sqlalchemy import select, delete

from app.core.security import hash_password, create_access_token
from app.db.session import SessionLocal, engine
from app.models import (
    User, Booking, Listing, TravelTip,
)
from app.services.agent.tools import (
    TOOL_DISPATCH,
    list_my_trips, parse_travel_plan_pdf, recommend_from_plan,
    search_travel_tips,
)
from app.services.rag import retrieve_tips

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def setup_user(db) -> User:
    name = f"b12_{uuid.uuid4().hex[:6]}"
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
    db.execute(delete(User).where(User.id == user.id))
    db.commit()


def pick_listing(db, max_guests: int = 2) -> Listing:
    return db.execute(
        select(Listing).where(Listing.max_guests >= max_guests).limit(1)
    ).scalar_one()


def make_token(user: User) -> str:
    token, _jti, _exp = create_access_token(user.id)
    return token


def make_booking(db, user: User, listing: Listing) -> Booking:
    b = Booking(
        user_id=user.id,
        listing_id=listing.id,
        check_in=date_cls(2026, 12, 1),
        check_out=date_cls(2026, 12, 3),
        guests=2,
        nights=2,
        subtotal=200.0,
        cleaning_fee=10.0,
        service_fee=8.0,
        total=218.0,
        status="confirmed",
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


def make_test_pdf() -> bytes:
    """生成一个最小的有效 PDF (测试用)"""
    # 最小 PDF: Hello world x51 (作为文本内容, pdfplumber 能抽)
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 100 >>
stream
BT /F1 12 Tf 100 700 Td (Travel Plan: Tokyo 2026-11-01 to 2026-11-05) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000226 00000 n
0000000376 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
456
%%EOF
"""
    return pdf_content


# ============ Tests ============

def test_1_dispatch() -> bool:
    print("\n[Test 1] TOOL_DISPATCH 总数 = 12")
    expected = {
        "search_listings", "get_listing_detail", "compare_listings",
        "add_to_wishlist", "remove_from_wishlist", "create_wishlist",
        "list_wishlists", "create_booking",
        "list_my_trips", "parse_travel_plan_pdf",
        "recommend_from_plan", "search_travel_tips",
    }
    actual = set(TOOL_DISPATCH.keys())
    missing = expected - actual
    extra = actual - expected
    print(f"  actual ({len(actual)}): {sorted(actual)}")
    assert len(actual) == 12, f"expected 12 tools, got {len(actual)}"
    assert not missing, f"missing tools: {missing}"
    print("  ✓ 12 tools registered")
    return True


def test_2_list_my_trips(db, user: User, listing: Listing) -> bool:
    print("\n[Test 2] Tool 9: list_my_trips")
    # 准备: 用户有 2 个 booking (1 confirmed, 1 cancelled)
    b1 = make_booking(db, user, listing)
    # cancelled booking
    b2 = Booking(
        user_id=user.id, listing_id=listing.id,
        check_in=date_cls(2026, 11, 1), check_out=date_cls(2026, 11, 3),
        guests=1, nights=2, subtotal=100, cleaning_fee=5, service_fee=4, total=109,
        status="cancelled",
    )
    db.add(b2)
    db.commit()
    db.refresh(b2)

    # T2.1: 无过滤 → 全部
    r = list_my_trips(user=user, db=db)
    print(f"  no filter: count={r['count']}")
    assert r["count"] == 2, f"expected 2, got {r['count']}"
    assert all("booking_id" in item for item in r["items"])

    # T2.2: status=confirmed → 1 个
    r = list_my_trips(user=user, db=db, status="confirmed")
    print(f"  status=confirmed: count={r['count']}")
    assert r["count"] == 1
    assert r["items"][0]["status"] == "confirmed"

    # T2.3: status=cancelled → 1 个
    r = list_my_trips(user=user, db=db, status="cancelled")
    print(f"  status=cancelled: count={r['count']}")
    assert r["count"] == 1

    # T2.4: 非法 status → INVALID_ARGS
    try:
        list_my_trips(user=user, db=db, status="invalid_status")
        raise AssertionError("expected ToolError")
    except Exception as e:
        code = getattr(e, "code", None)
        assert code == "INVALID_ARGS", f"expected code=INVALID_ARGS, got {code}"
        print(f"  invalid status -> INVALID_ARGS ✓")
    print("  ✓ list_my_trips 全路径 OK")
    return True


def test_3_parse_plan(db, user: User) -> bool:
    print("\n[Test 3] Tool 10: parse_travel_plan_pdf")
    text = (
        "My travel plan: visit Tokyo from 2026-11-01 to 2026-11-05, "
        "then Kyoto on 2026-11-03 for temples and food. "
        "Budget around 1500 USD, 2 people."
    )
    import asyncio
    r = asyncio.run(parse_travel_plan_pdf(user=user, db=db, plan_text=text))
    print(f"  parsed: {r['parsed']}")
    parsed = r["parsed"]
    assert "Tokyo" in parsed["cities"] or "Kyoto" in parsed["cities"], \
        f"expected Tokyo/Kyoto, got {parsed['cities']}"
    assert "2026-11-01" in parsed["dates"], f"expected ISO date, got {parsed['dates']}"
    assert r["raw_excerpt"][:100] == text[:100]
    print(f"  method={r['method']} (llm 优先, 失败 regex 兜底)")
    print("  ✓ parse_travel_plan_pdf 抽到 cities/dates")
    return True


def test_4_recommend_from_plan(db, user: User) -> bool:
    print("\n[Test 4] Tool 11: recommend_from_plan")
    text = "Going to Tokyo from 2026-11-01 to 2026-11-05. Love sushi and temples."
    import asyncio
    r = asyncio.run(recommend_from_plan(user=user, db=db, plan_text=text, max_results=3))
    print(f"  plan_summary: {r['plan_summary']}")
    print(f"  recommendations: {len(r['recommendations'])} listings")
    assert r["sources"] == "search_listings"
    assert "cities" in r["plan_summary"]
    # 应该命中 Tokyo 房源 (seed 里 10 个城市含 Tokyo)
    if r["recommendations"]:
        first_city = r["recommendations"][0].get("city", "?")
        print(f"  first hit city: {first_city}")
        assert first_city in ("Tokyo",), f"expected Tokyo, got {first_city}"
    else:
        print(f"  ⚠️ no recommendations (Tokyo seed 缺失?)")
    print("  ✓ recommend_from_plan 走 search_listings 路径")
    return True


def test_5_search_travel_tips(db, user: User) -> bool:
    print("\n[Test 5] Tool 12: search_travel_tips (RAG)")
    # T5.1: visa query
    r = search_travel_tips(user=user, db=db, query="日本签证怎么办理", top_k=3)
    print(f"  query='日本签证怎么办理' → {r['count']} tips")
    assert r["count"] == 3
    # score 降序
    scores = [t["score"] for t in r["tips"]]
    assert scores == sorted(scores, reverse=True), f"scores not desc: {scores}"
    # visa 类应该靠前
    top1 = r["tips"][0]
    print(f"  top1: [{top1['score']:.3f}] {top1['title']} ({top1['category']})")
    assert "Visa" in top1["title"] or "签证" in top1["title"], \
        f"expected visa tip, got '{top1['title']}'"

    # T5.2: category 过滤
    r = search_travel_tips(user=user, db=db, query="地铁", top_k=3, category="transport")
    print(f"  query='地铁' + category=transport → {r['count']} tips")
    assert r["count"] == 3
    assert all(t["category"] == "transport" for t in r["tips"]), \
        "category filter failed"

    # T5.3: 空 query → INVALID_ARGS
    try:
        search_travel_tips(user=user, db=db, query="")
        raise AssertionError("expected ToolError")
    except Exception as e:
        code = getattr(e, "code", None)
        assert code == "INVALID_ARGS", f"expected code=INVALID_ARGS, got {code}"
        print(f"  empty query -> INVALID_ARGS ✓")
    print("  ✓ search_travel_tips 检索 + 过滤 + 校验 全过")
    return True


def test_6_pdf_upload(db, user: User, token: str) -> bool:
    print("\n[Test 6] POST /api/uploads/pdf")
    from fastapi.testclient import TestClient
    from app.main import app

    pdf_bytes = make_test_pdf()
    print(f"  test PDF: {len(pdf_bytes)} bytes")

    client = TestClient(app)
    resp = client.post(
        "/api/uploads/pdf",
        files={"file": ("plan.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers={"Authorization": f"Bearer {token}"},
    )
    print(f"  status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  body: {resp.text}")
    assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "file_id" in body
    assert body["filename"] == "plan.pdf"
    assert body["char_count"] > 0
    assert body["page_count"] >= 1
    assert "Travel Plan" in body["text"] or "Tokyo" in body["text"], \
        f"PDF text should contain expected content: {body['text'][:200]}"
    print(f"  ✓ file_id={body['file_id'][:8]}... pages={body['page_count']} chars={body['char_count']}")
    return True


def test_7_pdf_upload_unauthorized(db) -> bool:
    print("\n[Test 7] POST /api/uploads/pdf 无 token")
    from fastapi.testclient import TestClient
    from app.main import app

    pdf_bytes = make_test_pdf()
    client = TestClient(app)
    resp = client.post(
        "/api/uploads/pdf",
        files={"file": ("plan.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        # 不带 Authorization
    )
    print(f"  status: {resp.status_code}")
    assert resp.status_code == 401, f"expected 401, got {resp.status_code}"
    print("  ✓ 401 OK")
    return True


def test_8_pdf_upload_wrong_type(db, user: User, token: str) -> bool:
    print("\n[Test 8] POST /api/uploads/pdf 非 PDF 文件")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    resp = client.post(
        "/api/uploads/pdf",
        files={"file": ("fake.txt", io.BytesIO(b"hello world"), "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    print(f"  status: {resp.status_code}")
    assert resp.status_code == 415, f"expected 415, got {resp.status_code}"
    print("  ✓ 415 OK")
    return True




# ============ Block 12 attachment 通道测试 ============

def test_9_attachment_in_db(db, user: User, token: str) -> bool:
    """Test 9: attachment 走单独通道, DB user_message 只存纯文字, LLM 看到 augment"""
    print("\n[Test 9] Block 12 attachment 通道 (chat_stream + run_agent)")
    import asyncio
    from app.services.agent.orchestrator import (
        run_agent, _augment_user_message_with_attachment,
    )
    from app.schemas.agent import AttachmentPayload

    aug = _augment_user_message_with_attachment(
        "帮我看看这个行程",
        AttachmentPayload(file_id="abc", filename="plan.pdf", text="Tokyo 11月1日", char_count=10, page_count=1),
    )
    print(f"  augmented preview: {aug[:80]}...")
    assert "帮我看看这个行程" in aug
    assert "plan.pdf" in aug
    assert "Tokyo 11月1日" in aug

    async def call_run():
        return await run_agent(
            db=db, user=user,
            user_message="只想问签证怎么办",
            conversation_id=None,
            attachment=AttachmentPayload(
                file_id="f123", filename="japan.pdf",
                text="Tokyo 11月1日到11月7日 预算1800刀", char_count=30, page_count=2,
            ),
        )
    run = asyncio.run(call_run())
    print(f"  AgentRun.user_message: '{run.user_message[:50]}'")
    assert "只想问签证怎么办" in run.user_message
    assert "japan.pdf" not in run.user_message
    assert "Tokyo" not in run.user_message

    from app.models import Message as MessageModel
    msgs = db.execute(
        __import__('sqlalchemy').select(MessageModel).where(MessageModel.conversation_id == run.conversation_id)
    ).scalars().all()
    assert len(msgs) >= 1
    print(f"  user_msg in DB: '{msgs[0].content[:50]}'")
    assert msgs[0].content == "只想问签证怎么办"
    print("  ✓ DB 存的是纯文字, attachment text 不污染")
    return True


def test_10_parse_travel_with_text(db, user: User) -> bool:
    """Test 10: parse_travel_plan_pdf 用 plan_text (不是 file_path) 调时, 工具正确返回"""
    print("\n[Test 10] parse_travel_plan_pdf schema 修复验证")
    import asyncio
    result = asyncio.run(parse_travel_plan_pdf(
        user=user, db=db,
        plan_text="Going to Tokyo from 2026-11-01 to 2026-11-05. Love sushi.",
    ))
    parsed = result["parsed"]
    print(f"  method={result['method']}, cities={parsed['cities']}, dates={parsed['dates']}")
    assert "Tokyo" in parsed["cities"]
    assert "2026-11-01" in parsed["dates"]
    print("  ✓ plan_text 路径正常工作")

    try:
        parse_travel_plan_pdf(user=user, db=db, file_path="/tmp/foo.pdf")
        raise AssertionError("expected exception")
    except TypeError as e:
        # plan_text 是必需 positional 参数, 缺它会 Python-level TypeError
        print(f"  ✓ 误传 file_path (缺 plan_text) -> TypeError: {str(e)[:60]}")
    except Exception as e:
        code = getattr(e, "code", None)
        assert code == "INVALID_ARGS", f"expected INVALID_ARGS, got {code}"
        print(f"  ✓ 误传 file_path -> INVALID_ARGS")

    from app.services.agent.tool_schemas import ALL_TOOL_SCHEMAS
    schema_dict = {s["function"]["name"]: s for s in ALL_TOOL_SCHEMAS}
    p_schema = schema_dict["parse_travel_plan_pdf"]["function"]["parameters"]
    assert "plan_text" in p_schema["properties"], f"expected plan_text, got {list(p_schema['properties'].keys())}"
    assert "file_path" not in p_schema["properties"], f"file_path should be removed"
    assert p_schema["required"] == ["plan_text"]
    print(f"  ✓ schema 已修正: properties={list(p_schema['properties'].keys())}, required={p_schema['required']}")

    r_schema = schema_dict["recommend_from_plan"]["function"]["parameters"]
    assert "plan_text" in r_schema["properties"]
    assert "plan_id" not in r_schema["properties"]
    assert r_schema["required"] == ["plan_text"]
    print(f"  ✓ recommend_from_plan schema 也修正: required={r_schema['required']}")
    return True


# ============ Main ============

def main() -> int:
    print("=" * 60)
    print("🚀 Block 12 验证开始 (Tools 9-12 + PDF + RAG)")
    print("=" * 60)

    try:
        # Test 1 不依赖 DB
        if not test_1_dispatch():
            print("❌ Test 1 失败"); return 1

        with SessionLocal() as db:
            user = setup_user(db)
            token = make_token(user)
            listing = pick_listing(db)
            print(f"\ntest user: {user.email}, listing: #{listing.id}")

            try:
                tests = [
                    ("2-list_my_trips", lambda: test_2_list_my_trips(db, user, listing)),
                    ("3-parse_plan", lambda: test_3_parse_plan(db, user)),
                    ("4-recommend", lambda: test_4_recommend_from_plan(db, user)),
                    ("5-search_tips", lambda: test_5_search_travel_tips(db, user)),
                    ("6-pdf_upload", lambda: test_6_pdf_upload(db, user, token)),
                    ("7-pdf_unauth", lambda: test_7_pdf_upload_unauthorized(db)),
                    ("8-pdf_wrong_type", lambda: test_8_pdf_upload_wrong_type(db, user, token)),
                    ("9-attachment", lambda: test_9_attachment_in_db(db, user, token)),
                    ("10-parse_schema", lambda: test_10_parse_travel_with_text(db, user)),
                ]
                for label, fn in tests:
                    try:
                        if not fn():
                            print(f"❌ {label} 失败"); return 1
                    except AssertionError as e:
                        print(f"❌ {label} 断言失败: {e}")
                        return 1
                    except Exception as e:
                        print(f"❌ {label} 异常: {type(e).__name__}: {e}")
                        import traceback; traceback.print_exc()
                        return 1
            finally:
                cleanup(db, user)
    finally:
        engine.dispose()

    print("\n" + "=" * 60)
    print("✅ Block 12 全部测试通过 (10/10)")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())

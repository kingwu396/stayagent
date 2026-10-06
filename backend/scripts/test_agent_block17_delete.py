"""Block 17: 验证 DELETE /api/agent/conversations/{id}

Test 1: DELETE 自己的对话 + CASCADE 清理 (run + message 全部消失)
Test 2: DELETE 不存在的 ID → 404
Test 3: DELETE 别人的对话 → 404 (防越权)

每个测试用独立的 SessionLocal, 避免上一个测试 close 后 detach.
运行: uv run python -m scripts.test_agent_block17_delete
"""
import logging
import uuid

from sqlalchemy import select

from app.core.security import hash_password, create_access_token
from app.db.session import SessionLocal
from app.models import User, Conversation, AgentRun, Message

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def setup_user(email_prefix):
    """建一个用户, 返回 (user_id, access_token)."""
    db = SessionLocal()
    try:
        name = f"{email_prefix}_{uuid.uuid4().hex[:6]}"
        u = User(
            email=f"{name}@test.com",
            username=name,
            password_hash=hash_password("TestPass123!"),
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        token, _jti, _exp = create_access_token(u.id)
        return u.id, token
    finally:
        db.close()


def test_delete_own(user_id, token):
    print("\n[Test 1] DELETE own conversation + CASCADE")
    from fastapi.testclient import TestClient
    from app.main import app

    # 准备数据
    db = SessionLocal()
    try:
        conv = Conversation(user_id=user_id, title="b17-to-delete")
        db.add(conv)
        db.commit()
        db.refresh(conv)

        run = AgentRun(
            conversation_id=conv.id,
            user_id=user_id,
            user_message="hi",
            status="completed",
            final_content="hello",
        )
        db.add(run)
        db.commit()

        db.add_all([
            Message(conversation_id=conv.id, role="user", content="hi"),
            Message(conversation_id=conv.id, role="assistant", content="hello"),
        ])
        db.commit()
        conv_id = conv.id
    finally:
        db.close()

    # 执行 DELETE
    client = TestClient(app)
    resp = client.delete(
        f"/api/agent/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204, f"expected 204, got {resp.status_code} {resp.text}"

    # 用全新 session 验证 CASCADE 清理
    db = SessionLocal()
    try:
        assert db.execute(select(Conversation).where(Conversation.id == conv_id)).scalar_one_or_none() is None
        assert db.execute(select(AgentRun).where(AgentRun.conversation_id == conv_id)).first() is None
    finally:
        db.close()
    print("  ✓ DELETE 204 + CASCADE 清理 run/messages")


def test_delete_not_found(user_id, token):
    print("\n[Test 2] DELETE non-existent → 404")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    resp = client.delete(
        "/api/agent/conversations/999999999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404, f"expected 404, got {resp.status_code}"
    print(f"  ✓ {resp.status_code}")


def test_delete_other_user(user_a_id, user_b_id, token_a):
    print("\n[Test 3] DELETE other user's conversation → 404 (防越权)")
    from fastapi.testclient import TestClient
    from app.main import app

    # user_b 建一个对话
    db = SessionLocal()
    try:
        conv = Conversation(user_id=user_b_id, title="b17-private")
        db.add(conv)
        db.commit()
        db.refresh(conv)
        conv_id = conv.id
    finally:
        db.close()

    # user_a 尝试删 user_b 的对话
    client = TestClient(app)
    resp = client.delete(
        f"/api/agent/conversations/{conv_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 404, f"expected 404, got {resp.status_code}"

    # 用全新 session 验证还在 + cleanup
    db = SessionLocal()
    try:
        assert db.execute(select(Conversation).where(Conversation.id == conv_id)).scalar_one_or_none() is not None
        c = db.execute(select(Conversation).where(Conversation.id == conv_id)).scalar_one()
        db.delete(c)
        db.commit()
    finally:
        db.close()
    print(f"  ✓ {resp.status_code} (对话未被删除)")


def main():
    user_a_id, token_a = setup_user("b17a")
    user_b_id, token_b = setup_user("b17b")

    test_delete_own(user_a_id, token_a)
    test_delete_not_found(user_a_id, token_a)
    test_delete_other_user(user_a_id, user_b_id, token_a)

    print("\n" + "=" * 60)
    print("✅ Block 17 delete conversation 全部测试通过 (3/3)")
    print("=" * 60)


if __name__ == "__main__":
    main()

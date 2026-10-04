"""Block 8 手动验证脚本

Test A: Basic chat (无 tools) - 验证 LLM 通信
Test B: Tool calling - 验证 12 个 tool schema 都被 DeepSeek 接受, 且触发 tool_call

运行: uv run python -m scripts.test_llm_block8
"""
import asyncio
import json
import sys

from app.core.llm_client import get_llm_client, close as llm_close
from app.services.agent.tool_schemas import ALL_TOOL_SCHEMAS, TOOL_NAMES
from app.services.agent.prompts import SYSTEM_PROMPT


async def test_a_basic_chat(client) -> None:
    """Test A: 无 tools 的基础聊天"""
    print("=" * 60)
    print("Test A: Basic chat (无 tools)")
    print("=" * 60)
    try:
        resp = await client.chat(
            messages=[
                {"role": "system", "content": "用一句话介绍自己, 30 字以内。"},
                {"role": "user", "content": "你是谁？"},
            ],
            max_tokens=100,
        )
    except Exception as e:
        print(f"❌ Test A 失败: {type(e).__name__}: {e}")
        return False

    msg = resp["choices"][0]["message"]
    content = (msg.get("content") or "").strip()
    print(f"  Model: {resp.get('model')}")
    print(f"  Reply: {content}")
    if not content:
        print("❌ Test A 失败: LLM 未返回内容")
        return False
    print("✅ Test A 通过\n")
    return True


async def test_b_tool_calling(client) -> None:
    """Test B: 带 tools 的 tool calling"""
    print("=" * 60)
    print(f"Test B: Tool calling (共 {len(ALL_TOOL_SCHEMAS)} 个 tool schemas)")
    print("=" * 60)
    print(f"  Tool names: {TOOL_NAMES}")
    try:
        resp = await client.chat(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "东京有便宜的公寓吗？帮我找几个。"},
            ],
            tools=ALL_TOOL_SCHEMAS,
            max_tokens=300,
        )
    except Exception as e:
        print(f"❌ Test B 失败: {type(e).__name__}: {e}")
        return False

    msg = resp["choices"][0]["message"]
    print(f"\n  finish_reason: {resp["choices"][0].get("finish_reason")}")
    print(f"  content: {(msg.get("content") or "")[:200]}...")
    print(f"  tool_calls: {len(msg.get("tool_calls") or [])} 个")

    tool_calls = msg.get("tool_calls") or []
    if not tool_calls:
        print("❌ Test B 失败: LLM 没返回 tool_calls (期望调用 search_listings)")
        return False

    tc = tool_calls[0]
    name = tc["function"]["name"]
    args_str = tc["function"]["arguments"]
    try:
        args = json.loads(args_str)
    except json.JSONDecodeError:
        print(f"❌ Test B 失败: arguments 不是合法 JSON: {args_str}")
        return False

    print(f"  调用的 tool: {name}")
    print(f"  arguments: {json.dumps(args, ensure_ascii=False)}")

    if name != "search_listings":
        print(f"⚠️  Test B 警告: LLM 选了 {name}, 期望 search_listings")
    if "city" not in args or args["city"].lower() != "tokyo":
        print(f"⚠️  Test B 警告: city 期望 Tokyo, 实际 {args.get("city")}")

    print("\n✅ Test B 通过 (LLM 正确触发 tool calling)")
    return True


async def main() -> int:
    print("🚀 Block 8 验证开始\n")
    client = get_llm_client()
    if not client.api_key:
        print("❌ DEEPSEEK_API_KEY 未配置, 请在 backend/.env 设置后重试")
        return 1

    results = []
    results.append(await test_a_basic_chat(client))
    results.append(await test_b_tool_calling(client))

    await llm_close()

    passed = sum(results)
    total = len(results)
    print("=" * 60)
    print(f"📊 结果: {passed}/{total} 通过")
    print("=" * 60)
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

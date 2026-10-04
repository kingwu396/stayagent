"""DeepSeek API 客户端 (兼容 OpenAI Chat Completions 协议)

设计要点:
1. 模块级单例 + httpx.AsyncClient 连接复用 (lifespan 管理)
2. 仅实现非流式 chat (Block 8 范围), 流式留 Block 10 SSE
3. API key 未填也能构造, 延迟到第一次 chat() 才报错 (启动友好)
4. 不引 LangChain / openai SDK, 手写 60 行可控代码 (charter §3 + 用户偏好)
"""
import logging
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class DeepSeekClient:
    """DeepSeek API 客户端 (兼容 OpenAI Chat Completions)"""

    DEFAULT_BASE_URL = "https://api.deepseek.com"
    DEFAULT_MODEL = "deepseek-chat"
    DEFAULT_TEMPERATURE = 0.7
    DEFAULT_MAX_TOKENS = 2048
    CHAT_COMPLETIONS_PATH = "/v1/chat/completions"
    REQUEST_TIMEOUT = 60.0      # DeepSeek 偶尔慢, 给足时间
    CONNECT_TIMEOUT = 10.0

    def __init__(
        self,
        api_key: str = "",
        base_url: str = DEFAULT_BASE_URL,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        """懒创建 httpx 客户端 (header 中含 API key)"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                timeout=httpx.Timeout(
                    self.REQUEST_TIMEOUT,
                    connect=self.CONNECT_TIMEOUT,
                ),
            )
            logger.info("✅ DeepSeek HTTP 客户端已创建 (base_url=%s)", self.base_url)
        return self._client

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        model: str = DEFAULT_MODEL,
        temperature: float = DEFAULT_TEMPERATURE,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> dict[str, Any]:
        """
        非流式 chat. 返回 OpenAI 格式 response dict.

        Args:
            messages: OpenAI 格式消息列表 [{"role": ..., "content": ...}, ...]
            tools: OpenAI Function Calling 格式 tool schemas (None = 纯聊天)
            model: 模型名, 默认 deepseek-chat
            temperature: 0.0-2.0
            max_tokens: 最大输出 tokens

        Returns:
            OpenAI 格式 response dict (含 choices, usage 等)

        Raises:
            RuntimeError: API key 未配置
            httpx.HTTPStatusError: HTTP 错误 (4xx/5xx)
        """
        if not self.api_key:
            raise RuntimeError(
                "DEEPSEEK_API_KEY 未配置, 请在 backend/.env 中设置。"
                "获取: https://platform.deepseek.com/api_keys"
            )

        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"

        client = self._get_client()
        resp = await client.post(self.CHAT_COMPLETIONS_PATH, json=body)
        resp.raise_for_status()
        return resp.json()

    async def aclose(self) -> None:
        """关闭底层 httpx 客户端 (lifespan 关闭时调用)"""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("✅ DeepSeek HTTP 客户端已关闭")


# ============ 模块级单例 (与 redis_client.py 风格一致) ============

_client: Optional[DeepSeekClient] = None


def get_llm_client() -> DeepSeekClient:
    """获取 LLM 客户端单例 (lazy 构造)"""
    global _client
    if _client is None:
        _client = DeepSeekClient(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url or DeepSeekClient.DEFAULT_BASE_URL,
        )
    return _client


async def connect() -> None:
    """
    lifespan 启动时调用: 预热 HTTP 客户端.
    若 DEEPSEEK_API_KEY 已配置, 启动时就建连 (延迟错误检测到启动期);
    若未配置, 静默跳过 (延迟错误检测到第一次 chat() 调用).
    """
    client = get_llm_client()
    if client.api_key:
        client._get_client()
        logger.info("✅ DeepSeek 客户端预热完成 (API key 已配置)")
    else:
        logger.warning(
            "⚠️  DEEPSEEK_API_KEY 未配置, chat() 调用时会报错。"
            "请在 backend/.env 设置 DEEPSEEK_API_KEY。"
        )


async def close() -> None:
    """
    lifespan 关闭时调用. 跨 loop 情况 (测试场景) 自动跳过 aclose, 只 reset 单例.
    """
    global _client
    if _client is None:
        return
    try:
        await _client.aclose()
    except RuntimeError as e:
        if "closed" in str(e).lower():
            logger.warning("llm_client.close() 跨 loop 调用, 跳过 aclose (reset 单例)")
        else:
            raise
    finally:
        _client = None


# ============ 测试辅助 ============

def reset() -> None:
    """
    强制清空单例, 下次 get_llm_client() 会创建新 client.
    主要用于测试场景: 每次 asyncio.run() 切换 event loop 后调用,
    避免 httpx.AsyncClient 在旧 loop 上崩溃.
    生产代码不应调用此函数.
    """
    global _client
    _client = None

"""tenacity 重试装饰器封装 (A10 加分项)

只包 LLM 调用层 (DeepSeek API 偶发 5xx / 超时).
Tool 调用自身的错误 (如 wishlist 重名) 走 ToolError 路径, 不重试.
"""
import logging
import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logger = logging.getLogger(__name__)


# 触发重试的异常类型
RETRYABLE_EXCEPTIONS = (
    httpx.HTTPStatusError,   # 5xx (DeepSeek 服务端)
    httpx.ConnectError,      # DNS / 网络
    httpx.ReadTimeout,       # 60s 读超时
    httpx.RemoteProtocolError,
    ConnectionError,
    TimeoutError,
)

retry_on_llm_error = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
"""LLM 调用重试装饰器: 3 次, 指数退避 2-10s, 触发后 reraise 让 orchestrator 捕获"""

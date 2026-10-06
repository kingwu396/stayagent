"""Embedding 单例 (sentence-transformers all-MiniLM-L6-v2)

设计:
- 模块级 _model 变量, 第一次调 embed() 时才 load (懒加载)
- lifespan 启动时调 warmup() 跑一次, 避免首查延迟
- 模型自动从 HuggingFace 下载到 ~/.cache/huggingface/
- 输出 384 维向量, 适合 30 条知识库的语义检索

注意:
- HF_ENDPOINT 环境变量已配置为 https://hf-mirror.com (国内镜像)
- 首次启动需要联网下载模型 (~80MB), 后续启动从本地缓存加载 (< 1s)
"""
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# 模型选择常量 (集中在这里方便切换)
MODEL_NAME = os.getenv("ST_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 输出维度


_model: Optional["SentenceTransformer"] = None  # noqa: F821
_load_error: Optional[Exception] = None


class EmbeddingModel:
    """轻包装, 让调用方不直接接触 sentence_transformers"""

    def __init__(self):
        from sentence_transformers import SentenceTransformer
        global _model
        if _model is None:
            logger.info("Loading embedding model %s ...", MODEL_NAME)
            _model = SentenceTransformer(MODEL_NAME)
            logger.info("✅ Embedding model loaded (dim=%d)", EMBEDDING_DIM)
        self._m = _model

    def embed(self, text: str) -> list[float]:
        """单条文本 → 384 维向量"""
        v = self._m.encode(text, normalize_embeddings=True, convert_to_numpy=True)
        return v.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """批量文本 → 多个向量 (一次 forward pass, 比逐条 embed 快)"""
        arr = self._m.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
        return arr.tolist()


def get_embedding_model() -> EmbeddingModel:
    """获取 embedding 模型 (懒加载, 首次调用会 load + 下载)"""
    global _load_error
    if _model is None and _load_error is None:
        try:
            return EmbeddingModel()
        except Exception as e:
            _load_error = e
            logger.exception("Failed to load embedding model")
            raise
    if _load_error:
        raise RuntimeError(f"Embedding model 加载失败: {_load_error}")
    return EmbeddingModel()


def embed_text(text: str) -> list[float]:
    """便捷函数: 直接拿单条向量"""
    return get_embedding_model().embed(text)


async def warmup() -> None:
    """lifespan 启动时调一次, 把模型 load 进来 + 跑一次 dummy embed"""
    try:
        v = embed_text("warmup")
        logger.info("Embedding warmup OK (dim=%d)", len(v))
    except Exception as e:
        logger.warning("Embedding warmup failed (will lazy-load on first use): %s", e)

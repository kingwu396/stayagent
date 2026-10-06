"""RAG 检索 (Block 12)

策略:
- 对 query 调 embed_text() 拿向量
- 全量扫库 (规模 30 条, 不需要向量 DB), 对每条 tip 的 embedding 算 cosine similarity
- 按 score 降序取 top_k
- 可选按 category / destination 缩小范围

返回: list of (TravelTip, score), 调用方取 TravelTip + 拿到对应 score
"""
import logging
from typing import Optional

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TravelTip
from app.services.rag.embedding import embed_text

logger = logging.getLogger(__name__)


def _cosine_sim(a: list[float], b: list[float]) -> float:
    """余弦相似度 (向量已 normalize, 直接点积即可)"""
    if not a or not b:
        return 0.0
    arr_a = np.asarray(a, dtype=np.float32)
    arr_b = np.asarray(b, dtype=np.float32)
    return float(np.dot(arr_a, arr_b))


def retrieve_tips(
    db: Session,
    query: str,
    top_k: int = 3,
    category: Optional[str] = None,
    destination: Optional[str] = None,
) -> list[dict]:
    """
    从 travel_tips 库检索 top_k 个最相关的贴士.

    Args:
        db: SQLAlchemy session
        query: 用户问题/关键词
        top_k: 返回多少条 (默认 3)
        category: 可选过滤 (visa/transport/food/safety/culture)
        destination: 可选过滤 (如 Tokyo)

    Returns:
        list of dicts, 每个含 {id, title, content, category, destination, score}
        按 score 降序
    """
    if not query or not query.strip():
        return []

    # 1. 候选库 (带可空 embedding 过滤)
    stmt = select(TravelTip)
    if category:
        stmt = stmt.where(TravelTip.category == category)
    if destination:
        stmt = stmt.where(TravelTip.destination == destination)
    stmt = stmt.where(TravelTip.embedding.isnot(None))

    candidates = db.execute(stmt).scalars().all()
    if not candidates:
        logger.info("RAG: no candidates for query='%s' (category=%s)", query[:50], category)
        return []

    # 2. query embedding
    try:
        q_vec = embed_text(query)
    except Exception as e:
        logger.exception("RAG embed failed")
        return [{"error": f"embedding 模型加载失败: {e}", "code": "RAG_UNAVAILABLE"}]

    # 3. 全量算 cosine sim
    scored: list[tuple[TravelTip, float]] = []
    for tip in candidates:
        if not tip.embedding:
            continue
        sim = _cosine_sim(q_vec, tip.embedding)
        scored.append((tip, sim))

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:max(1, top_k)]

    logger.info(
        "RAG: query='%s' -> %d candidates, top %d (best score=%.3f)",
        query[:50], len(candidates), len(top), top[0][1] if top else 0.0,
    )

    return [
        {
            "id": t.id,
            "title": t.title,
            "content": t.content,
            "category": t.category,
            "destination": t.destination,
            "score": round(s, 4),
        }
        for t, s in top
    ]

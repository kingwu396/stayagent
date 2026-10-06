"""RAG 服务 (Block 12)

手写 RAG, 不引 LangChain / LlamaIndex:
- embedding: sentence-transformers 本地模型
- retriever: 余弦相似度 + 简单排序
- travel_tips 表 + 30 条 seed 知识库

规模小 (库 30 条, query 也少) → 全量 embed + 排序足够, 不用向量 DB.
"""
from app.services.rag.embedding import EmbeddingModel, get_embedding_model, embed_text, warmup
from app.services.rag.retriever import retrieve_tips

__all__ = ["EmbeddingModel", "get_embedding_model", "embed_text", "warmup", "retrieve_tips"]

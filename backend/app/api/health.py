from fastapi import APIRouter

from app.db.session import check_db_connection

router = APIRouter()


@router.get("/health")
async def health():
    """Block 1 专用：报告后端 + 数据库状态"""
    db_ok = check_db_connection()
    return {
        "status": "ok" if db_ok else "degraded",
        "backend": "ok",
        "database": "connected" if db_ok else "disconnected",
    }

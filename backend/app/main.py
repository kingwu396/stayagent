from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.db.session import engine
from app.db.base import Base

# 导入所有模型（让 Base.metadata 找到它们）
import app.models  # noqa: F401

app = FastAPI(
    title="StayAgent API",
    version="0.2.0",
    description="AI Travel Agent 后端 API",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """启动时自动创建所有表（开发期用，后续切 Alembic）"""
    Base.metadata.create_all(bind=engine)


# 路由注册
app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])


@app.get("/")
async def root():
    return {
        "message": "StayAgent API",
        "version": "0.2.0",
        "docs": "/docs",
    }

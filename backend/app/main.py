from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.db.session import engine
from app.db.base import Base
from app.core import redis_client

import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动
    Base.metadata.create_all(bind=engine)
    await redis_client.connect()
    yield
    # 关闭
    await redis_client.close()


app = FastAPI(
    title="StayAgent API",
    version="0.3.0",
    description="AI Travel Agent 后端 API（双 Token + Redis 黑名单）",
    lifespan=lifespan,
)

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

app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])


@app.get("/")
async def root():
    return {
        "message": "StayAgent API",
        "version": "0.3.0",
        "docs": "/docs",
        "auth": "Access Token (header) + Refresh Token (HttpOnly cookie)",
    }

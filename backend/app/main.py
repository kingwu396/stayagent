from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.listings import router as listings_router
from app.api.wishlists import router as wishlists_router
from app.api.bookings import router as bookings_router
from app.api.agent import router as agent_router
from app.db.session import engine
from app.db.base import Base
from app.core import redis_client, llm_client

import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动
    Base.metadata.create_all(bind=engine)
    await redis_client.connect()
    yield
    # 关闭
    await llm_client.close()
    await redis_client.close()


app = FastAPI(
    title="StayAgent API",
    version="0.4.0",
    description="AI Travel Agent 后端 API（双 Token + Redis 黑名单 + Agent 工具调用循环）",
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
app.include_router(listings_router, prefix="/api/listings", tags=["listings"])
app.include_router(wishlists_router, prefix="/api/wishlists", tags=["wishlists"])
app.include_router(bookings_router, prefix="/api/bookings", tags=["bookings"])
app.include_router(agent_router, prefix="/api/agent", tags=["agent"])


@app.get("/")
async def root():
    return {
        "message": "StayAgent API",
        "version": "0.3.0",
        "docs": "/docs",
        "auth": "Access Token (header) + Refresh Token (HttpOnly cookie)",
    }

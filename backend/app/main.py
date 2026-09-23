from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router

app = FastAPI(
    title="StayAgent API",
    version="0.1.0",
    description="AI Travel Agent 后端 API",
)

# CORS: 让 Vite (5173) 能访问 FastAPI (8000)
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

# 路由注册
app.include_router(health_router, prefix="/api", tags=["health"])


@app.get("/")
async def root():
    return {
        "message": "StayAgent API",
        "version": "0.1.0",
        "docs": "/docs",
    }

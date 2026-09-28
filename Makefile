.PHONY: help install dev backend frontend redis clean

help:
	@echo "StayAgent 开发命令:"
	@echo "  make install  - 安装所有依赖（首次）"
	@echo "  make redis    - 启动 Redis (brew services)"
	@echo "  make dev      - 同时启动前后端（推荐）"
	@echo "  make backend  - 只启动后端"
	@echo "  make frontend - 只启动前端"
	@echo "  make clean    - 清理临时文件"

install:
	@echo "📦 安装后端依赖（uv）..."
	cd backend && uv sync
	@echo "📦 安装前端依赖（pnpm）..."
	cd frontend && pnpm install
	@echo "✅ 安装完成"

redis:
	@echo "🔴 启动 Redis..."
	@redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes --port 6379 --dir /tmp
	@redis-cli ping

backend:
	@echo "🚀 启动 FastAPI (http://127.0.0.1:8000)"
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:
	@echo "🎨 启动 Vite (http://localhost:5173)"
	cd frontend && pnpm dev

dev:
	@echo "🚀 同时启动前后端（Ctrl+C 关闭）"
	@make -j 2 backend frontend

clean:
	rm -rf backend/.venv frontend/node_modules backend/**/__pycache__ frontend/dist
	@echo "✅ 清理完成"

.PHONY: help install dev backend frontend redis seed seed-tips localize-images mcp test check build clean

help:
	@echo "StayAgent 开发命令:"
	@echo "  make install   - 安装所有依赖（首次）"
	@echo "  make dev       - 同时启动前后端（推荐）"
	@echo "  make backend   - 只启动后端"
	@echo "  make frontend  - 只启动前端"
	@echo "  make redis     - 启动 Redis (本机 redis-server, 已在跑则跳过)"
	@echo "  make seed      - 填充 1000 条房源演示数据 + 图片本地化下载 (幂等, 含 3 个演示房东)"
	@echo "  make seed-tips - 填充 30 条 RAG 旅游知识库"
	@echo "  make localize-images - 只跑图片本地化 (make seed 已内含; 服务器单独续传/rsync 后用)"
	@echo "  make mcp       - 前台启动 MCP stdio server (接入 Claude 见 docs/mcp.md)"
	@echo "  make test      - 跑后端全部验证脚本 (需先 seed + MySQL/Redis)"
	@echo "  make check     - 前端类型检查 + 生产构建"
	@echo "  make build     - 只构建前端产物 (dist/)"
	@echo "  make clean     - 清理临时文件"
	@echo ""
	@echo "生产部署见 docs/DEPLOY.md (systemd + nginx, 不走 make)"

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
	@echo "🚀 同时启动前后端（Ctrl+C 一起关闭）"
	@make -j 2 backend frontend

seed:
	@echo "🌱 填充房源演示数据 (50 城 × 20, 增量幂等)..."
	cd backend && uv run python -m scripts.seed_listings
	@echo "🖼  图片本地化 (picsum 下载到 uploads/, 幂等, 已下载秒过)..."
	cd backend && uv run python -m scripts.localize_images

seed-tips:
	@echo "🌱 填充 RAG 旅游知识库 (5 类 × 6 条)..."
	cd backend && uv run python -m scripts.seed_travel_tips

localize-images:
	@echo "🖼  picsum 图片本地化 (下载 ~2900 张到 backend/uploads/images/, 约 2-3 分钟)..."
	cd backend && uv run python -m scripts.localize_images

mcp:
	@echo "🔌 启动 MCP stdio server (Claude Code/Desktop 接入见 docs/mcp.md)..."
	cd backend && uv run python -m app.mcp

test:
	@echo "🧪 跑后端验证脚本..."
	cd backend && uv run python -m scripts.test_host_block27
	cd backend && uv run python -m scripts.test_host_dashboard
	cd backend && uv run python -m scripts.test_agent_block11_5
	cd backend && uv run python -m scripts.test_agent_block12
	cd backend && uv run python -m scripts.test_agent_block35

check:
	@echo "🔎 前端类型检查..."
	cd frontend && pnpm exec tsc --noEmit
	@echo "🔎 前端生产构建..."
	cd frontend && pnpm run build

build:
	cd frontend && pnpm run build

# 注意: __pycache__ 用 find 递归清理 (shell 默认不开 globstar, ** 不生效)
clean:
	rm -rf backend/.venv frontend/node_modules frontend/dist
	find backend -name "__pycache__" -type d -prune -exec rm -rf {} +
	@echo "✅ 清理完成"

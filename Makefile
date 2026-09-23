.PHONY: help install install-backend install-frontend dev backend frontend clean

# 每条 shell 行失败立刻停（避免 npm 挂了还继续跑 pip）
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

help:
	@echo "StayAgent 开发命令:"
	@echo "  make install           - 安装所有依赖 (首次)"
	@echo "  make install-backend   - 只装后端"
	@echo "  make install-frontend  - 只装前端"
	@echo "  make dev               - 同时启动前后端 (Ctrl+C 干净退出)"
	@echo "  make backend           - 只启动后端 (FastAPI :8000)"
	@echo "  make frontend          - 只启动前端 (Vite :5173)"
	@echo "  make clean             - 清理临时文件"

install: install-backend install-frontend

install-backend:
	@echo "📦 装后端依赖..."
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

install-frontend:
	@echo "📦 装前端依赖..."
	cd frontend && npm install

backend:
	@echo "🚀 启动 FastAPI (http://127.0.0.1:8000)"
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	@echo "🎨 启动 Vite (http://localhost:5173)"
	cd frontend && npm run dev

# 套一层 bash 是为了让 Ctrl+C 把 -j 2 起的 uvicorn / vite 子进程也带走
dev:
	@bash -c 'trap "kill 0" INT TERM EXIT; make -j 2 backend frontend'

clean:
	@echo "🧹 清理临时文件..."
	rm -rf backend/.venv frontend/node_modules frontend/dist
	find backend -type d -name __pycache__ -prune -exec rm -rf {} +
	@echo "✅ 清理完成"

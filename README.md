# StayAgent

> Airbnb 风格住宿平台 × AI Travel Agent
> 立项文档见 [docs/project-charter.md](./docs/project-charter.md)

## 🚀 快速开始

### 首次安装

```bash
make install
```

会做两件事：
1. `uv sync` 创建 `.venv` 并安装后端依赖（**超快，2 秒搞定**）
2. `pnpm install` 安装前端依赖

### 配置环境变量

编辑 `backend/.env`，填入你的 MySQL 密码（其他字段已预填）。

### 启动开发环境

```bash
make dev
```

会同时启动：
- 🎨 前端: http://localhost:5173
- 🚀 后端: http://127.0.0.1:8000
- 📚 API 文档: http://127.0.0.1:8000/docs

按 `Ctrl+C` 关闭。

## 📦 包管理

| 端 | 工具 | 锁文件 | 说明 |
|---|---|---|---|
| 后端 | **uv** | `backend/uv.lock`（提交）| 超快 Rust 写的 pip 替代 |
| 前端 | **pnpm** | `frontend/pnpm-lock.yaml`（提交）| 速度快、磁盘省 |

### 为什么用 uv？

- 🚀 **快 10-100 倍**（Rust 写的，比 pip 快很多）
- 🔒 **自动管理虚拟环境**（不用手动 `python -m venv`）
- 📦 **统一锁文件**（uv.lock 跨机器可复现）
- 🐍 **自动下载 Python 版本**（指定 `.python-version` 即可）

常用 uv 命令：

```bash
# 安装所有依赖
uv sync

# 添加新依赖
uv add fastapi

# 移除依赖
uv remove fastapi

# 运行命令（自动激活 venv）
uv run python script.py
uv run uvicorn app.main:app

# 更新依赖到最新版本
uv lock --upgrade
```

## 📁 项目结构

```
stayagent/
├── backend/          # FastAPI 后端（uv）
├── frontend/         # React 前端（pnpm）
├── docs/             # 立项文档
└── Makefile          # 一键启动
```

## 📍 当前进度

- [x] **Block 1**: 项目骨架 + Hello StayAgent ✅
- [ ] Block 2: 用户系统
- [ ] Block 3-14: 业务 + Agent

详见 [docs/project-charter.md](./docs/project-charter.md)

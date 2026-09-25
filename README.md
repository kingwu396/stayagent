# StayAgent

> Airbnb 风格住宿平台 × AI Travel Agent
> 立项文档见 [docs/project-charter.md](./docs/project-charter.md)

## 🚀 快速开始

### 首次安装

```bash
make install
```

会做两件事：
1. 创建 Python 虚拟环境 `.venv` 并安装后端依赖
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

| 端 | 工具 | 说明 |
|---|---|---|
| 后端 | pip + venv | 锁文件：`backend/.venv/`（不提交）|
| 前端 | **pnpm** | 锁文件：`frontend/pnpm-lock.yaml`（**应该提交**）|

**为什么用 pnpm？**
- 🚀 安装速度快 2-3 倍
- 💾 磁盘占用少（共享 store）
- 🔒 严格的依赖隔离
- 📦 默认 workspace 友好

如果之后切换回 npm，需要：
1. 删除 `frontend/node_modules` 和 `frontend/pnpm-lock.yaml`
2. `cd frontend && npm install`
3. 重新提交 `package-lock.json`

## 📁 项目结构

```
stayagent/
├── backend/          # FastAPI 后端
├── frontend/         # React 前端（pnpm）
├── docs/             # 立项文档
└── Makefile          # 一键启动
```

## 📍 当前进度

- [x] **Block 1**: 项目骨架 + Hello StayAgent ✅
- [ ] Block 2: 用户系统
- [ ] Block 3-14: 业务 + Agent

详见 [docs/project-charter.md](./docs/project-charter.md)

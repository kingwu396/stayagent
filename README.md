# StayAgent

> **Airbnb 风格住宿平台 × AI Travel Agent**
> Agent 能真正帮你订房 — 不只是聊天，能调工具、改数据、影响实际业务流程

立项文档见 `docs/project-charter.md`（本地参考用，不上传 git）。

---

## 📍 项目板块

> 完整迭代日志见 [docs/CHANGELOG.md](docs/CHANGELOG.md)

| Block | 内容 | 加分项覆盖 |
|---|---|---|
| 1 | 项目骨架 + Hello StayAgent | F1, B1, B2 |
| 2 | 用户系统 | B4, F3 |
| 3 | Listing seed 数据 | B8 |
| 4-7 | 首页 / 搜索 / 详情 / 心愿单 / Trips | F2, F4, F6 |
| 8 | LLM 客户端 + 12 Tool Schema | A1 |
| 9 | Agent Orchestrator + 7 Tool | A10 |
| 10 | AgentPanel UI + SSE 流式 | A2, F7 |
| 11 | AgentPanel 重构 (浮动+全屏+历史) | A4, A5, A8 |
| 11.5 | create_booking (HITL) + 拖动 + 全屏微调 | A9 |
| **12** | **Tools 9-12 + RAG (Travel Tips) + PDF 上传** | **A3, A6, A7** |
| **13** | **F5 动画 + F8 Generative UI + 演示文档** | **F5, F8** |
| 14 | 房源扩容 1000 条 + DB 端过滤/分页 | B8 |
| 15 | 房东后台 (Host Dashboard) + view 计数 | F2 |
| 16 | 房源详情页 Airbnb 风重做 (预订卡/评价/地图) | F2 |
| 17 | Agent 流式打字机 + content_discard 修复 | A2 |
| 18 | 搜索浮层按 panel 对齐 | F2 |
| 19 | 搜索条统一 + Hero↔顶栏 layoutId morph | F5 |
| 19.5 | PDF 结构化抽取升级: LLM 优先 + regex 兜底 | A6 |

---

## 🏛️ 架构总览

```mermaid
graph LR
  User([用户]) --> FE[React Frontend<br/>Vite + TS + Tailwind]
  User -->|PDF| FE

  FE -->|HTTPS + JWT| BE[FastAPI Backend]
  FE -->|SSE Stream| BE

  BE --> ORM[SQLAlchemy 2.0]
  ORM --> DB[(MySQL)]

  BE --> Redis[(Redis<br/>refresh 白名单 + access 黑名单)]
  BE --> LLM[DeepSeek Chat API]
  BE --> Embed[Sentence-Transformers<br/>all-MiniLM-L6-v2]

  Embed --> RAG[RAG Retriever<br/>cosine similarity]

  subgraph Tools[Agent 工具 12 个]
      T1[search_listings]
      T2[get_listing_detail]
      T3[compare_listings]
      T4-7[心愿单 4 个]
      T8[create_booking<br/>HITL]
      T9[list_my_trips]
      T10-11[PDF tools]
      T12[search_travel_tips RAG]
    end

  BE --> Tools
  RAG --> Tools
```

---

## 🔄 Agent 调用流程

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant BE as Backend
  participant L as LLM (DeepSeek)
  participant DB

  U->>FE: 输入问题 + (可选) PDF
  FE->>BE: POST /api/agent/chat/stream
  BE->>DB: 写 user message
  BE->>L: 拼 messages (system + history + augmented)
  L-->>BE: tool_calls: [search_listings, ...]
  loop 直到 final 或 timeout
    BE->>DB: 写 AgentStep
    BE->>BE: 调 tool (查 DB 或 RAG)
    BE-->>FE: SSE: step_started/completed
  end
  L-->>BE: final content
  BE->>DB: 写 assistant message + AgentRun
  BE-->>FE: SSE: final + done
  FE-->>U: 渐入消息 + tool cards 展开
```

HITL 例外：`create_booking` 触发时返回 `status=pending_confirmation`，前端渲染 `AgentConfirmCard`，用户点确认后调 `/api/agent/runs/{id}/confirm`。

RAG 流程：`search_travel_tips(query)` → `embed(query)` → 全表 cosine similarity → top-3 tips → LLM 二次组织成中文回答。

---

## 🚀 快速开始

### 安装

```bash
make install            # uv sync + pnpm install
```

### 配置环境

```bash
cp backend/.env.example backend/.env          # 然后编辑填值
cp frontend/.env.example frontend/.env.local  # 前端无必填项
```

**后端环境变量**（`backend/.env`）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `MYSQL_USER` / `MYSQL_PASSWORD` | ✅ | MySQL 账号（本地默认 root） |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DB` | - | 默认 `127.0.0.1:3306` / `stayagent` |
| `DEEPSEEK_API_KEY` | ✅ | [platform.deepseek.com](https://platform.deepseek.com/api_keys) 申请 |
| `DEEPSEEK_BASE_URL` | - | 默认 `https://api.deepseek.com` |
| `JWT_SECRET` | ✅ | Token 签名密钥，生产环境务必换强随机值 |
| `REDIS_URL` | - | 默认 `redis://localhost:6379/0`（认证 token 黑白名单依赖） |
| `COOKIE_SECURE` | - | 生产 HTTPS 环境设 `true` |
| `HF_ENDPOINT` | - | 可选 `https://hf-mirror.com`，国内加速首次下载 RAG embedding 模型 |

> Redis 未启动时后端可软启动，但登录/认证相关 API 会 503 — 先 `make redis`。

前端开发期由 Vite proxy 把 `/api` 转发到 `http://127.0.0.1:8000`（见 `vite.config.ts`），无需配置后端地址。

### Seed 演示数据

```bash
make seed                                  # 100 条房源 (10 城 × 10 条)
uv run python -m scripts.seed_travel_tips  # 30 条 RAG 知识库 (5 类 × 6 条)
```

### 启动

```bash
make dev      # 同时启动前后端
```

- 🎨 前端：<http://localhost:5173>
- 🚀 后端：<http://127.0.0.1:8000>
- 📚 API 文档：<http://127.0.0.1:8000/docs>

---

## 🧪 验证

```bash
# 后端 unit tests
cd backend
uv run python -m scripts.test_agent_block11_5    # 5/5
uv run python -m scripts.test_agent_block12      # 10/10

# 前端 build
cd ../frontend
pnpm exec tsc --noEmit
pnpm run build
```

---

## 🎬 演示脚本

详见 **[docs/demo.md](docs/demo.md)** — 5 分钟答辩脚本。

---

## 🐛 开发踩坑记录（真实问题 → 解法）

完整日志见 [docs/CHANGELOG.md](docs/CHANGELOG.md)，逐条面试口径见 [docs/interview/tech-decisions.md](docs/interview/tech-decisions.md)。精选：

| # | 坑 | 解法 |
|---|---|---|
| 1 | npm/pip 装依赖慢、环境易污染 | 全量迁移 pnpm + uv，速度快 10-100× |
| 2 | AMap 瓦片灰屏连修 3 次（securityJsCode / WebGL / 真浏览器复现） | 第 3 次仍不稳定后果断换 Leaflet + OSM：功能等价、0 配置 |
| 3 | Tool schema 写 `file_path`、实现要 `plan_text`，LLM 按 schema 调 → TypeError | schema / 实现 / prompt 三处对齐，并加单测断言 properties |
| 4 | 流式输出时 LLM 先吐 preamble 再调工具，客套话混进聊天气泡 | 自定义 SSE 事件 `content_discard`：后端 buffer 与前端 content 同一事件清零 |
| 5 | amenities 筛选先分页后过滤，每页条数不稳定 | 改为全量候选 → Python 端 AND 过滤 → 再分页 |
| 6 | Redis 未启动后端直接起不来 | 软启动：连接失败仅告警，认证 API 降级 503 |
| 7 | PDF 结构化抽取 regex 只认固定写法（"带爸妈"=3 人抓不到） | 升级 LLM 结构化抽取优先 + regex 兜底，输出字段同构、无感降级 |

---

## 🔑 关键技术决策

| 决策 | 替代方案 | 为何选这个 |
|---|---|---|
| **uv** (Rust 写的 pip) | pip + venv | 快 10-100×，自动管虚拟环境 |
| **pnpm** | npm / yarn | 速度快、磁盘省、monorepo 友好 |
| **Sentence-Transformers** (本地 RAG) | 云 embedding API / LangChain | 0 成本、不引依赖、规模 30 条足够 |
| **DeepSeek** | OpenAI / Claude | 中文强、价格低、OpenAI 协议兼容 |
| **手写 ReAct** | LangChain / LlamaIndex | 透明可控，无黑盒 |
| **MySQL** + SQLAlchemy 2.0 | Postgres / MongoDB | 项目 ORM 基础 |
| **Redis 黑名单** | JWT-only | 即时撤销 access token，无需等过期 |
| **PDF inline 注入** | file_id 引用 | LLM 直接读，避免幻觉参数 |
| **PDF 抽取 LLM 优先 + regex 兜底** | 纯 regex | 自由文本（"带爸妈"=3 人 / 任意城市）也能结构化，LLM 失败自动降级 |

---

## 📦 项目结构

```
stayagent/
├── backend/
│   ├── app/
│   │   ├── api/         # HTTP 路由 (auth/listings/bookings/wishlists/agent/uploads)
│   │   ├── core/        # llm_client / redis_client / security
│   │   ├── db/          # SQLAlchemy Base + Session
│   │   ├── models/      # 9 张表
│   │   ├── schemas/     # Pydantic schemas
│   │   └── services/
│   │       ├── agent/   # orchestrator / tools / tool_schemas / prompts / retry
│   │       └── rag/      # Block 12: sentence-transformers + cosine
│   ├── scripts/         # seed_listings / seed_travel_tips / test_block_*
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/         # axios + uploads + agent
│   │   ├── components/  # 33+ 组件 + agent/ 子目录 (F8)
│   │   ├── views/       # 7 页面
│   │   ├── stores/      # auth / wishlist / agent / toast (zustand)
│   │   ├── hooks/ / lib/ / types/ / router/
│   │   └── index.css
│   └── tailwind.config.js
├── docs/
│   ├── CHANGELOG.md
│   ├── CONSTITUTION.md
│   ├── project-charter.md
│   ├── demo.md             # Block 13: 5 分钟演示脚本
│   ├── architecture.md     # Block 13: 架构详解
│   └── screenshots/        # Block 13: 截图占位
├── Makefile
└── README.md
```

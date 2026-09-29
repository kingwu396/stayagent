# 项目立项书：StayAgent — AI Travel Agent

> **副标题**：Airbnb 风格住宿平台 × AI Agent
> **决策日期**：2026-09-23
> **截止时间**：2026-10-14 23:59（约 3 周）
> **项目代号**：StayAgent
> **作者**：[你的名字]

---

## 1. 一句话定位

> **一个"AI Agent 能真正帮你订房"的旅游住宿平台。**

不是传统的"AI 聊天机器人 + 一个不相关的订房网站"，而是**Agent 能调工具、改数据、影响实际业务流程**的一体化产品。

---

## 2. MVP 范围（必做 + 加分项全清单）

### 🌟 必做（5 星权重）

| 模块 | 内容 |
|---|---|
| 首页 | Logo / 搜索区 / 推荐房源 / Footer |
| 搜索 + 列表 | 目的地 / 日期 / 人数 / 价格 / 类型，URL 同步 |
| 房源详情 | 图片 / 评分 / 房东 / 设施 / 价格拆解 |
| 用户系统 | 注册 / 登录 / JWT / 状态隔离 |
| 心愿单 | 创建 / 添加 / 删除 / 多对多关联 |
| Trips 订单 | 选择日期 → 计算价格 → 创建订单 → 列表展示 |
| 数据持久化 | MySQL，50~100 条房源数据 |
| **AI 智能搜索** | 自然语言 → 调 Tool → 返回真实房源 |
| **AI 推荐** | 根据需求推荐 / 比较 |
| **Agent 操作心愿单** | "帮我把 X 加到东京旅行心愿单" |
| **Agent 操作订单** | "帮我订一下 X" |
| **PDF 行程解析** | 上传旅行计划 PDF → 自动推荐房源 |

---

### 🎁 加分项（26 项全清单 + 跟踪表）

> **目标：26/26 全做，至少完成 24/26**（RAG 凑数 + 解释即可）

#### 🎨 前端加分项（8 项）

| # | 加分项 | 状态 | 落地位置 |
|---|---|---|---|
| F1 | TypeScript | ✅ 栈里就有 | 全部 TS |
| F2 | 高复用组件 | ✅ 写到即做 | ListingCard/PriceBreakdown/AgentStep 等 |
| F3 | 状态管理（Pinia）| ✅ 栈里就有 | stores/ |
| F4 | Optimistic Update | 🟢 Week 1 Day 5 | 心愿单添加/移除 |
| F5 | 页面动画 | 🟢 Week 3 Day 18 | Router 过渡 + 卡片入场 |
| F6 | 微交互（Loading/Skeleton/Empty/Error/Toast）| 🟢 Week 1 Day 4 | 全站 |
| F7 | Streaming UI | ✅ 核心就有 | AgentPanel SSE |
| F8 | Generative UI | 🟡 Week 3 Day 18 | Agent 返回结构化数据渲染卡片 |

#### ⚙️ 后端加分项（8 项）

| # | 加分项 | 状态 | 落地位置 |
|---|---|---|---|
| B1 | ORM | ✅ SQLAlchemy | models/ |
| B2 | 参数校验 | ✅ Pydantic v2 | schemas/ |
| B3 | 统一错误处理 | ✅ FastAPI exception handlers | core/exceptions.py |
| B4 | Session / JWT | ✅ 核心就有 | core/security.py |
| B5 | 权限控制 | ✅ user_id 过滤 | services/ |
| B6 | 数据库事务 | ✅ SQLAlchemy session | services/ |
| B7 | Service 层 | ✅ 架构就有 | services/ |
| B8 | 合理的数据表设计 | ✅ 立项就有 | 8 张表 |

#### 🤖 Agent 加分项（10 项）

| # | 加分项 | 状态 | 落地位置 |
|---|---|---|---|
| A1 | Tool Calling | ✅ 核心 | tools.py |
| A2 | Streaming | ✅ 核心（SSE）| orchestrator.py |
| A3 | 多轮对话 | ✅ 核心 | Conversation + Message 表 |
| A4 | Agent 执行状态 | ✅ 核心 | agent_runs 表 |
| A5 | Tool 执行过程展示 | ✅ 核心 | agent_steps 表 + 前端 |
| A6 | PDF 解析 | ✅ 核心 | pdfplumber + Tool 9 |
| **A7** | **RAG** | 🟡 **Week 3 Day 17** | **新增 Tool 10 + 知识库** |
| A8 | Memory | ✅ 核心 | Conversation 持久化 |
| A9 | Human-in-the-loop | 🟢 Week 2 Day 11 | create_booking 前置确认 |
| A10 | Tool 错误处理/重试 | 🟢 Week 2 Day 10 | tenacity + 结构化错误 |

**预期最终**：26/26 全打勾（含 RAG 凑数版）

---

## 3. 技术栈（终版决策）

### 前端
| 技术 | 版本 | 用途 |
|---|---|---|
| **Vue 3** | 3.4+ | 主框架 |
| **Vite** | 5.x | 构建 |
| **TypeScript** | 5.x | 类型 |
| **Pinia** | 2.x | 状态管理 |
| **Vue Router** | 4.x | 路由 |
| **Element Plus** | latest | UI 组件库 |
| **TailwindCSS** | 3.x | 样式 |
| **Axios** | 1.x | HTTP |
| **marked** | 12.x | Markdown 渲染 |
| **dayjs** | 1.x | 日期 |

### 后端
| 技术 | 版本 | 用途 |
|---|---|---|
| **Python** | 3.11 | 语言 |
| **FastAPI** | 0.110+ | Web 框架 |
| **SQLAlchemy** | 2.0 | ORM |
| **Alembic** | 1.x | 迁移 |
| **Pydantic** | v2 | 校验 |
| **python-jose** | 3.x | JWT |
| **passlib[bcrypt]** | 1.x | 密码 |
| **python-multipart** | latest | 文件上传 |
| **uvicorn** | 0.27+ | ASGI 服务器 |
| **pdfplumber** | 0.10+ | PDF 文本提取 |
| **httpx** | 0.27+ | LLM HTTP 调用 |
| **tenacity** | 8.x | Tool 重试 |

### AI / LLM
| 技术 | 用途 |
|---|---|
| **DeepSeek API** | 主 LLM（兼容 OpenAI SDK）|
| **OpenAI Python SDK** | 调用 DeepSeek |
| **手写 Tool Calling** | 不引 LangChain（透明、可控）|
| **DeepSeek Embeddings API** | RAG 用（可选）|

### 数据库
| 技术 | 版本 | 用途 |
|---|---|---|
| **MySQL** | 8.0+ | 主数据库 |
| 本地文件 | - | 图片、PDF 临时存储 |

### DevOps
| 技术 | 用途 |
|---|---|
| **Docker Compose**（可选）| 一键启动 |
| **Pyenv / venv** | Python 环境隔离 |
| **pnpm** | 前端包管理 |
| **ruff** | Python lint |
| **ESLint + Prettier** | 前端 lint |

---

## 4. 系统架构

### 4.1 整体架构图

```
┌─────────────────────────────────────────────────┐
│  浏览器 (Vue 3 SPA)                              │
│  ├─ 页面路由 (Vue Router)                         │
│  ├─ Pinia Store (用户 / 心愿单 / Trips)            │
│  ├─ Axios (HTTP)                                 │
│  └─ AgentPanel 组件 (侧边栏悬浮，SSE 流式)          │
└─────────────────────────────────────────────────┘
                    │ HTTPS / JSON / SSE
                    ↓
┌─────────────────────────────────────────────────┐
│  FastAPI 后端                                     │
│  ├─ /api/auth/*        用户认证                   │
│  ├─ /api/listings/*     房源 CRUD                 │
│  ├─ /api/wishlists/*    心愿单                     │
│  ├─ /api/bookings/*     订单                       │
│  ├─ /api/agent/chat     Agent 对话（SSE 流式）     │
│  └─ /api/agent/upload  PDF / RAG 知识库上传         │
└─────────────────────────────────────────────────┘
        │           │            │
        ↓           ↓            ↓
┌──────────┐  ┌──────────┐  ┌──────────────────┐
│  MySQL   │  │ 本地存储  │  │ DeepSeek API     │
│ (9 张表) │  │ /uploads │  │ (Chat + Embedding) │
└──────────┘  └──────────┘  └──────────────────┘
```

---

## 5. 数据库设计（核心 9 张表）

新增 `travel_tips` 表用于 RAG（其他 8 张不变）。

```sql
-- RAG 知识库
CREATE TABLE travel_tips (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    title        VARCHAR(255) NOT NULL,
    content      TEXT NOT NULL,
    category     VARCHAR(50),  -- 'visa'/'transport'/'food'/'safety'/'culture'
    destination  VARCHAR(100), -- 关联目的地，可空表示通用
    embedding    JSON,         -- DeepSeek embedding 向量
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_destination (destination)
);
```

完整 9 张表 SQL 见附录 §12。

---

## 6. AI Agent 设计

### 6.1 核心 Tool 清单（10 + 1 共 11 个）

**Tool 1-9**：见原立项文档（搜索 / 详情 / 比较 / 心愿单 / 订单 / PDF）

**Tool 10：search_travel_tips（RAG）**
```python
{
    "name": "search_travel_tips",
    "description": "从旅行知识库检索相关贴士（签证、交通、美食、安全、文化等）。用于回答用户的旅行常识问题。",
    "parameters": {
        "query": "用户的旅行问题，如 '东京需要签证吗'、'巴黎交通怎么坐'",
        "top_k": "返回几条，默认 3"
    }
}
```

### 6.2 RAG 实现方案（凑数但能讲）

**最小可行 RAG**：
1. **数据**：预置 30 条旅行贴士（签证/交通/美食/安全），写到 `travel_tips` 表
3. **Embedding**：用 DeepSeek Embeddings API（每条贴士入库时算一次向量，存 JSON）
4. **检索**：`search_travel_tips(query)` → 把 query 也算 embedding → 与库里所有向量算 cosine similarity → 返回 top-3
5. **生成**：把检索结果作为 context 喂给 LLM，让 LLM 整理成自然语言回答

**答辩时的讲法**：
> "我做了 RAG 用于旅行贴士问答。知识库有 30 条预置数据，用 DeepSeek Embeddings API 计算向量，用余弦相似度检索，top-3 作为 context 喂给 LLM。虽然规模小，但完整跑通了 embedding→ 检索 → 生成的 RAG 闭环。"

**为什么这么设计**：评委看到的是**完整的 RAG 流程**，而不是堆砌。

### 6.3 System Prompt（核心）

```text
你是 StayAgent，一个能真正帮用户订房的 AI 助手。

你可以调用以下工具：
1. search_listings - 搜索房源
2. get_listing_detail - 查看详情
3. compare_listings - 比较房源
4. add_to_wishlist - 加入心愿单
5. remove_from_wishlist - 移出心愿单
6. list_wishlists - 查看心愿单
7. create_booking - 预订
8. list_my_trips - 查看订单
9. parse_travel_plan_pdf - 解析PDF旅行计划
10. recommend_from_plan - 根据计划推荐
11. search_travel_tips - 检索旅行贴士（签证、交通等）

回答原则：
- 用户需求模糊时，主动用 search_listings 找候选，再针对性追问或推荐
- 调用 Tool 后，用自然语言总结结果，不要罗列 JSON
- 推荐时给出 2-3 个候选，附简短理由
- 如果用户说"帮我订"，必须先确认房源、日期、人数、价格再下单（前置 Human-in-the-loop）
- 涉及旅行常识（签证/交通等）→ 先调 search_travel_tips
- 如果用户上传了PDF，先调 parse_travel_plan_pdf

输出格式：
- 用 Markdown，列表、加粗、表格都可以用
- 价格用 ¥ 前缀
- 房源 ID 用 #1234 形式方便引用
```

### 6.4 Tool Calling 流程（伪代码）

```python
async def agent_chat(user_id: int, user_message: str, conv_id: int):
    messages = load_conversation(conv_id)
    messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
    messages.append({"role": "user", "content": user_message})
    
    agent_run = create_agent_run(conv_id, user_message)
    
    for step in range(MAX_STEPS):
        response = await llm_client.chat(
            model="deepseek-chat",
            messages=messages,
            tools=TOOL_SCHEMAS,
            stream=False
        )
        message = response.choices[0].message
        
        if message.tool_calls:
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)
                
                step_record = save_agent_step(agent_run.id, step, tool_name, tool_args)
                
                # Human-in-the-loop：create_booking 需前端确认
                if tool_name == "create_booking":
                    return {"status": "pending_confirmation", "tool_call": tool_call}
                
                # Tool 错误处理：tenacity 重试 + 结构化错误
                try:
                    result = await execute_with_retry(user_id, tool_name, tool_args)
                except Exception as e:
                    result = {"error": str(e), "tool": tool_name}
                step_record.tool_result = result
                
                messages.append(message)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False)
                })
            
            continue
        
        final = message.content
        messages.append({"role": "assistant", "content": final})
        save_messages(conv_id, messages)
        update_agent_run(agent_run.id, final, "completed")
        return {"status": "completed", "content": final}
    
    return {"status": "timeout", "content": "处理超时，请简化你的需求。"}
```

---

## 7. 项目结构

### 7.1 后端目录

```
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── deps.py
│   ├── models/              # SQLAlchemy ORM
│   │   ├── user.py
│   │   ├── listing.py
│   │   ├── wishlist.py
│   │   ├── booking.py
│   │   ├── conversation.py
│   │   ├── agent.py
│   │   └── travel_tip.py    # ⭐ RAG 知识库
│   ├── schemas/             # Pydantic
│   ├── api/                 # 路由
│   │   ├── auth.py
│   │   ├── listings.py
│   │   ├── wishlists.py
│   │   ├── bookings.py
│   │   ├── agent.py
│   │   └── travel_tips.py   # ⭐ RAG 检索 API
│   ├── services/
│   │   ├── listing_service.py
│   │   ├── wishlist_service.py
│   │   ├── booking_service.py
│   │   └── agent/
│   │       ├── orchestrator.py
│   │       ├── tools.py
│   │       ├── tool_schemas.py
│   │       ├── llm_client.py
│   │       ├── prompts.py
│   │       └── rag.py       # ⭐ RAG 检索实现
│   ├── core/
│   │   ├── security.py
│   │   ├── exceptions.py    # ⭐ 统一错误处理
│   │   └── retry.py         # ⭐ tenacity 重试封装
│   └── db/
│       ├── base.py
│       └── session.py
├── alembic/
├── scripts/
│   ├── seed_listings.py     # 50~100 条房源
│   └── seed_travel_tips.py  # ⭐ 30 条 RAG 数据 + embedding
├── tests/
├── requirements.txt
└── .env.example
```

### 7.2 前端目录

```
frontend/
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   ├── stores/              # Pinia
│   ├── api/
│   ├── components/
│   │   ├── ListingCard.vue          # F2 复用
│   │   ├── PriceBreakdown.vue       # F2 复用
│   │   ├── EmptyState.vue           # F6 微交互
│   │   ├── ErrorState.vue           # F6
│   │   ├── SkeletonCard.vue         # F6
│   │   ├── AgentPanel.vue           # F7 Streaming
│   │   ├── AgentMessage.vue
│   │   ├── AgentToolStep.vue
│   │   ├── AgentConfirmDialog.vue   # A9 Human-in-the-loop
│   │   └── GenerativeListingCard.vue# F8 Generative UI
│   ├── views/
│   ├── types/
│   └── utils/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 8. 里程碑（3 周 + 26 项加分项嵌入）

### Week 1：核心业务 + 静态体验

| Day | 任务 | 加分项嵌入 |
|---|---|---|
| Day 1 | 项目骨架：Vue 3 + FastAPI + MySQL 跑通 Hello World | F1, B1, B2 |
| Day 2 | 用户系统：注册 / 登录 / JWT / Pinia | B4, B5, F3 |
| Day 3 | 房源数据 seed 脚本 | - |
| Day 4 | 首页：搜索区 + 推荐房源 + 卡片 | **F6 Skeleton/Empty/Error** |
| Day 5 | 搜索 + 列表 + URL 同步 | **F4 Optimistic Update**（收藏）|
| Day 6 | 房源详情：图库 / 评分 / 价格拆解 | F2 PriceBreakdown 复用 |
| Day 7 | 收尾 + 测试 | B3 统一错误处理 |

### Week 2：Agent 第一版 + 关键加分项

| Day | 任务 | 加分项嵌入 |
|---|---|---|
| Day 8 | LLM 客户端 + Tool Schema 定义 | A1 |
| Day 9 | Tool 1-4 实现 | A1 |
| Day 10 | Agent Orchestrator + Tool 调用循环 | **A10 错误处理/重试** |
| Day 11 | 前端 AgentPanel + SSE 流式 | A2, F7, **A9 Human-in-the-loop** |
| Day 12 | Tool 5-7 实现 | A1 |
| Day 13 | Tool 执行轨迹展示 | A4, A5, F2 AgentStep 复用 |
| Day 14 | 端到端测试 | B6 数据库事务 |

### Week 3：Agent 进阶 + 加分项收尾 + RAG + 答辩

| Day | 任务 | 加分项嵌入 |
|---|---|---|
| Day 15 | PDF 上传 + pdfplumber + Tool 8-9 | A6 |
| Day 16 | 多轮对话 + Memory + Conversation 持久化 | A3, A8 |
| Day 17 | **RAG：Tool 10 + 知识库 seed + embedding + 检索** | **A7 RAG** |
| Day 18 | UI 打磨 + 动画 + Generative UI | **F5 页面动画, F8 Generative UI, F6 微交互补完** |
| Day 19 | README + 架构图 + 演示视频 | - |
| Day 20 | Bug 修复 + 加分项扫尾 + 26 项 checklist 复查 | - |
| Day 21 | 答辩准备 + 提交 | - |

**3 周总工作量统计**：
- 必做功能：12 个模块
- 加分项：26 项（19 项融入核心 + 6 项专项做 + 1 项 RAG）
- 答辩准备：1 天

---

## 9. 风险与应对

| 风险 | 等级 | 应对 |
|---|---|---|
| Agent 死循环 | 🟠 中 | max_steps=5 + 超时熔断 |
| LLM 幻觉（订错房）| 🟠 中 | Human-in-the-loop 前置确认 |
| 流式不稳定 | 🟡 低 | SSE + 重连 + buffer |
| PDF 解析失败 | 🟡 低 | pdfplumber 失败提示手动输入 |
| RAG 检索质量差 | 🟡 低 | 30 条预置数据 + top-3 够用 |
| 时间不够 | 🔴 高 | 严格按里程碑，加分项可裁 |
| DeepSeek 限流 | 🟡 低 | tenacity retry + 多 key 备用 |

---

## 10. 答辩准备要点

**评委大概率问**：

1. "Agent 怎么设计的？Tool 怎么定义？"
   → 准备架构图、Tool Schema 示例

2. "为什么不用 LangChain？"
   → 手写更可控、易调试、对学习更好

3. "Tool Calling 怎么防止死循环？"
   → max_steps + 异常熔断 + Tool 返回结构化校验

4. "数据隔离怎么做的？"
   → JWT + user_id 过滤，所有查询带 WHERE user_id=?

5. "AI 部分出错怎么办？"
   → 三层兜底：Tool 错误重试 → LLM 重试 → 人工兜底

6. "RAG 怎么做的？"
   → 30 条知识库 + DeepSeek Embeddings + 余弦相似度 + top-3 作为 context

7. "Generative UI 怎么做的？"
   → Tool 返回结构化 JSON，前端根据 type 字段动态渲染

8. "Human-in-the-loop 在哪里？"
   → create_booking 调用前弹窗让用户确认

---

## 11. Day 1 行动清单

1. 创建项目目录 `/Users/drunk/Documents/Codex/2026-09-22/ni-j/stayagent/`
2. 初始化 Git
3. 搭 FastAPI 骨架 + 第一个路由 `/api/health`
4. MySQL 连接 + 创建空数据库 `stayagent`
5. 搭 Vue 3 + Vite + TS 骨架
6. Vue 调 `/api/health` 跑通
7. 浏览器看到 "Hello StayAgent"

---

## 12. 数据库完整 SQL（9 张表）

```sql
-- 用户
CREATE TABLE users (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    email        VARCHAR(255) UNIQUE NOT NULL,
    username     VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url   VARCHAR(500),
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 房源
CREATE TABLE listings (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    host_name    VARCHAR(100) NOT NULL,
    city         VARCHAR(100) NOT NULL,
    country      VARCHAR(100) NOT NULL,
    latitude     DECIMAL(10, 7),
    longitude    DECIMAL(10, 7),
    property_type ENUM('apartment','house','villa','hotel','studio') NOT NULL,
    price_per_night DECIMAL(10, 2) NOT NULL,
    cleaning_fee DECIMAL(10, 2) DEFAULT 0,
    service_fee  DECIMAL(10, 2) DEFAULT 0,
    max_guests   INT NOT NULL DEFAULT 1,
    bedrooms     INT DEFAULT 1,
    beds         INT DEFAULT 1,
    bathrooms    INT DEFAULT 1,
    rating       DECIMAL(2, 1) DEFAULT 0,
    review_count INT DEFAULT 0,
    amenities    JSON,
    images       JSON,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_city (city),
    INDEX idx_price (price_per_night)
);

-- 心愿单
CREATE TABLE wishlists (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id    BIGINT NOT NULL,
    name       VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_name (user_id, name)
);

-- 心愿单项
CREATE TABLE wishlist_items (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    wishlist_id BIGINT NOT NULL,
    listing_id  BIGINT NOT NULL,
    added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    UNIQUE KEY uk_wishlist_listing (wishlist_id, listing_id)
);

-- 订单
CREATE TABLE bookings (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id      BIGINT NOT NULL,
    listing_id   BIGINT NOT NULL,
    check_in     DATE NOT NULL,
    check_out    DATE NOT NULL,
    guests       INT NOT NULL,
    nights       INT NOT NULL,
    subtotal     DECIMAL(10, 2) NOT NULL,
    cleaning_fee DECIMAL(10, 2) NOT NULL,
    service_fee  DECIMAL(10, 2) NOT NULL,
    total        DECIMAL(10, 2) NOT NULL,
    status       ENUM('pending','confirmed','cancelled','completed') DEFAULT 'confirmed',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id),
    INDEX idx_user_created (user_id, created_at DESC)
);

-- 对话
CREATE TABLE conversations (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id    BIGINT NOT NULL,
    title      VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 消息
CREATE TABLE messages (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    role            ENUM('user','assistant','system','tool') NOT NULL,
    content         TEXT,
    tool_calls      JSON,
    tool_call_id    VARCHAR(100),
    tool_name       VARCHAR(100),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_conv_created (conversation_id, created_at)
);

-- Agent 运行
CREATE TABLE agent_runs (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    user_message    TEXT NOT NULL,
    final_response  TEXT,
    status          ENUM('running','completed','failed','pending_confirmation') DEFAULT 'running',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at    DATETIME,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Agent 单步
CREATE TABLE agent_steps (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    agent_run_id BIGINT NOT NULL,
    step_number  INT NOT NULL,
    tool_name    VARCHAR(100),
    tool_args    JSON,
    tool_result  JSON,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
);

-- RAG 知识库
CREATE TABLE travel_tips (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    title        VARCHAR(255) NOT NULL,
    content      TEXT NOT NULL,
    category     VARCHAR(50),
    destination  VARCHAR(100),
    embedding    JSON,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_destination (destination)
);
```

---

## 13. 加分项完成度跟踪表（写到 README）

```
=== 前端 ===
[✅] F1 TypeScript
[✅] F2 高复用组件         (ListingCard/PriceBreakdown/AgentStep/EmptyState/ErrorState/SkeletonCard)
[✅] F3 状态管理 Pinia
[✅] F4 Optimistic Update  (心愿单添加/移除)
[✅] F5 页面动画          (Router 过渡 + 卡片入场)
[✅] F6 微交互            (Loading/Skeleton/Empty/Error/Toast)
[✅] F7 Streaming UI      (AgentPanel SSE)
[✅] F8 Generative UI     (Agent 返回结构化数据渲染卡片)

=== 后端 ===
[✅] B1 ORM              (SQLAlchemy 2.0)
[✅] B2 参数校验         (Pydantic v2)
[✅] B3 统一错误处理     (FastAPI exception handlers)
[✅] B4 JWT
[✅] B5 权限控制         (user_id 过滤)
[✅] B6 数据库事务       (SQLAlchemy session)
[✅] B7 Service 层
[✅] B8 数据表设计       (9 张表)

=== Agent ===
[✅] A1  Tool Calling
[✅] A2  Streaming
[✅] A3  多轮对话
[✅] A4  Agent 执行状态
[✅] A5  Tool 执行过程展示
[✅] A6  PDF 解析
[✅] A7  RAG             (30 条知识库 + Embedding + 余弦相似度)
[✅] A8  Memory
[✅] A9  Human-in-the-loop  (create_booking 前置确认)
[✅] A10 Tool 错误处理/重试

总计：26/26 ✅
```

---

**📌 文档版本：v2.0（已包含完整加分项 + RAG）**  
**下一步：等你回答 Q1/Q2/Q3，我们开干 Day 1。**

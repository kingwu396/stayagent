# StayAgent 技术决策（Block 11-13）面试口径

> 涵盖 Tool Calling / RAG / PDF 解析 / HITL / Generative UI
> 每条决策都说明：**为什么选** / **替代方案** / **权衡**

---

## 1. Tool Calling 体系

### Q1.1 为什么手写 ReAct 循环，不引 LangChain / LlamaIndex？

**选**：
```python
# backend/app/services/agent/orchestrator.py
async def _execute_step(db, user, messages, run, step_idx) -> list[dict]:
    """单步：调 LLM，看返回，有 tool 就执行，无 tool 就 final"""
    resp = await retry_on_llm_error(get_llm_client().chat)(...)
    if not tool_calls or finish_reason == "stop":
        return [{"type": "final", "content": ...}]
    # 写 AgentStep, 执行 tool, 结果喂回 LLM
```

**为什么不引 LangChain**：
- 透明可控：所有 step 在 DB 里都有记录（agent_steps 表）
- 调试简单：每个 tool 的入参、结果、耗时都在 step 里
- 依赖少：langchain + langchain-community + 各种 integrations 包，体量加 100MB+
- 项目体量：12 个 tool 不需要框架的"AgentExecutor"抽象

**替代方案**：LangChain 的 `AgentExecutor.from_agent_and_tools(agent, tools)`，一行就建 agent。但问题是：
- tool 调度不透明（看不到中间过程）
- 想加 HITL 需要 hack callback
- 想做 Generative UI 需自定义 output parser

### Q1.2 为什么 max 8 步？

**选**：`MAX_STEPS = 8`

**理由**：
- 8 步足够覆盖 90% 的查询（搜 → 比较 → 加心愿单 → 下单 ≈ 3-4 步）
- 防失控：LLM 可能无限循环（比如 search_listings 一直调）
- 单次 DeepSeek 调用 ~2-5s，8 步最坏 40s（用户能接受）

**对比**：
- LangChain 默认 `max_iterations=15`
- OpenAI Function Calling 实践建议 5-10 步
- 8 是个平衡值

### Q3 为什么 tool 错误抛 `ToolError`，转成结构化错误喂回 LLM？

**选**：
```python
# tools.py
class ToolError(Exception):
    def __init__(self, message: str, code: str = "TOOL_ERROR"):
        self.code = code

# orchestrator.py
try:
    result = tool_fn(user=user, db=db, **args)
except ToolError as e:
    result = {"error": str(e), "code": e.code}
except Exception as e:
    result = {"error": f"内部错误: ...", "code": "INTERNAL_ERROR"}

messages.append({"role": "tool", "content": json.dumps(result, ...)})
```

**为什么不让 tool 抛 raise 直接失败**：
- LLM 看到结构化 `{"error": "心愿单 #5 不存在", "code": "NOT_FOUND"}`
- LLM 会自主决定下一步："OK 那我改个 ID 再试" 或者 "告诉用户找不到"
- 这是 self-healing 的关键

**对比**：
- 直接 raise → LLM 拿到 Exception 不知道发生了什么，可能死循环
- LLM 重试机制（OpenAI 的 retry 字段）只能重试整次调用，不能重试单步

### Q4 为什么只有 `create_booking` 走 HITL，其他 tool 直接执行？

**HITL 流程**：
```
LLM 调 create_booking
↓
orchestrator 检测 tool_name == "create_booking"
↓
不执行，写 run.status = "pending_confirmation"
   run.pending_tool_call = {tool_name, tool_args}
↓
前端 AgentConfirmCard 弹出
↓
用户点"确认下单" → POST /api/agent/runs/{id}/confirm
↓
后端校验 status, 执行 tool, 写 booking, 改 status=completed
```

**为什么 create_booking 必须 HITL**：
- 不可逆：booking 是真实业务数据，落 MySQL
- 可能误判：日期、人数、房型都是 LLM 自己推理的，可能错
- 监管要求：用户必须明确同意

**为什么其他 tool 不需要 HITL**：
- search_listings / get_listing_detail：**只读**操作，无副作用
- wishlist 操作：用户已经说"加入心愿单"了，HITL 是多余的（除非特别敏感）

**对比方案**：
- 全工具都 HITL：UX 太重，每个查询都要确认
- 全自动执行：下单等不可逆操作风险大

### Q5 Tool schema 设计的坑（面试高频）

**真实 bug**：
```python
# tool_schemas.py 旧版本
parse_travel_plan_pdf = {
    "name": "parse_travel_plan_pdf",
    "parameters": {
        "properties": {
            "file_path": {"type": "string"},   # ❌ 错了
        },
        "required": ["file_path"],
    }
}

# tools.py 实现
def parse_travel_plan_pdf(user, db, plan_text: str, **_kwargs):  # ✅ 要 plan_text
```

**症状**：LLM 按 schema 调 `parse_travel_plan_pdf(file_path="xxx.pdf")`，Python 找不到 `plan_text` → `TypeError: missing 1 required positional argument: 'plan_text'`

**修复**：
```python
# 改成 plan_text
parse_travel_plan_pdf = {
    "parameters": {
        "properties": {
            "plan_text": {"type": "string", "description": "旅行计划文本内容"},
        },
        "required": ["plan_text"],
    }
}
```

**面试要点**：
- Schema 和实现是两个文件，必须对齐
- 单测覆盖：直接调函数 + 检查 schema 的 properties
- prompt 也要同步澄清（"plan_text 是文本不是文件路径"）

### Q6 为什么 `parse_travel_plan_pdf` 走 regex，不走 LLM 抽取？

**选**：纯 regex 抽取 ISO 日期 + 已知城市名
```python
_RE_ISO_DATE = re.compile(r"\b20\d{2}-\d{2}-\d{2}\b")
_KNOWN_CITIES = {"Tokyo", "Paris", "New York", ...}
def _regex_parse_plan(text):
    dates = list(dict.fromkeys(_RE_ISO_DATE.findall(text)))[:10]
    cities = [c for c in _KNOWN_CITIES if re.search(rf"\b{c}\b", text, re.IGNORECASE)]
    return {"cities": cities, "dates": dates, ...}
```

**为什么不调 LLM 抽**：
- LLM 抽 ~2s + token 费
- 已知城市 + ISO 日期 regex 100% 覆盖 demo 场景
- demo 用的 PDF 是手写的测试文档（用英语 + ISO 日期）

**未来升级**：要支持任意城市/自由文本，可以加 LLM 抽取作为增强层（regex 兜底）

### Q7 F8 Generative UI：为什么 agent tool 结果渲染成卡片，不是 JSON？

**改前**：
```tsx
// AgentToolStep.tsx 旧版本
<pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
  {JSON.stringify(step.tool_result, null, 2)}
</pre>
```

**改后**：
```tsx
function renderResult(toolName, result) {
  switch (toolName) {
    case 'search_listings':
      return items.map(it => <AgentListingCard item={it} />)
    case 'search_travel_tips':
      return tips.map(t => <AgentTipsCard tip={t} />)
    case 'create_booking':
      return <AgentBookingCard item={result} />
    case 'recommend_from_plan':
      return <AgentPlanCard item={result} />
  }
  return <pre>{JSON.stringify(result)}</pre>  // 兜底
}
```

**为什么改**：
- JSON dump 不好看，**对答辩是减分项**
- 卡片可点（跳详情 / 跳 /trips），agent → 实际业务的桥接
- 评分（score 进度条）等元数据可视化

**为什么不复用 ListingCard**：
- ListingCard 是大卡（带收藏按钮），不适合 chat 横向小卡场景
- 工具返回的 dict 没有 `country` / `primary_image` 等字段（搜出来的还没详情）
- 复用会传一堆 props 适配，反而不清晰

---

## 2. RAG（Block 12）

### Q2.1 为什么用 sentence-transformers 本地 embedding，不用云 API？

**选**：`sentence-transformers/all-MiniLM-L6-v2`（384 维，~80MB）

**替代方案对比**：
| 方案 | 优势 | 劣势 |
|---|---|---|
| **本地 sentence-transformers** ✅ | 0 成本，0 联网查询 | 模型 80MB 首次下载 |
| DeepSeek Embeddings API | 官方支持 | **实际不存在**，DeepSeek 没有 embedding 端点 |
| OpenAI text-embedding-3 | 1536 维，质量高 | 收费，每千 token $0.0001 |
| LangChain + Pinecone/Chroma | 工业级 | 引入重型依赖，对 30 条杀鸡用牛刀 |

**关键事实**：用户可能误以为"DeepSeek 有 embedding API"，但**实际 DeepSeek 没有公开的 embedding 端点**。这点面试必问。

### Q2.2 为什么不用向量数据库（Chroma / Milvus / pgvector）？

**选**：全表 cosine similarity（30 条规模）

```python
# retriever.py
def retrieve_tips(db, query, top_k=3, category=None):
    q_vec = embed_text(query)
    candidates = db.execute(select(Traveltip)).scalars().all()
    scored = [(t, cosine_sim(q_vec, t.embedding)) for t in candidates]
    return sorted(scored, key=lambda x: -x[1])[:top_k]
```

**为什么不用向量 DB**：
- 30 条知识库，全量扫 < 50ms，根本不需要 HNSW / IVF 索引
- 引入向量 DB 需要单独的 docker 服务 / 额外进程
- 简单性 > 可扩展性（demo 阶段）

**何时升级**：
- 知识库 > 1000 条
- QPS > 100
- 需要混合检索（关键词 + 向量）

### Q2.3 为什么 cosine similarity，不点积？

**选**：cosine similarity（等价于归一化向量的点积）

```python
# embedding.py
v = self._m.encode(text, normalize_embeddings=True, ...)  # 默认 normalize

def _cosine_sim(a, b):
    return float(np.dot(np.array(a), np.array(b)))  # 已是单位向量
```

**为什么不直接点积**：
- 余弦相似度范围 [-1, 1]，与向量长度无关（语义相似 ≠ 字数相似）
- 归一化后 dot = cosine，**等效但实现简单**

### Q2.4 为什么 lifespan 里 warmup（首次跑 dummy embed）？

```python
# main.py lifespan
await redis_client.connect()
await rag_service.warmup()  # 跑一次 embed("warmup")
```

**原因**：
- 首次 query 时再 load 模型 → 延迟 ~3-5s（HF 模型下载 + load）
- lifespan 时 load → 启动期用户感知不到，**首查 < 100ms**

### Q2.5 为什么用 hf-mirror.com 镜像？

**设置**：`HF_ENDPOINT=https://hf-mirror.com`（已在环境变量）

**为什么**：
- 国内直连 huggingface.co 慢且易断
- hf-mirror.com 是国内镜像，国内拉模型快
- 镜像和官方内容一致

### Q2.6 检索质量实测

```python
# query='日本签证怎么办理'
[
    {score: 0.578, title: '日本签证基础申请流程'},
    {score: 0.392, title: '澳大利亚签证 eVisitor (651)'},
    {score: 0.388, title: '日本交通卡 Suica/Pasmo'},
]

# query='巴黎地铁票' + category='transport'
[
    {score: 0.547, title: '巴黎地铁与 Navigo Easy 卡'},
    {score: 0.518, title: '纽约地铁与 MTA 票务'},
    {score: 0.491, title: '巴塞罗那 T-Casal 10 次卡'},
]
```

**Top-1 准确率**：测试集 ~80%（中文 query 命中正确类别）

---

## 3. PDF 解析（Block 12 + 12 末尾修复）

### Q3.1 面试高频问题：**PDF 怎么解析的？**

**整体流程**：
```
1. 用户在 AgentPanel 点 📎 → 浏览器选文件 (accept="application/pdf")
2. 前端 POST /api/uploads/pdf (multipart/form-data)
   ├─ 校验 content_type == "application/pdf"
   ├─ 校验 size <= 10MB
   └─ body: file=<二进制>
3. 后端 (FastAPI UploadFile):
       ├─ 读字节 → 保存到 /tmp/stayagent_uploads/{uuid}.pdf
       ├─ pdfplumber.open(path) 抽 text
       │   ├─ 遍历 pages
       │   └─ page.extract_text() 取每页文本
       └─ 返回 {file_id, filename, text, page_count, char_count}
4. 前端把附件元数据存 local state, 显示 chip
5. 用户输入 "帮我规划行程" + 点发送
6. 前端 POST /api/agent/chat/stream
   body: { message: "帮我规划行程", attachment: {file_id, text, ...} }
7. 后端 orchestrator 接收 attachment:
   ├─ DB user_message = "帮我规划行程"  (纯文字)
   └─ LLM messages = "帮我规划行程\n\n[附件: plan.pdf, 7 页, 2754 字]\n```\n<PDF text>\n```"
8. LLM 直接读 inline text，回答
```

### Q3.2 为什么用 pdfplumber，不选其他库？

| 库 | 优势 | 劣势 |
|---|---|---|
| **pdfplumber** ✅ | API 简单（`page.extract_text()`），中文支持好，对表格/排版有感知 | 慢（CPU 解析） |
| PyPDF2 | 快 | 中文支持差，复杂排版乱 |
| pdfminer.six | 底层控制强 | API 复杂，要写 layout 算法 |
| Tika (Java) | 支持 OCR | 要起 Java 服务，太重 |
| Camelot | 表格抽取 | 只能抽表格，文字场景不行 |
| MarkItDown | 输出 markdown | 文档格式要求高 |

**决策**：demo 场景，pdfplumber 中文支持 + 简单 API 是最佳平衡。

### Q3.3 为什么走"前端上传 + 后端提取"流程，不在前端用 pdf.js？

**为什么不前端解析**：
- pdf.js 解的是渲染层（canvas），提取文字要走 text layer，复杂
- pdf.js 体积大（~500KB+），影响首屏
- 文件大小 10MB 在前端处理会卡
- **前后端职责清晰**：前端负责 UI，后端负责内容

**为什么不后端一键解析（前端不发附件）**：
- 后端需要先存 PDF 到磁盘才能解析
- 需要 file_id 关联
- 前端需要知道上传状态（成功/失败）
- **多一步交互**反而更复杂

### Q3.4 为什么 10MB 限制？

**理由**：
- demo PDF 文档通常 < 5MB
- 10MB 在内存里能 hold（pdfplumber 是 lazy 流式）
- 防止恶意上传 OOM
- **没有设到 50MB**：单 PDF 50MB 一是占内存，二是 LLM 一次性塞不下（DeepSeek context 64K token，10MB 中文 ≈ 5000 字，远小于 context）

### Q3.5 为什么不支持扫描件（图片型 PDF）？

**当前行为**：
```python
text = "\n\n".join(text_parts).strip()
if not text:
    raise HTTPException(422, "PDF 解析为空 (可能是扫描件, 不支持 OCR)")
```

**为什么不加 OCR**：
- OCR 需要 tesseract / paddleocr，**几 GB 模型**
- 部署复杂度爆炸
- demo 场景假设用户用文本 PDF（手写生成的）

**未来**：如果产品要求，可拆成"高级解析"功能，调云 OCR API（按调用付费）

### Q3.6 PDF 文件存哪？什么时候清？

**存**：`/tmp/stayagent_uploads/{uuid}.pdf`
- UUID4 是文件名（不带扩展名）
- 不存数据库（只在前端 local state + 临时 memory）

**清理**：
- **不做显式清理**（OS 周期性 tmp 清理，macOS 是重启清空 /tmp）
- 提供 `DELETE /api/uploads/pdf/{file_id}` 端点（plan 里写了，没实现）

### Q3.7 关键修复：PDF 内容不污染用户消息气泡（Block 12 末尾）

**Bug**：
```tsx
// AgentInput.tsx 旧版本 (错的)
let message = text.trim()
if (attachment) {
  message = message + '\n\n[附件]\n' + attachment.text
}
sendMessage(message)  // ❌ 整段 PDF 拼到 message body
```

**后果**：用户气泡显示整段 PDF + 附件 chip，UX 很差。

**修复**：
```tsx
// 新版本
sendMessage(text.trim(), attachment)  // PDF 走单独 attachment 字段
```

后端 orchestrator 在 LLM 上下文里 augment：
```python
llm_user_message = (
    f"{user_message}\n\n"
    f"[附件: {attachment.filename}, {attachment.page_count} 页, {attachment.char_count} 字]\n"
    f"```\n{attachment.text}\n```"
)
```

**为什么这样设计**：
- **DB Message.content = 纯文字**（气泡显示简洁，历史干净）
- **LLM context = augment 后的**（LLM 能看到 PDF）
- **PDF 内容只在 LLM 临时 context 里**，不进 DB

### Q3.8 为什么不用 file_id 让后端查 PDF 文件再喂给 LLM？

**对比**：
| 方案 | 优势 | 劣势 |
|---|---|---|
| **inline 注入** ✅ | 简单，无需后端文件查找 | PDF 文本在 LLM context 里占 token |
| file_id 引用 + 后端查 | 节省 context | 需要 LLM 多调一次 tool |

**选 inline** 因为：
- demo PDF 通常 < 5000 字（中文），占 ~2K token，DeepSeek context 64K 绰绰有余
- LLM 一次拿到全文比"先 file_id 再查"的链路短
- 用户体验：等待时间短

### Q3.9 schema vs 实现 mismatch bug（file_path vs plan_text）

**问题**：早期 `tool_schemas.py` 写的是 `file_path`，但 `tools.py` 实现要 `plan_text`：
```python
# Schema 错误
parse_travel_plan_pdf = {
    "properties": {"file_path": {"type": "string"}},
    "required": ["file_path"],
}
# 实现正确
def parse_travel_plan_pdf(user, db, plan_text: str, **_kwargs):
```

**LLM 行为**：按 schema 调，Python 报 TypeError。

**修复**：
```python
# Schema 改正
parse_travel_plan_pdf = {
    "properties": {"plan_text": {"type": "string"}},
    "required": ["plan_text"],
}
# prompt 也改
"PDF 文本已 inline 在用户消息 ``` 块里, 直接读; 如要结构化抽取, 调 parse_travel_plan_pdf(text=<inline 文本>)"
```

**面试要点**：
- Schema 和实现是两个文件，必须有自动化测试对齐（Test 10 加了断言）
- LLM 幻觉参数名是常见 bug，要 prompt 澄清

### Q3.10 为什么 LLM 不再调 parse_travel_plan_pdf？

**修复后流程**：
```
1. 用户上传 PDF
2. 后端 augment: 把 PDF 文本 inline 到 LLM 上下文（用 ``` 代码块包裹）
3. LLM 看到 inline 文本 + "请回答"
4. LLM 直接回答，不再调工具

如果 LLM 真的要调:
5. LLM 从 ``` 块提取文本
6. 调 parse_travel_plan_pdf(plan_text=<extracted>)
7. 工具 regex 抽 ISO 日期 + 已知城市名
```

**关键修复**：prompt 明确说"PDF 已 inline, 不必再调工具"。

---

## 4. F5 动画（Block 13）

### Q4.1 为什么 framer-motion，不选 CSS-only？

**选 framer-motion 14.x**（~50KB gzipped）

**对比**：
| 方案 | 优势 | 劣势 |
|---|---|---|
| **framer-motion** ✅ | 复杂 enter/exit/layout 动画 | 50KB |
| tailwindcss-animate | 几 KB | 仅 enter keyframes，exit/layout 难 |
| 纯 CSS transition | 0 依赖 | hover/scale 简单，路由切换难 |

**为什么需要复杂动画**：
- **AnimatePresence mode="wait"**：路由切换时旧页面 fade-out → 新页面 fade-in（避免重叠闪烁）
- **layout animation**：toast 列表项增删时自动 smooth 过渡
- **whileHover / whileTap**：AgentFab spring 缩放
- **staggerChildren**：列表卡片渐次入场

### Q4.2 为什么用 spring，不是 tween？

**选**：`{ type: 'spring', stiffness: 380, damping: 32 }`

**原因**：
- spring 有自然的反弹效果，像真实物体
- tween 是机械的匀速，UI 显得僵硬
- framer-motion 默认值经过 Apple 设计师调优

### Q4.3 路由切换为什么 `mode="wait"`？

```tsx
<AnimatePresence mode="wait">
  <PageTransition pageKey={location.pathname}>
    <Outlet />
  </PageTransition>
</AnimatePresence>
```

**对比**：
- `mode="sync"`（默认）：新页面和旧页面同时出现，重叠
- `mode="wait"`：等旧页面 exit 完再 enter，无重叠

**为什么 wait 适合路由**：
- 单页应用切换是 full-screen replace
- 不要看到两个页面"穿插"
- 牺牲一点速度（exit + enter ≈ 360ms），换 UX 干净

---

## 5. F8 Generative UI（Block 13）

### Q5.1 为什么 chat 里要渲染卡片？

**改前**：tool result 直接 `<pre>{JSON.stringify(result)}</pre>`，用户看到一堆 JSON 字段。

**改后**：识别 tool_name 路由到专属卡片：
- `AgentListingCard`：横向小卡，cover + title + city + price + rating，**点击跳详情**
- `AgentTipsCard`：顶部 score 进度条 + category badge + content
- `AgentBookingCard`：下单成功高亮，**点击跳 /trips**
- `AgentPlanCard`：plan_summary + 缩略 listing 列表

**为什么**：
- agent → 业务的桥接（卡片可点 → 跳转）
- 答辩演示效果好（卡片 > JSON）
- 用户有视觉锚点（score 进度条直观）

### Q5.2 为什么不复用 ListingCard？

**对比**：
- ListingCard：用于搜索/首页，大卡，有 wishlist 按钮，需要完整 ListingSummary 字段
- AgentListingCard：用于 chat 内，小卡，无 wishlist 按钮，只用 tool 返回的子集字段

**为什么不复用**：
- ListingCard props 复杂（listing: ListingSummary 全字段），传子集类型不匹配
- 适配成本 > 新建成本
- chat 场景需要不同视觉（紧凑）

### Q5.3 未知 tool 走 JSON 兜底

```tsx
function renderResult(toolName, result) {
  switch (toolName) {
    case 'search_listings': ...
    case 'search_travel_tips': ...
    // ...
  }
  return <pre>{JSON.stringify(result)}</pre>  // ✅ 兜底
}
```

**为什么**：
- 不破坏 debug 体验（不识别的 tool 还能看 JSON）
- 未来加新 tool 自动 fallback，不用每次都改 switch
- 兜底 ≠ 错误，是合理的"通用渲染"

### Q5.4 score 进度条设计

```tsx
<div className="h-1 bg-slate-100">
  <div style={{ width: `${score * 100}%` }} className="bg-brand-500" />
</div>
<span>{(score * 100).toFixed(0)}% 相关</span>
```

**为什么显示**：RAG 检索的相似度对用户透明（"为什么这条是 top1？"），是 demo 答辩的高光点。

---

## 6. 一句话总结（开场/收尾用）

> "我们手写了一个 ~400 行的 ReAct 循环，每个 tool 都有独立的 schema/implementation/test 闭环，  
>  RAG 用本地 sentence-transformers + 全表 cosine similarity（不引向量 DB），  
>  PDF 用 pdfplumber 抽 text 后 inline 注入 LLM context（不走 file_id 引用），  
>  HITL 只对 create_booking 这种不可逆操作生效（搜索类只读的直接执行），  
>  agent 工具结果用 4 个 chat 专属卡片渲染（F8），配合 framer-motion 做路由/列表/消息入场动画（F5）。"


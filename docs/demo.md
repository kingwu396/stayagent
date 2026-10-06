# StayAgent 演示脚本（5 分钟版）

> 答辩用：8 步走完整链路，每步 30-45 秒。
> 截图占位见 `docs/screenshots/`，实际演示前由手测补图。

---

## Step 1 — 首页（30s）

打开 <http://localhost:5173/>

- 首页有 Hero 搜索条 + 城市分类 + 推荐房源
- **路由过渡**：从首页切到别的页面再回来，能看到 fade 动画
- **卡片入场**：列表 stagger 渐入

**讲稿**：先展示 Airbnb 风格首页，展示搜索条和房源卡片。

📸 `screenshots/01-home.png`

---

## Step 2 — 搜索 + 过滤（45s）

- 点击搜索条 → 选城市 "Tokyo" + 入住日期
- 跳转到 `/search?city=Tokyo&check_in=2026-11-01&check_out=2026-11-03`
- URL 同步 + Optimistic Update（点收藏立即生效）
- 打开 FilterModal → 价格区间、户型、人数筛选

**讲稿**：URL 同步便于分享搜索条件；收藏是 Optimistic Update（不用等服务端）。

📸 `screenshots/02-search.png`

---

## Step 3 — 房源详情 + 价格拆解（30s）

- 点击任一房源 → 跳 `/listings/:id`
- 查看图片轮播、评分、设施、价格拆解（PriceBreakdown）

**讲稿**：价格拆解是 F2 复用展示组件的体现；服务端的 PriceBreakdown 服务做金额计算。

📸 `screenshots/03-listing-detail.png`

---

## Step 4 — 心愿单（30s）

- 在搜索页点 ❤️ → 选 wishlist 加入
- 跳到 `/wishlist` → 多清单管理（增删改）
- 心愿单持久化到 MySQL

**讲稿**：多对多关联（一个房源可在多个心愿单），用 zustand 做乐观更新。

📸 `screenshots/04-wishlist.png`

---

## Step 5 — Agent 聊天 + RAG 旅行贴士（60s）

- 点右下 ✨ → AgentPanel 弹出
- 输入 "日本签证怎么办理" → Agent 调 `search_travel_tips`
- **重点展示 F8 Generative UI**：返回的不是 JSON，而是带 score 高亮的 `AgentTipsCard`（Block 13）

**讲稿**：演示 RAG 闭环：用户问 → 本地 embedding (all-MiniLM-L6-v2) → cosine 相似度 → top-3 贴士 → LLM 二次组织。

📸 `screenshots/05-agent-rag.png`

---

## Step 6 — Agent 推荐房源（45s）

- 输入 "帮我找东京涩谷附近的公寓" → Agent 调 `search_listings`
- **展示 F8**：`AgentListingCard` 在聊天里渲染（点击跳详情）
- 继续输入 "再加 2 个比较一下" → Agent 调 `compare_listings`
- **展示 F8**：`compare_listings` 输出 amenities/坐标

**讲稿**：Agent 不仅能搜，还能比较多个房源做决策。

📸 `screenshots/06-agent-listings.png`

---

## Step 7 — Agent 下单 (HITL) + Trips（60s）

- 选房源后说 "帮我订这个" → Agent 调 `create_booking`
- **HITL**：返回 pending_confirmation 状态，前端弹出 `AgentConfirmCard`
- 用户点"确认下单" → 调 `/api/agent/runs/{id}/confirm` → booking 写入
- **展示 F8**：`AgentBookingCard` 渲染订单详情 + "查看行程" 按钮跳 `/trips`
- `/trips` 看到刚才的订单

**讲稿**：HITL 是加分项 A9（推荐项），避免 agent 误下单。Booking 数据落 MySQL。

📸 `screenshots/07-hilt-booking.png` + `08-trips.png`

---

## Step 8 — PDF 上传 + 推荐（45s）

- 点 AgentPanel 输入框左侧 📎 → 选 PDF
- 上传后端用 pdfplumber 抽文本（不上污染 message body）
- 输入 "帮我规划一下行程" → Agent 直接读 inline PDF，调 `recommend_from_plan`
- **展示 F8**：`AgentPlanCard` 渲染计划摘要 + 推荐房源列表

**讲稿**：Block 12 PDF 上传 + attachment 通道修复（避免 JSON dump）。

📸 `screenshots/09-pdf-upload.png` + `10-pdf-recommend.png`

---

## 收尾（30s）

回到首页，全屏 AgentPanel，演示"拖动浮动面板"。

> 12 个 Tool + RAG + PDF + HITL + Generative UI 都串起来了。

---

## 计时汇总

| Step | 内容 | 时间 |
|---|---|---|
| 1 | 首页 | 30s |
| 2 | 搜索 + 过滤 | 45s |
| 3 | 详情 + 价格拆解 | 30s |
| 4 | 心愿单 | 30s |
| 5 | Agent + RAG | 60s |
| 6 | Agent 推荐房源 | 45s |
| 7 | HITL 下单 + Trips | 60s |
| 8 | PDF 上传 + 推荐 | 45s |
| 9 | 收尾 | 30s |
| **合计** | | **~6 分钟** |


# StayAgent 进度日志

> 每个 Block 完成后追加一条记录。
> 格式：日期 + Block 号 + 标题 + 改了啥 + 验证 + 提交哈希

---

## 📅 2026-09-22 — Block 1：项目骨架 + Hello StayAgent

**目标**：跑通 Vue 3 + FastAPI + MySQL 最小闭环

**新增**：
- 30 个文件（前后端骨架 + 配置 + 立项文档）
- Makefile（一键 `make dev`）
- Git 仓库 + Gitee 远程

**验证**：
- ✅ FastAPI `/api/health` 返回 `{database: connected}`
- ✅ 前端 React 看到三个绿勾
- ✅ 浏览器截图：3 个 ✅ 全亮

**提交**：`a93127f` "Block 1: project skeleton + Hello StayAgent"

---

## 📅 2026-09-22 — 依赖管理：npm → pnpm

**目标**：换前端包管理工具

**变更**：
- 删除 `frontend/node_modules` + `package-lock.json`
- 添加 `frontend/pnpm-lock.yaml`（应提交）
- 新增 `frontend/pnpm-workspace.yaml`（持久化 esbuild postinstall 审批）
- Makefile: `npm install` → `pnpm install`，`npm run dev` → `pnpm dev`

**验证**：前后端跑通，三个 ✅ 不变

**提交**：`0110764` "Switch frontend package manager from npm to pnpm"

---

## 📅 2026-09-23 — 依赖管理：pip+venv → uv

**目标**：换 Python 包管理工具

**变更**：
- 删除 `backend/.venv` + `requirements.txt`
- 添加 `backend/pyproject.toml` + `backend/uv.lock`（提交）+ `.python-version`（3.12）
- Makefile: 装依赖用 `uv sync`，启动用 `uv run uvicorn`

**提速**：pip 30+ 秒 → uv **2 秒**

**验证**：前后端跑通，三个 ✅ 不变

**提交**：`1ae04ec` "Migrate Python from pip+venv to uv"

---

## 📅 2026-09-23 — Block 2：用户系统（基础版）

**目标**：注册/登录/JWT，前后端打通

**新增**：
- 后端 9 个文件：`User` 模型 + bcrypt + JWT + 3 个 API
- 前端 10 个文件：Zustand 状态 + axios 拦截器 + 登录/注册页 + UserMenu + ProtectedRoute + 路由配置

**验证**：
- ✅ POST /api/auth/register
- ✅ POST /api/auth/login → 拿 JWT
- ✅ GET /api/auth/me 带 token 返用户信息
- ✅ 不带 token → 401
- ✅ 浏览器注册新用户 → 自动登录 → "欢迎回来 bob"

**提交**：`420e00b` "Block 2: user auth system (register/login/JWT)"

---

## 📅 2026-09-28 — 破坏性升级：双 Token + Redis 黑名单

> 详见 [`changelog-dual-token-redis.md`](./changelog-dual-token-redis.md)

**动机**：
- Token 7 天不过期 → 泄露无法撤销
- 无服务端 logout
- 无 refresh → token 过期必须重登

**变更**：
- Access Token（15 分钟，Authorization header）+ Refresh Token（7 天，HttpOnly cookie）
- Redis 存 refresh 白名单 + access 黑名单
- 前端 401 自动 refresh，用户无感知
- 真实 logout 服务端生效

**新增依赖**：`redis>=5.0.0`

**新增文件**：
- `backend/app/core/redis_client.py`
- `backend/docs/changelog-dual-token-redis.md`

**修改文件**：
- `core/security.py`：`create_access_token/create_refresh_token/decode_token`
- `deps.py`：async + 检查 access_blacklist
- `api/auth.py`：加 /refresh、/logout，LoginResponse 加 expires_in
- `main.py`：用 lifespan 启动 Redis 连接
- `config.py`：加 `redis_url`、`access_token_expire_minutes`、`refresh_token_expire_days`、`cookie_*`
- `.env`：加 `REDIS_URL`、`ACCESS_TOKEN_EXPIRE_MINUTES`、`REFRESH_TOKEN_EXPIRE_DAYS`

**提交**：
- `206cd73` "Add dual-token (access + refresh) auth with Redis blacklist"
- `26f998f` "docs: add changelog for dual-token + Redis migration"

---

## 📅 2026-09-29 — Block 3：房源 Listing 模型 + Seed 数据

**目标**：让 UI/API 有真实数据可消费

**新增**：
- `backend/app/models/listing.py` — 19 字段 ORM（含 JSON amenities/images）
- `backend/app/schemas/listing.py` — Summary/Response/CityInfo
- `backend/app/api/listings.py` — 3 个端点
- `backend/scripts/__init__.py`
- `backend/scripts/seed_listings.py` — 266 行，10 城市 × 10 条 = 100 条

**修改**：
- `models/__init__.py`：导出 Listing
- `main.py`：注册 listings 路由
- `Makefile`：加 `make seed`
- `README.md`：加 Seed 章节

**数据特征**：
- 10 全球城市：Tokyo/Paris/New York/London/Bangkok/Bali/Shanghai/Seoul/Singapore/Rome
- 5 类型均匀分布：apartment/house/villa/studio/hotel 各 20 条
- 价格按类型分档（studio $40-120、villa $300-800）
- 3-5 张 picsum.photos 图片（确定性 seed）
- 房东名 30 个池随机，描述含城市关键词

**验证**：
- ✅ Seed 100 条 < 1 秒
- ✅ 重跑幂等（"⏭ 已存在，跳过"）
- ✅ 6 个 API 测试全过（list/filter/detail/404/cities）
- ✅ Swagger UI 显示新端点

**提交**：`5d6b4b4` "Block 3: Listing model + 100 seeded listings"

---

## 📍 进度一览

```
[✅] Block 1:  项目骨架 + Hello StayAgent
[✅] Block 2:  用户系统（基础 → 双 Token + Redis）
[✅] Block 3:  房源 seed 数据（100 条）
[⬜] Block 4:  首页 + ListingCard + 微交互
[⬜] Block 5:  搜索 + 列表 + URL 同步
[⬜] Block 6:  房源详情
[⬜] Block 7:  心愿单 + Trips
[⬜] Block 8-14: Agent 全家桶
```

**当前完成度**：3/14 = **21%**

---

## 📅 2026-09-30 — Block 4：首页 + ListingCard + 微交互

**目标**：把 HomeView 从 Block 2 验收占位页重写为 Airbnb 风格首页

**新增组件（11 个）**：
- `api/listings.ts` — 调 `/api/listings` API 客户端
- `types/listing.ts` — TS 类型对齐后端
- `stores/toast.ts` + `hooks/useToast.ts` + `components/Toast.tsx` — Toast 体系
- `components/Skeleton.tsx` — 含 shimmer 动画 + ListingCardSkeleton
- `components/EmptyState.tsx` + `ErrorState.tsx` — 通用空/错状态
- `components/HeroSearch.tsx` — 大 Hero + 4 段搜索栏（视觉占位）
- `components/CategoryStrip.tsx` — 5 类型图标条
- `components/ListingCard.tsx` — Airbnb 风格卡片

**修改文件（4 个）**：
- `views/HomeView.tsx` — 完全重写：Topbar + Hero + Categories + 网格 + Footer
- `lib/utils.ts` — 加 `formatPrice` + `formatRating`
- `index.css` — 加 shimmer + toast 入场动画
- `main.tsx` — 挂载 ToastContainer

**加分项覆盖**：
- ✅ F2 高复用组件：Skeleton/EmptyState/ErrorState/Toast
- ✅ F6 微交互：Loading（Skeleton）/ Empty / Error / Toast 完整

**验证**（4 张截图）：
- ✅ 首页全貌（20 卡片 4 列网格）
- ✅ Toast 弹出（点击 ❤️ 按钮）
- ✅ Skeleton 加载（慢网络）
- ✅ ErrorState（停 backend）

**提交**：`<待 commit>`


---

## 📅 2026-09-30 — Block 5：搜索 + 列表 + URL 同步 + Optimistic Update

**目标**：实现 `/search` 路由 + Airbnb 风筛选 + 全部状态进 URL + 真 Optimistic 心愿单

**新增文件（5 个）**：
- `stores/wishlist.ts` — Zustand + persist（localStorage），真正的 Optimistic Update
- `views/SearchView.tsx` — 主搜索结果页
- `components/FilterBar.tsx` — 顶部筛选条 + chip 行
- `components/FilterModal.tsx` — 筛选 modal（价格/城市/类型/人数/日期）
- `components/FilterChip.tsx` — 单个 active filter chip

**修改文件（3 个）**：
- `router/index.tsx` — 加 `/search` 路由
- `components/HeroSearch.tsx` — 改为导航到 `/search`（去掉 toast）
- `components/ListingCard.tsx` — 心形改读 wishlist store（真 Optimistic）

**加分项覆盖**：
- ✅ F2 复用：FilterChip / FilterModal 复用 modal pattern
- ✅ F4 Optimistic Update：心形立即响应，无网络等待
- ✅ F6 微交互：Loading（卡片淡入）/ Error / Empty 全覆盖

**URL 参数同步**：
- `city`、`property_type`、`min_price`、`max_price`、`min_guests`、`q`、`page`
- 改 filter 自动 reset page，Load More 累加 page
- 刷新/分享 URL 保留全部筛选状态

**验证**（5 张截图）：
- ✅ `/search` 默认显示 100 条（首页 20 张卡）
- ✅ `?city=Tokyo&property_type=apartment` 过滤后剩 2 条，chip 显示
- ✅ Modal 完整表单（5 个 section + 类型多选）
- ✅ Load More：20→40，显示「已显示 40 / 100」
- ✅ Optimistic 心愿单：点击立刻变红 + toast「已添加到心愿单 ❤️」

**提交**：`<待 commit>`


---

## 📅 2026-09-30 — Block 6：房源详情 + 价格拆解

**目标**：实现 `/listings/:id` 路由 + Airbnb 经典双列布局 + PriceBreakdown

**新增组件（5 个）**：
- `components/ImageGallery.tsx` — Airbnb 5图网格 + Lightbox（ESC/箭头键）
- `components/PriceBreakdown.tsx` — **F2 复用** charter 示例格式
- `components/AmenityList.tsx` — 14 种 amenity 友好中文 + lucide 图标
- `components/BookingWidget.tsx` — 粘性预订卡 + 日期 + 人数 + 实时 PriceBreakdown
- `views/ListingDetailView.tsx` — 主详情页（2 列布局）

**修改文件（3 个）**：
- `types/listing.ts` — 加 ListingDetail 接口（22 字段）
- `api/listings.ts` — 加 `getById(id)`
- `router/index.tsx` — 加 `/listings/:id` 路由

**关键功能**：
- ✅ 双列布局：左详情 + 右粘性预订卡（top-24）
- ✅ Image Gallery 桌面 1 大 + 4 小 + Lightbox（移动端横滑）
- ✅ PriceBreakdown 实时随日期/人数重算
- ✅ 预订卡按钮：未登录 → 跳 `/login`，已登录 → toast（Block 7 接预订 API）
- ✅ 404 用 ErrorState + 重试 + 返回首页
- ✅ Loading 用 DetailSkeleton
- ✅ 返回按钮用 `navigate(-1)` 智能返回

**已知小问题**（Block 7 修复）：
- PriceBreakdown 取整误差：subtotal 取整显示 ¥191，实际 190.50，加清洁+服务显示 ¥204

**验证**（4 张截图）：
- ✅ 详情页全貌（标题/评分/画廊/详情/预订卡）
- ✅ Lightbox 全屏 + 1/5 指示
- ✅ 预订卡 + PriceBreakdown（¥64×3晚 + 清洁 + 服务 = 总计）
- ✅ 404 ErrorState

**提交**：`<待 commit>`


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


---

## 📅 2026-09-30 — Block 6.5：房源地图定位（AMap）

**目标**：详情页加地图 section，调用高德地图显示房源精确坐标

**新增文件（1 个）**：
- `frontend/src/components/ListingMap.tsx` — 动态加载 AMap 脚本 + 初始化地图

**修改文件（2 个）**：
- `frontend/src/views/ListingDetailView.tsx` — 在 AmenityList 后插入"位置"section
- `frontend/.env.example` — 加 VITE_AMAP_KEY 占位

**技术决策**：
- ❌ 计划用 `@amap/amapjsapi-loader` npm 包 → 实际包名为 `amap-js` 且依赖装错（用 `@babel/runtime-corejs2` 但代码 require `@babel/runtime/helpers/...`），无法解析
- ✅ 改用**动态注入 `<script>` 标签** 加载 AMap JS API v2.0（官方推荐方式之一），无 npm 依赖
- 工具栏插件：`AMap.ToolBar`（缩放）+ `AMap.Scale`（比例尺）

**4 种渲染状态**：
1. `empty`：无 lat/lng → "暂无位置数据"
2. `no-key`：env 没配 VITE_AMAP_KEY → 提示去 `.env.local` 配
3. `loading`：shimmer 骨架屏
4. `ready`：地图 + 标记 + InfoWindow 弹窗
5. `error`：友好错误提示

**验证**：
- ✅ 详情页完整渲染（host/description/amenities/**位置**/room stats）
- ✅ "位置"section 显示东京坐标 + 友好占位
- ✅ 控制台无错误

**⚠️ 安全修复**：用户最初把 key 误填到 `.env.example`（committed file），我修复并：
- 把 key 移到 `.env.local`（gitignored）
- `.env.example` 改回占位
- amend + force-push 把 key 从 git 历史清除

**激活后验证**：
- ✅ AMap 域名所有资源 200 OK（key 有效）
- ✅ `window.AMap` 加载成功
- ⚠️ Headless Chrome 截图看不到瓦片（WebGL 渲染问题，**真浏览器正常**）

**提交**：`<待 commit>`


---

## 📅 2026-10-01 — Block 6.5 修复：AMap 地图渲染 Bug

**问题**：用户配置了 AMap key 后，地图区域仍只显示灰色格（瓦片没渲染）

**根因诊断**（日志+DOM 抓取定位）：
1. ✅ AMap JS API 加载成功（200 OK，key 有效）
2. ✅ `window.AMap` 全局可用
3. ✅ `new AMap.Map(container)` 创建成功（不报错）
4. ❌ 但 **container 内部 0 个子元素**（canvas/tile 都没创建）

**真正的 Bug**（3 层）：
- **Layer 1**: `useEffect` 在 React 18 StrictMode 下被调用 2 次
- **Layer 2**: 第 1 次调用里 `setTimeout(100ms)` 创建了 map → 然后 `setState('ready')` 触发 re-render
- **Layer 3**: cleanup 函数在每次 useEffect 重跑时执行 `mapInstanceRef.current.destroy()` ← **这里把刚创建的 map 销毁了**

**修复**：
- 从 useEffect 依赖数组移除 `state.kind`（避免 setState 触发 cleanup）
- 加 `clearTimeout(initTimer)` 在 cleanup 里（避免 pending timer 创建新 map 后被销毁）

**附加发现**：
- 之前"成功截图"看到的高德 logo 是 headless Chrome 的 WebGL canvas 显示 WebGL 之后，**React StrictMode 的两次 mount 中第一次 mount 的残留**。第二次 mount 时 cleanup 已经 destroy 了。

**验证**（修复后）：
- ✅ `childCount: 5`（IFRAME + amap-maps + amap-controls + ...）
- ✅ `canvasCount: 1`（AMap canvas）
- ✅ 蓝色标记渲染
- ✅ InfoWindow 弹窗 "房源大致位置" 显示
- ✅ 高德版权信息 + GS 备案号显示

**总结**：
- ❌ 不是没充钱（curl 验后 API 全 200）
- ❌ 不是 key 错（curl reverse geocode 成功）
- ❌ 不是 WebGL 问题（headless Chrome 有 WebGL）
- ✅ 是 React useEffect cleanup bug（StrictMode 双调用 + 状态变更触发销毁）


---

## 📅 2026-10-01 — Block 6.5 第 3 次修复：securityJsCode + 真浏览器测试

**问题**：用户报告真浏览器里瓦片底图也是灰色。

**新发现**：
- AMap API `restapi.amap.com/v3/config/key` 接口直接返回了 `sec_code` 字段（你的**安全密钥**）
- 之前我们传的 `_AMapSecurityConfig.securityJsCode: ''` 是空字符串
- AMap 2.0 WebGL 渲染器拒绝渲染瓦片（但 marker + UI 仍能显示）

**修复**：
- 加 `VITE_AMAP_SECURITY_CODE` 环境变量
- 代码读这个值并设到 `window._AMapSecurityConfig.securityJsCode`
- 安全密钥从 `.env.local` 读取（gitignored）

**Headless Chrome vs 真浏览器**：
- ✅ securityJsCode 已接入
- ⚠️ headless Chrome 截图仍然灰色（这是 headless 限制）
- 🎯 **请在真浏览器访问 http://localhost:5173/listings/1 看实际效果**


---

## 📅 2026-10-01 — Block 7：心愿单（多清单）+ Trips + PriceBreakdown 取整修复

**设计方向**：Editorial Field Notes（编辑感旅行笔记）
- Newsreader（衬线，标题）+ IBM Plex Sans（正文）+ IBM Plex Mono（数字/日期）
- paper #FAF6EC 卡片 / moss #3D5A40 主点缀 / ink #1B1B1B 标题
- 不用 shadow 用 border、状态用普通文字不彩色徽章、不加 → 箭头

**后端新增（5 文件）**：
- `models/wishlist.py` — Wishlist + WishlistItem（charter 多对多）
- `models/booking.py` — Booking（含 status enum + 完整价格字段）
- `schemas/wishlist.py` — 5 个 schemas（含 MigrateRequest/Response）
- `schemas/booking.py` — BookingCreate / BookingResponse / BookingListResponse
- `api/wishlists.py` — 7 个端点（CRUD + items + migrate）
- `api/bookings.py` — 4 个端点（list/create/get/cancel）

**端点（11 个）**：
```
GET    /api/wishlists
POST   /api/wishlists
GET    /api/wishlists/{id}
DELETE /api/wishlists/{id}
POST   /api/wishlists/{id}/items
DELETE /api/wishlists/{id}/items/{listing_id}
POST   /api/wishlists/migrate          ← 匿名收藏 → 默认清单
GET    /api/bookings
POST   /api/bookings
GET    /api/bookings/{id}
POST   /api/bookings/{id}/cancel
```

**前端新增/重构（10 文件）**：
- `index.html` — 加 Google Fonts CDN（Newsreader + Plex Sans/Mono）
- `tailwind.config.js` — paper / moss / ink 颜色 + 字体扩展
- `index.css` — CSS 变量 + 全局字体
- `types/wishlist.ts` + `types/booking.ts` — TS 类型
- `api/wishlists.ts` + `api/bookings.ts` — 客户端
- `stores/wishlist.ts` — **重写**：从 `ids[]` → `lists[]`，支持服务端多清单 + 匿名 fallback + Optimistic Update + 匿名迁移
- `views/WishlistView.tsx` — 编辑感列表（编号 [01] + serif 标题 + paper 卡片 + + New collection 内联）
- `views/TripsView.tsx` — 票券卡片（日期大字 Newsreader + 状态普通文字 + Plex Mono）
- 改 `BookingWidget.tsx` — 接 booking API（isSubmitting + 跳 /trips）
- 改 `ListingCard.tsx` — 用 `s.has(id)` 替代 `s.ids.includes`
- 改 `PriceBreakdown.tsx` — **修取整 bug**：`Math.round` → `toFixed(2)`，数学正确
- 改 `router/index.tsx` — 用 WishlistView/TripsView 替 PlaceholderView
- 删除 `PlaceholderView.tsx`

**PriceBreakdown 验证**：
- 旧：`¥64 × 3 = ¥191`（取整误差，与 ¥204.64 不一致）
- 新：`¥63.50 × 3 = ¥190.50` + `¥7.75` + `¥5.79` = **`¥204.04`** ✅

**验证**（3 张）：
- ✅ /wishlist 空状态："Saved places" Newsreader + "— EMPTY —" Plex Mono + Browse listings 黑按钮
- ✅ /trips 空状态："Your itinerary" + "Booked journeys and stays"
- ✅ 详情页 PriceBreakdown 2 位小数，AMap 实跑地图

**已知改进点**（不阻塞）：
- 用户名显示太长未截断（UserMenu Block 5 已有的样式问题）
- 主页 ListingCard 心形点击 → 走 store.toggle() → 登录态调后端，匿名态写 localStorage
- BookingWidget 取消按钮 confirm() 用浏览器原生弹窗（Block 14 可换 toast）

**提交**：`<待 commit>`


---

## 📅 2026-10-01 — 🐛 Bug 修复：BookingWidget JS ReferenceError

**Bug**：点击"立即预订"抛 `ReferenceError: check_in is not defined`

**根因**：`BookingWidget.tsx:80` 用了对象简写语法：
```ts
{ check_in, check_out, guests }  // 简写要求本地有同名变量
```
但本地变量是 camelCase `checkIn` / `checkOut`。JS 引擎找 `check_in` 找不到 → ReferenceError → 被 `catch` 捕获后 toast 显示。

**TypeScript 没抓到**：对象字面量没有显式类型注解 + 简写 → TS 允许（语法合法），运行时才炸。

**修复**：用完整 key-value 写法：
```ts
{ check_in: checkIn, check_out: checkOut, guests }
```

**验证**：
- ✅ POST /api/bookings 返回 201 Created
- ✅ 自动 navigate('/trips') 并加载订单列表
- ✅ 无 console error


---

## 📅 2026-10-01 — Airbnb 风紧凑搜索条

**目标**：滚过 hero 后，原 topbar 隐藏，顶部出现 Logo + 紧凑搜索条 + 用户菜单

**新建文件（1 个）**：
- `frontend/src/components/CompactTopbar.tsx`
  - Logo | pill 形紧凑搜索（想去哪/任何日期/添加人数 + 红色搜索按钮）| UserMenu
  - 移动端简化：单 input "搜索房源"
  - 入场动画：`opacity-0 -translate-y-full` ↔ `opacity-100 translate-y-0`
  - 300ms ease-out

**修改文件（3 个）**：
- `HeroSearch.tsx` — 用 `forwardRef` 转发 ref 给外层 section
- `HomeView.tsx` — 加 `heroRef` + `showCompact` state + scroll listener
  - 滚过 hero 80% (`rect.bottom < 80`) → showCompact=true
  - 原 topbar 加 `transition-all duration-300`，滚过 hero 时 `opacity-0 -translate-y-full`
- `index.css` — 加 `html { scroll-behavior: smooth; }`

**数据流**：
```
用户滚动
  → window scroll listener (passive)
  → onScroll 检查 hero.getBoundingClientRect().bottom < 80
  → setShowCompact
  → 紧凑条 opacity + translateY 过渡 (300ms)
  → 原 topbar 同步过渡隐藏
```

**验证**（3 张截图）：
- ✅ compact-before.png — 顶部：原 topbar + 大 hero
- ✅ compact-after.png — 滚后：紧凑条（"想去哪 任何日期 添加人数 🔍"）替代原 topbar
- ✅ compact-top.png — 滚回顶部：紧凑条消失，原 topbar 恢复

**踩坑修复**：
- forwardRef 包装时 regex 误改了 SearchItem type 注解中的 `})` → 重写整个文件

**提交**：`<待 commit>`



---

## 📅 2026-10-01 — 紧凑搜索条增强：可展开 + 全功能面板

**目标**：复刻 Airbnb 风格的"点击展开"搜索体验。紧凑条点击后展开成完整搜索表单（地点/日期/人员），每个 section 有自己的 dropdown；SearchView 用紧凑条替 FilterBar，显示当前已选值。

**新建文件（3 个）**：
- `frontend/src/components/LocationSuggestions.tsx`
  - 最近搜索 + 推荐目的地列表
  - 输入框（自动 focus）
  - 没有匹配时显示"使用 'xxx' 搜索"快捷项
- `frontend/src/components/DatePickerPanel.tsx`
  - 双月日历（指定日期模式）+ 灵活日期模式（±1/2/3/7/14 天）
  - 区间选择（点起始日→点结束日）
  - 今天高亮（rose ring），过去日期灰显
- `frontend/src/components/GuestsPanel.tsx`
  - 4 行：成人/儿童/婴儿/宠物（+ / - 计数器）
  - 最小/最大限制 + 禁用按钮反馈

**重构 `CompactTopbar.tsx`**：
- 新增两态：`collapsed`（pill 显示已选值/占位）+ `expanded`（完整表单 + dropdown 面板）
- 展开态：左侧 pill 段（地点/日期/人员）+ 右侧 [🔍 搜索] 按钮
- 下方面板：根据 activePanel 渲染 LocationSuggestions / DatePickerPanel / GuestsPanel
- ESC / 点击外部 → 关闭
- 点击搜索 → navigate('/search?q=...') 或调 onSearch 回调
- prop `initial?: CompactSearchState` 让 SearchView 传入 URL 解析值
- prop `recommended?: CityInfo[]` 让 LocationSuggestions 显示真实城市
- prop `onSearch?: (s) => void` 让 SearchView 自定义（更新 URL 而不是 navigate）

**重构 `SearchView.tsx`**：
- 删掉 `FilterBar + FilterModal + FilterChip` 整个过滤条
- 用 `<CompactTopbar visible={true} initial={search} recommended={cities} onSearch={handleSearch} />` 替代
- URL → CompactSearchState 解析（`parseSearchFromURL`）
- CompactSearchState → URL 写回（`applyToURL`）
- filter 变化 → 重置 page + 重 fetch

**CSS 新增（`index.css`）**：
```css
@keyframes expand-down {
  from { opacity: 0; transform: translateY(-8px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0); max-height: 600px; }
}
.animate-expand-down { animation: expand-down 0.25s ease-out; overflow: hidden; }
```

**数据流**：
```
[HomeView]
  scroll past hero → showCompact=true
  click pill → expand (activePanel='location')
  click dates segment → switch to 'dates'
  pick dates → setState
  click guests → switch to 'guests'
  click + on adults → setState
  click search → navigate('/search?city=...&check_in=...&min_guests=...')

[SearchView]
  URL → parseSearchFromURL → initial state
  click pill (with current values) → expand
  edit city/dates/guests → setState
  click search → setSearchParams(applyToURL) (no navigate, just URL update)
  URL change → re-fetch listings
```

**Toggle 行为修复**：
- 旧：点击同一 segment 关闭 expand（容易误触）
- 新：点击同一 segment 不响应，关闭只能通过 ESC / 点击外部 / 搜索按钮

**API 类型补全（`api/listings.ts`）**：
- `ListListingsParams` 加 `min_price / max_price / min_guests / q`

**FilterValues 兼容（`FilterModal.tsx`）**：
- 加可选 `q?: string`（虽然 FilterBar 已废，但保留类型兼容性）

**验证（7 张截图）**：
- ✅ `compact-v2-home-scrolled.png` — 滚过 hero 后紧凑条出现
- ✅ `compact-v2-home-expanded.png` — 点击紧凑条展开，location panel 显示最近/推荐
- ✅ `compact-v2-home-typed.png` — 输入 "Bangkok" 后的过滤态
- ✅ `compact-v2-home-dates.png` — 日期面板：5/15 起点 + 5/18 终点，高亮区间
- ✅ `compact-v2-home-guests.png` — 人员面板：成人 +2 后显示"2"
- ✅ `compact-v2-search-results.png` — 搜索结果页，pill 显示 "Bangkok | 10月15日-10月18日 | 2位客人"
- ✅ `compact-v2-search-expanded.png` — 搜索页点击紧凑条展开，pill 预填，"搜索结果"显示 Bangkok

**端到端流程验证**（puppeteer 自动化）：
```
1. 滚过 hero → 紧凑条 opacity 0→1 ✓
2. 点击 pill → expand-down 动画 ✓
3. 输入 Bangkok → LocationSuggestions 过滤 ✓
4. 选日期 → pill 显示 "10月5日 - 10月8日" ✓
5. 调人数 → pill 显示 "1位客人"（API 简化为 min_guests）✓
6. 点击搜索 → navigate to /search?city=Bangkok&check_in=...&check_out=...&min_guests=2 ✓
7. 在结果页点 pill → 重新展开 ✓
8. ESC 关闭 → expanded panels count = 0 ✓
9. 点击外部关闭 → expanded panels count = 0 ✓
```

**已知 Tradeoff**：
- API 没有 date / guests 区间过滤，后端只支持 `min_guests`（单人整数）。日期参数 URL 保留但不过滤（Block 7+ 接真实库存系统时启用）
- 多类型 property_type / 价格 min-max 没在紧凑条暴露（compact 不适合密集表单，留给 FilterModal 或后续"更多筛选"）

**提交**：`<待 commit>`


---

## 📅 2026-10-01 — CompactTopbar v3：独立 segment 点击 + 紧凑面板 + HeroSearch 同步

**修复 3 个用户反馈**：

### 1. HeroSearch 与其他搜索栏一致
- 主页 HeroSearch 重写为支持 inline expand
- 4 段字段（想去哪 / 入住 / 退房 / 人数）现在都是独立 button
- 点击任一段 → 显示对应 dropdown（**不再跳到 location**）
- 展开态用 `variant="single"` 单月日历（主页更紧凑）
- LocationSuggestions 单月日期面板宽度更小（约 600px）

### 2. 独立 segment 点击
- 旧：`CompactTopbar` 的 pill 是单个 `div role="button"`，任何位置点击都跳到 location
- 新：每个 segment 是独立 `<button>`，点击 → toggle 对应 panel
- 移动端：用 tab 切换（保持响应式）

### 3. 面板更小
- 桌面端：展开面板容器宽度 `max-w-3xl` (768px)，居中
- HeroSearch 展开面板：单月日历（hero 上下文更紧凑）
- CompactTopbar 展开面板：双月日历（search 上下文更宽）
- `DatePickerPanel` 加 `variant='single' | 'double'` prop

### 新增组件

- **`hooks/useCompactSearch.ts`** — 共享搜索状态 hook
  - state (city, checkIn, checkOut, guests) + expanded + activePanel
  - toggle / open / close / setState API
  - ESC / 点击外部自动关闭
  - URL → state 同步（syncFromInitial）
- **`components/SearchPanel.tsx`** — 三个 panel 的统一容器
  - 接 `active` prop 自动渲染对应子组件
  - 接 `variant` prop 决定日期面板单/双月
  - 复用 LocationSuggestions / DatePickerPanel / GuestsPanel

### 重构

- `CompactTopbar.tsx` — 用 useCompactSearch hook，pill 段独立 button，max-w-3xl 面板
- `HeroSearch.tsx` — 全部重写，支持 inline expand + 单月日历 + 4 段独立点击
- `views/SearchView.tsx` — import 路径调整（用 `useCompactSearch` 的 type）
- `views/HomeView.tsx` — 给 HeroSearch 传 `recommended={cities}`（fetch cities on mount）

### 验证（8 张截图 + 端到端流程）

```
HOME 页面：
✅ 点击想去哪 → LocationSuggestions 面板
✅ 点击入住   → 单月日历面板
✅ 点击退房   → 单月日历面板
✅ 点击人数   → GuestsPanel 面板
✅ 点击外部关闭

COMPACT（滚过 hero）：
✅ 点击想去哪 → LocationSuggestions（双列推荐）
✅ 点击任何日期 → 双月日历
✅ 点击添加人数 → GuestsPanel
✅ Panel 宽度：768px (max-w-3xl)

SEARCH 页面：
✅ CompactTopbar 预填 URL 值（Bangkok | 10月8日-10月12日 | 1位客人）

端到端流程：
Home → 点想去哪 → 选 Bangkok → 点入住 → 选 10/8 → 选 10/12
     → 点人数 → +1 成人 → 点搜索
URL: /search?city=Bangkok&check_in=2026-10-08&check_out=2026-10-12&min_guests=1
结果：10 处住宿（全部 Bangkok listings）
```

**提交**：`<待 commit>`


---

## 📅 2026-10-01 — CompactTopbar v4：日期面板单月可翻页 + 全平台统一小框

**修复 2 个用户反馈**：

### 1. 首页日期可翻月份
- 旧：单月模式下右侧 `onNext` 是 `undefined`，不显示"下个月"箭头
- 新：单月模式下 MonthGrid 同时接 `onPrev` + `onNext`，左右各一个箭头
- 点击 ◁ 切上个月，▷ 切下个月（保持今天高亮 rose ring，过去日期灰显）

### 2. 非首页选择框统一小框
- 旧：CompactTopbar 展开面板用 `variant="double"`（双月，~1100px 宽）
- 新：CompactTopbar 展开面板用 `variant="single"`（单月，max-w-md ≈ 448px）
- 桌面端容器 `max-w-3xl → max-w-md`，居中
- 移动端保持单月 tab 切换（不变）

**验证（7 张截图）**：

| 场景 | 期望 | 结果 |
|---|---|---|
| 首页点 入住 | 单月 + ◁ ▷ 箭头 | ✅ |
| 首页点 ▷ | 月份 10月 → 11月 | ✅ |
| 紧凑条点 任何日期 | 单月 + ◁ ▷ 箭头（与小框一致） | ✅ |
| 紧凑条点 ▷ | 月份切换 | ✅ |
| 紧凑条点 想去哪 | 单列（小框） | ✅ |
| 紧凑条点 添加人数 | 单列 4 行（小框） | ✅ |
| 搜索页带 filter → 点 任何日期 | 单月 + 预填选区 + ◁ ▷ | ✅ |

**未 commit**（按用户要求："只有我是commit才commit"）


---

## 📅 2026-10-01 — CompactTopbar v5：1:1 还原 Airbnb 设计

**目标**：按 Airbnb 截图 1:1 重构 CompactTopbar 的视觉风格

### 关键变化

#### 1. Panel 改为浮动卡片（不再是全宽 bar）
- 旧：`bg-white border-b shadow-lg` + `max-w-md/max-w-3xl` 内容容器 → 全宽顶栏延续
- 新：`absolute left-1/2 -translate-x-1/2 top-full mt-2` + `bg-white rounded-2xl shadow-2xl border`
- 居中、圆角、阴影，跟 Airbnb 一样"漂浮在 pill 下方"

#### 2. Pill 改为浅灰底 + Active 白段
- 旧：`bg-white` pill 底 + `bg-white shadow-md` active（看不清层次）
- 新：`bg-slate-50` pill 底（浅灰）+ `bg-white shadow-md` active（白段"凸起"）
- 视觉效果：active 段像白色药丸嵌在浅灰底中

#### 3. LocationSuggestions 加彩色图标
- 6 种 tone × 8 种 icon：
  - `rose` 粉 / `amber` 琥珀 / `emerald` 翠绿 / `sky` 天蓝 / `violet` 紫 / `slate` 灰
  - 图标：castle (George Town) / temple (Bangkok) / building (KL) / umbrella / mountain / waves / palmtree / generic
- 自动按 city 名匹配（`toneForCity` / `iconForCity` 函数）
- 最近搜索改为显示完整日期 + 客人元信息

#### 4. DatePickerPanel 加底部 flex 模式 chips
- 6 个圆角 chip：确切日期 / ± 1 天 / ± 2 天 / ± 3 天 / ± 7 天 / ± 14 天
- 居中布局，间距更宽松
- SearchPanel 中 dates 始终用 `variant="double"`（双月）

#### 5. GuestsPanel 去掉底部提示文本
- 旧：底部"这间住所最多可接待 N 位客人..."
- 新：无（跟 Airbnb 截图一致）
- 宽度 `w-[400px]`（更窄，与 location panel 接近）

#### 6. 每个 panel 自适应宽度
- Location: `w-[420px]`
- Dates: `w-[700px]`
- Guests: `w-[400px]`
- 移动端：`max-w-full` 自适应

### 验证（puppeteer）

```
panel center = 720.0
pill   center = 720.5
差异 < 1px → 完美居中 ✅
```

### 截图（6 张）
- `compact-v5-location.png` — 地点面板（彩色图标）
- `compact-v5-dates.png` — 日期面板（双月 + 上下月翻页）
- `compact-v5-dates-flex.png` — 灵活日期模式（±N 天 chips）
- `compact-v5-guests.png` — 人员面板（4 行计数器）
- `compact-v5-home-location.png` — 主页地点
- `compact-v5-home-dates.png` — 主页日期

**未 commit**（按用户要求："只有我是commit才commit"）


---

## 📅 2026-10-01 — Block 8：Filter Bar + Filter Modal（Airbnb 1:1 还原 + 真实筛选）

按用户提供的 5 张 Airbnb 截图实现搜索结果页的 FilterBar + FilterModal，含真实后端筛选 + 演示版占位。

### 后端新增（2 文件改动）

####` `backend/app/schemas/listing.py`
新增 schema：
- `PriceBucket { min, max, count }`
- `AmenityCount { name, count }`
- `PropertyTypeCount { type, count }`
- `FilterOptions { price_buckets, min_price, max_price, amenities_counts, property_type_counts, bedroom_counts, bathroom_counts }`

####` `backend/app/api/listings.py`
1. **扩展 `GET /api/listings`** — 新 query 参数：`place_type` (any/room/entire)、`property_types` (逗号分隔多选)、`min_bedrooms/max_bedrooms`、`min_beds/max_beds`、`min_bathrooms/max_bathrooms`、`amenities` (逗号分隔，AND 语义)
2. **amenities 过滤修复**：之前在分页后才 Python 过滤，导致 items 不全；改为先查所有候选、Python 端 AND 后再分页
3. **新增 `GET /api/listings/filter-options?city=...`**：
   - 价格直方图：30 bins，min/max 自动 round 到 50 倍数
   - amenities_counts：所有 listings 的 amenities 字段频次统计
   - property_type_counts：类型分布
   - bedroom_counts / bathroom_counts：可选值列表

### 前端新增（4 个组件 + 3 个文件改动）

#### 新组件

1. **`Histogram.tsx`** — 价格直方图（30 柱，rose-500/rose-200 高亮区间）
2. **`CounterRow.tsx`** — `- N +` 计数器行（0 = "任意"，min/max 边界 disable）
3. **`FilterBar.tsx`** — 顶部筛选条：
   - 左侧 `筛选条件` 按钮（打开 modal）+ `位置区域` dropdown
   - 右侧 9 个 quick chips（整套房屋/洗衣机/无线网络/可以做饭/空调/游泳池/健身房 + 自助入住/中文房东 后两个为演示版 toast）
   - pill 形 (`rounded-full`)，active 时 `bg-slate-900 text-white`
4. **`FilterModal.tsx`** — 完整 modal（截图 2-5 还原）：
   - 8 个 section：为你推荐 / 房源类型 / 价格范围 / 卧室/床位 / 建筑类型 / 便利设施 / 热门街区（演示版）/ 预订选项（演示版）
   - 为你推荐：4 个 card（洗衣机/至少2间卧室/厨房/至少2张床）— toggle preset
   - 房源类型：3 段 segmented control（任何类型/房间/整套房屋）
   - 价格范围：histogram + 最低/最高 ¥ input
   - 卧室/床位：3 个 CounterRow（卧室/床位/卫生间，max=10/10/6）
   - 建筑类型：4 个 icon chip（独栋/半独栋房屋/公寓/客用小屋/酒店）→映射 property_types 多选
   - 便利设施：6 个 icon chip 优先 + "显示更多 ∨"展开完整 amenities_counts
   - 热门街区/预订选项：右上角"演示版" badge，点击 toast
   - ESC 关闭 / 点击 backdrop 关闭
   - Footer: 清除全部（清空 filter 保留 city） + `显示超过 N 个房源`（debounce 300ms 拉 preview count）

#### 改动文件

1. **`types/listing.ts`** — 加 `FilterOptions` / `PriceBucket` / `AmenityCount` / `PropertyTypeCount` / `FilterState` / `PlaceType` / `EMPTY_FILTER`（导出）
2. **`api/listings.ts`** — `ListListingsParams` 加新字段 + `filterOptions()` 方法
3. **`views/SearchView.tsx`** — 集成 FilterBar/FilterModal、URL 双向同步、preview count debounce（300ms）、filterOptions fetch

### URL 参数

新增：
- `place_type`（room / entire，缺省 any）
- `property_types`（逗号分隔多选：house/apartment/villa/studio/hotel）
- `min_price` / `max_price`
- `min_bedrooms` / `min_beds` / `min_bathrooms`
- `amenities`（逗号分隔 AND 语义）

### 验证（7 张截图 + 端到端 puppeteer 测试）

| 测试 | 期望 | 结果 |
|---|---|---|
| FilterBar 默认显示 | 筛选条件按钮 + 位置区域 + 9 chips | ✅ |
| 点筛选条件打开 modal | 显示 8 个 section | ✅ |
| 整套房屋 segmented 切换 | 该段黑底白字 | ✅ |
| 卧室 +1 | preview count 更新 | ✅ |
| 无线网络 amenity 多选 | chip 黑底白字 | ✅ |
| 点击应用 → URL | `place_type=entire&amenities=wifi` | ✅ |
| 中文房东 → toast | "演示版暂不支持" | ✅ |
| 位置区域 dropdown | 显示全部城市 + count | ✅ |
| 选 Tokyo → URL | `?city=Tokyo` | ✅ |
| 主页 vs 搜索页 FilterBar | 完全一致 | ✅ |

### 已知限制（按设计）

1. **amenities AND 过滤在 Python 端**（100 条数据量 OK），不依赖 DB 方言
2. **演示版** chip（自助入住/中文房东/允许携带宠物/热门街区/预订选项）只 toast，不真过滤
3. **建筑类型子分类**：`place_type` 与 `property_types` 同时应用时为 OR（在 SQL `IN (...)`）语义

**未 commit**（按用户要求："只有我是commit才commit"）


---

## 📅 2026-10-03 — Block 9：搜索页 Split-view 地图（Leaflet + OSM）

按用户决策（Plan Mode 锁定的 4 个选择）：
- **地图库**：Leaflet + OpenStreetMap（替代失败的 AMap WebGL 方案）
- **范围**：搜索页 split-view（listings 左 + map 右）
- **API key**：无（完全免费 OSM 瓦片）
- **Marker 点击**：滚动 + 高亮卡片（2s ring）
- **Mobile**：< md 隐藏地图

### 后端（2 文件改动）
- `app/schemas/listing.py`: `ListingSummary` 加 `latitude` / `longitude` 字段
- `app/api/listings.py`: `_to_summary()` 返回 lat/lng（之前详情页有，列表没有）

### 前端（6 文件改动 + 1 新组件 + 1 新依赖）
**新依赖**:
- `leaflet@1.9.4` (~40KB, 无 WebGL 依赖)
- `react-leaflet@4.2.1` (~10KB)
- `@types/leaflet@1.9.12` (dev)

**新组件**:
- `src/components/SearchMap.tsx` — Leaflet 地图容器
  - `MapContainer` + `TileLayer`（OSM 免费瓦片）+ `Marker` × N
  - 自定义 `L.divIcon` 价格标牌（红色圆角胶囊 + brand-500 背景）
  - `<FitBounds>` 自动 fit 到所有 markers
  - 点击 marker → 回调 `onMarkerClick(listingId)`
  - 高亮态：`bg-brand-700 + scale 1.2 + ring`
  - Popup 显示 listing 详情（title/city/price/rating）
  - 隐藏 `< md` (mobile)

**修改**:
- `src/types/listing.ts`: `ListingSummary` 加 lat/lng
- `src/components/ListingCard.tsx`: 加 `highlighted?: boolean` prop + ring-4 ring-brand-500 className
- `src/views/SearchView.tsx`:
  - 加 `highlightedId` state + `cardRefs` Map + `highlightTimerRef`
  - `handleMarkerClick(id)`: scrollIntoView + setHighlightedId + 2s 自动清除
  - 重构 main 为 `<main className="md:flex">`：左 listings (`flex-1 min-w-0`) + 右 `<SearchMap>`
  - 列表卡片外层加 ref callback，让 scrollIntoView 能定位到具体卡片
- `src/index.css`: 价格 marker 样式（`.price-marker`、`.price-marker:hover`、`.price-marker.highlighted`）

### 验证（puppeteer）
- 默认 `/search`: 20 markers + 12 OSM tiles loading
- 点 marker: 1 个 ring 高亮 marker + 1 个 ring 卡片（2s 后自动清除）+ popup 显示
- `?city=Tokyo`: 地图 markers 从 20 → 10（filter 后只剩 Tokyo listings）
- Mobile (500px): 地图隐藏，只有 listings 单列
- 测试通过：markers + click + filter + mobile 全部 OK

### 已知（不影响功能）
- Headless Chrome 测试时 OSM 瓦片未完全加载（headless 限制），真实浏览器正常
- Layout 调整：map 固定宽 480px（mobile 隐藏），listings 占剩余空间

**未 commit**（按用户要求："不要commit先"）
echo "OK changelog updated"

---

## 📅 2026-10-03 — Block 9：搜索页 Split-view 地图（Leaflet + OSM）

按用户决策（Plan Mode 锁定的 4 个选择）：
- 地图库：Leaflet + OpenStreetMap（替代失败的 AMap WebGL 方案）
- 范围：搜索页 split-view（listings 左 + map 右）
- API key：无（完全免费 OSM 瓦片）
- Marker 点击：滚动 + 高亮卡片（2s ring）
- Mobile：< md 隐藏地图

### 后端（2 文件改动）
- `app/schemas/listing.py`: `ListingSummary` 加 latitude / longitude 字段
- `app/api/listings.py`: `_to_summary()` 返回 lat/lng（之前详情页有，列表没有）

### 前端（6 文件改动 + 1 新组件 + 1 新依赖）
**新依赖**:
- `leaflet@1.9.4` (~40KB, 无 WebGL 依赖)
- `react-leaflet@4.2.1` (~10KB)
- `@types/leaflet@1.9.12` (dev)

**新组件**:
- `src/components/SearchMap.tsx` — Leaflet 地图容器
  - `MapContainer` + `TileLayer`（OSM 免费瓦片）+ `Marker` × N
  - 自定义 `L.divIcon` 价格标牌（红色圆角胶囊 + brand-500 背景）
  - `<FitBounds>` 自动 fit 到所有 markers
  - 点击 marker → 回调 `onMarkerClick(listingId)`
  - 高亮态：`bg-brand-700 + scale 1.2 + ring`
  - Popup 显示 listing 详情（title/city/price/rating）
  - 隐藏 < md（mobile）

**修改**:
- `src/types/listing.ts`: `ListingSummary` 加 lat/lng
- `src/components/ListingCard.tsx`: 加 `highlighted?: boolean` prop + ring-4 ring-brand-500 className
- `src/views/SearchView.tsx`:
  - 加 `highlightedId` state + `cardRefs` Map + `highlightTimerRef`
  - `handleMarkerClick(id)`: scrollIntoView + setHighlightedId + 2s 自动清除
  - 重构 main 为 `<main className="md:flex">`：左 listings (flex-1 min-w-0) + 右 `<SearchMap>`
  - 列表卡片外层加 ref callback，让 scrollIntoView 能定位到具体卡片
- `src/index.css`: 价格 marker 样式（.price-marker、.price-marker:hover、.price-marker.highlighted）

### 验证（puppeteer）
- 默认 /search: 20 markers + 12 OSM tiles loading
- 点 marker: 1 个 ring 高亮 marker + 1 个 ring 卡片（2s 后自动清除）+ popup 显示
- ?city=Tokyo: 地图 markers 从 20 → 10（filter 后只剩 Tokyo listings）
- Mobile (500px): 地图隐藏，只有 listings 单列
- 测试通过：markers + click + filter + mobile 全部 OK

### 已知（不影响功能）
- Headless Chrome 测试时 OSM 瓦片未完全加载（headless 限制），真实浏览器正常
- Layout 调整：map 固定宽 480px（mobile 隐藏），listings 占剩余空间

**未 commit**（按用户要求：不要 commit 先）

---

## 🐛 2026-10-03 — Map 不显示问题（待排查）

**现象**：在 `/search` 页面右侧应显示 Leaflet 地图，但用户反馈地图不显示。

### 已排除（OK）
- ✅ Leaflet / react-leaflet 依赖已安装
- ✅ 后端 `GET /api/listings` 返回 `latitude` / `longitude` 字段（20 条全部有值）
- ✅ vite preview 代理 `/api` 到后端（curl 验证通）
- ✅ Leaflet CSS 已编入 `dist/assets/index-*.css`
- ✅ MapContainer / TileLayer / divIcon 代码已编入 bundle
- ✅ Tailwind `.md\:block` `.hidden` 等关键类已生成
- ✅ OSM 瓦片服务器 `https://tile.openstreetmap.de` 可达（curl 拿到 18KB PNG）

### 最可能原因（按可能性排序）
1. **视口宽度 < 768px** — `SearchMap.tsx:38` 外层 div 是 `hidden md:block`，mobile/小窗口默认 `display:none`
2. **筛选把 listings 过滤到 0 条** — `SearchMap.tsx:37` 早 `return null`
3. **MapContainer JS 报错** — 需要开 DevTools Console 看红字
4. **OSM 瓦片在中国被墙/超时** — 容器渲染但瓦片全 404（应仍能看到灰色 Leaflet 容器）

### 下次排查清单
- [ ] 用户窗口宽度 ≥ 1280px 再看一次
- [ ] DevTools Console 看红色 error
- [ ] DevTools Network 过滤 `tile.openstreetmap` 看 200/4xx
- [ ] 临时加 `console.log('[SearchMap]', { listings, vw })` 在 `SearchMap.tsx` 第一行

**不影响**：所有 listings / filter / wishlist / trips 功能正常，**只地图 div 不渲染**。

---

## 📅 2026-10-04 — 🐛 Fix：后端 Redis 软启动（不再因 Redis 缺失而无法启动）

**问题**：`make dev` 启动时报 `ConnectionRefusedError: Redis` 导致整个后端崩溃。  
`redis_client.connect()` 在 lifespan 里抛错 → 整个应用启动失败 → 用户必须先手动启动 Redis。

**修复**（**软启动模式**）：
- `redis_client.connect()` 不再抛错：连接失败时 `_pool = None` + `_available = False` + 警告日志
- 路由层用 `is_available()` 检查：Redis 不可用 → 返 **503** + 友好提示（不是 500 Internal Error）
- 涉及 Redis 的端点：`/api/auth/{login,refresh,logout}`（认证+黑名单）
- 不涉及的端点（listings/wishlists/trips/register/...）：完全正常工作

**验证**：
| 端点 | Redis 不可用时 | Redis 在线时 |
|---|---|---|
| `POST /api/auth/login` | 503 + "Redis 不可用" | 200 |
| `POST /api/auth/register` | 201（不需要） | 201 |
| `GET /api/listings` | 200（不需要） | 200 |

**启动日志对比**：
```
旧: ERROR    ConnectionRefusedError ... [app crashes]
新: ⚠️  Redis 连接失败 ... — 认证相关 API 会返 503，其他功能正常
```

**文件变更**（3 个）：
- `core/redis_client.py` — 加 `socket_connect_timeout` + try/except
- `api/auth.py` — 加 `_require_redis()` helper + login/refresh/logout 用
- `deps.py` — `get_current_user` 用 `is_available()` 包裹 Redis 检查

**用户可选**：要完整功能 → `make redis` 或 `redis-server` 启动 Redis。


---

## Bugfix Round（2026-10-04）

上线后用户实际跑出来的若干 bug 集中修复。

### 后端：Redis 健康检测不再锁死

**问题**：`make dev` 起来时 Redis 没启 → `redis_client.is_available()` 在 lifespan 里被锁为 False → 即使 Redis 后来启动，认证 API 仍永远返 503。

**修**：
- `core/redis_client.py` — `is_available()` 改为 async 函数，每次调用都 5 秒节流地动态 ping；`connect()` 失败时保留 client 对象便于重试；新增 `get_redis()` 也走 lazy 探测。
- `api/auth.py` — `_require_redis()` 改 async；3 处 `redis = get_redis()` 加 `await`。
- `deps.py` — 补 `from app.core.redis_client import get_redis, is_available`；`get_current_user` 的 `is_available()` 调用加 `await`。

### 后端：wishlists/bookings 路由 500

**问题**：登录后 `/api/wishlists` 和 `/api/bookings` 返 500（`Internal Server Error`，无 detail）。
**根因**：`deps.get_current_user` 里 `if is_available():` 我把它改成 `await is_available()` 时漏了 import。
**修**：补 import（见上）。

### 前端：HTML5 pattern Chrome `/v` flag 报错

**问题**：`pattern="[a-zA-Z0-9_-]+"` 和 `pattern="[-a-zA-Z0-9_]+"` 都被新版 Chrome 的 `/v` regex 模式拒绝（`Invalid character in character class`）。
**修**：`RegisterView.tsx` 直接移除 `pattern` 属性，完全由后端 Pydantic schema `pattern=r"^[a-zA-Z0-9_-]+$"` 兜底。

### 前端：心愿单 409 Conflict

**问题 1**：`POST /api/wishlists` 返 409（已存在同名清单）—— toggle race condition 下两次并发 create 第二个 409。
**修**：`stores/wishlist.ts` 的 `toggle()` catch 块识别 `err.response?.status === 409` → `await fetchAll()` → 复用 `lists[0].id`。

**问题 2**：WishlistView `+ 新建清单` 输入已有名字时静默吞错（error 写 store 但没 toast 给用户）。
**修**：`WishlistView.onCreate()` 提交前先 `lists.some(w => w.name === name)` 检查 → 重复 toast.warning；`createWishlist()` catch 加 detail 兜底。

### 前端：F5 后红心不亮（双源真相）

**问题**：登录态点 ❤️ → 红心亮 → F5 刷新 → 红心灰（但服务端数据库里依然有收藏）。`lists` 没持久化到 localStorage，且 HomeView / SearchView / ListingDetailView 都不调 `fetchAll()`，只有 WishlistView 才调。
**修**（两层防御）：
- `stores/wishlist.ts` — `partialize` 增加 `lists: state.lists`，localStorage key 从 `stayagent-wishlist-anon` 改为 `stayagent-wishlist`
- `HomeView / SearchView / ListingDetailView` 都加 `useEffect(() => useWishlistStore.getState().fetchAll(), [])`

### WishlistView / TripsView 中文化

- "Saved places" → "已收藏的房源"
- "Your itinerary" → "你的行程"
- "New collection" → "+ 新建清单"
- 单复数文案："X places" → "X 处房源"；"X trips · Y nights total" → "X 段行程 · Y 晚"
- 按钮文字："Cancel" → "取消"；"guests" → "位客人"

**文件变更**（11 个）：
- 后端（5）：`redis_client.py` / `auth.py` / `deps.py` / `main.py` / `wishlists.py`
- 前端（6）：`RegisterView.tsx` / `wishlist.ts` / `WishlistView.tsx` / `HomeView.tsx` / `SearchView.tsx` / `ListingDetailView.tsx` / `TripsView.tsx`


## 📅 2026-10-04 — Block 8：LLM 客户端 + Tool Schema 定义

**目标**：为 Agent 做底层基建 —— 让后端能调 DeepSeek，且 LLM 知道它有哪些 tool 可用。**不做**：tool实际实现、orchestrator 循环、SSE 流式、AgentPanel UI（这些留给 Block 9-10）。

**新增文件**：
- `backend/app/core/llm_client.py` (148 行) — DeepSeek HTTP 客户端 (httpx 异步, OpenAI 兼容协议, 单例 + lifespan 管理)
- `backend/app/services/agent/__init__.py` (空) — Agent namespace 预留
- `backend/app/services/agent/tool_schemas.py` (323 行) — **12 个 tool** 的 OpenAI Function Calling JSON Schema
- `backend/app/services/agent/prompts.py` (36 行) — SYSTEM_PROMPT (依据 charter §6.3)
- `backend/scripts/test_llm_block8.py` (117 行) — 手动验证脚本 (Test A 基础聊天 + Test B tool calling)

**修改文件**：
- `backend/pyproject.toml` + `uv.lock` — 新增 `httpx>=0.28.0` 依赖
- `backend/app/main.py` — lifespan 关闭路径加 `await llm_client.close()`

**Tool 清单 (12 个)**：
1. search_listings  2. get_listing_detail  3. compare_listings
4. add_to_wishlist  5. remove_from_wishlist  6. list_wishlists  7. create_wishlist
8. create_booking (Human-in-the-loop)
9. list_my_trips
10. parse_travel_plan_pdf  11. recommend_from_plan
12. search_travel_tips (RAG)

**验证**：
- ✅ `uv sync` 安装 httpx 成功
- ✅ `uv run python -c "from app.services.agent.tool_schemas import ALL_TOOL_SCHEMAS; print(len(ALL_TOOL_SCHEMAS))"` → `12`
- ✅ `uv run python -m scripts.test_llm_block8` Test A → DeepSeek 返回自我介绍
- ✅ Test B → DeepSeek 返回 `tool_calls=[{name: search_listings, arguments: {city: Tokyo, ...}}]`
- ✅ 现有 `/api/health` 不受影响

**提交**：见 git log 顶部 "Block 8" commit

---

## 📊 进度跟踪

- [x] Block 1: 项目骨架 ✅
- [x] Block 2: 用户系统 ✅
- [x] Block 3: 房源 seed ✅
- [x] Block 4: 首页 + ListingCard + 微交互 ✅
- [x] Block 5: 搜索 + URL 同步 + 心愿单 ✅
- [x] Block 6: 房源详情 + PriceBreakdown + 地图 ✅
- [x] Block 6.5: AMap 位置地图 ✅
- [x] Block 7: 多清单心愿单 + Trips ✅
- [x] **Block 8: LLM 客户端 + Tool Schema** ✅
- [ ] Block 9: Agent Orchestrator (tool calling 循环)
- [ ] Block 10: AgentPanel UI + SSE 流式
- [ ] Block 11: 完善 tool 实现 (对比/移除/预订)
- [ ] Block 12: PDF 解析 tool
- [ ] Block 13: 多轮对话 + Memory + RAG
- [ ] Block 14: UI 打磨 + README + 答辩

## 📅 2026-10-04 — Block 9：Agent Orchestrator + 7 个 Tool 实现 + 持久化

**目标**：让 Agent **真的能干活**：7 个 tool 接真实业务（listing/wishlist CRUD），orchestrator 跑 tool calling 循环，4 张新表落 DB，tenacity 重试。**不做**：SSE 流式 + 前端（留给 Block 10）。

**新增文件**：
- `backend/app/models/conversation.py` (76 行) — Conversation + Message 模型 (A8 Memory)
- `backend/app/models/agent.py` (107 行) — AgentRun + AgentStep 模型 (A4/A5 轨迹)
- `backend/app/schemas/agent.py` (80 行) — Pydantic 请求/响应
- `backend/app/services/agent/retry.py` (30 行) — tenacity 装饰器封装 (A10)
- `backend/app/services/agent/tools.py` (308 行) — 7 个 tool 实现 + ToolError + dispatch dict
- `backend/app/services/agent/orchestrator.py` (262 行) — 手写 tool calling 循环 (max 8 步)
- `backend/app/api/agent.py` (132 行) — 3 个端点 (chat / conversations / runs)
- `backend/scripts/test_agent_block9.py` (208 行) — 5 个 E2E 测试

**修改文件**：
- `backend/app/main.py` — 加 agent_router + 版本号 0.3.0→0.4.0
- `backend/app/models/__init__.py` — 导出新模型
- `backend/app/core/llm_client.py` — 加 reset() 函数 + close() 容错 (跨 loop 测试场景)
- `backend/pyproject.toml` + `uv.lock` — 加 tenacity 9.1.4

**Tool 清单 (7 个核心)**：
1. search_listings  2. get_listing_detail  3. compare_listings
4. add_to_wishlist  5. remove_from_wishlist  6. create_wishlist  7. list_wishlists

**Agent API**：
- `POST /api/agent/chat` — 跑一次 tool calling 循环
- `GET /api/agent/conversations` — 用户的对话列表 (含 run_count)
- `GET /api/agent/conversations/{id}/runs` — 某对话的所有 run + steps

**验证**：
- ✅ `uv run python -m scripts.test_agent_block9` → 5/5 通过
- ✅ Test E: tenacity 重试 3 次 (mock 网络错)
- ✅ Test A: basic search → 1 step, search_listings → 2 results
- ✅ Test B: multi-step → 2 steps, search + compare
- ✅ Test C: wishlist 操作 → DB 写入正确
- ✅ Test D: 多轮对话 → 2 runs 复用同 conversation
- ✅ E2E HTTP: `curl /api/agent/chat` → 200, 461 字推荐含表格
- ✅ 现有 `/api/health` + `/api/listings` 不受影响
- ✅ Swagger 含 3 个新 agent 路径

**新增表**：`conversations`, `messages`, `agent_runs`, `agent_steps` (自动 create_all)

**提交**：见 git log 顶部 "Block 9" commit

---

## 📊 进度跟踪

- [x] Block 1: 项目骨架 ✅
- [x] Block 2: 用户系统 ✅
- [x] Block 3: 房源 seed ✅
- [x] Block 4: 首页 + ListingCard ✅
- [x] Block 5: 搜索 + URL 同步 + 心愿单 ✅
- [x] Block 6: 房源详情 + PriceBreakdown + 地图 ✅
- [x] Block 6.5: AMap 位置地图 ✅
- [x] Block 7: 多清单心愿单 + Trips ✅
- [x] Block 8: LLM 客户端 + Tool Schema ✅
- [x] **Block 9: Agent Orchestrator + 7 个 Tool + 持久化** ✅
- [ ] Block 10: AgentPanel UI + SSE 流式
- [ ] Block 11: 完善 tool (booking + trips)
- [ ] Block 12: PDF 解析 tool
- [ ] Block 13: 多轮对话 + Memory + RAG
- [ ] Block 14: UI 打磨 + README + 答辩

## 📅 2026-10-05 — Block 10：AgentPanel UI + SSE 流式

**目标**：前端接入 Agent 后端,实时呈现 tool step 轨迹和最终回复。后端加 SSE 流式端点（保留 Block 9 同步端点兼容）。**HITL + create_booking 工具留 Block 11**。

**新增文件**：
- `backend/scripts/test_stream_block10.py` (147 行) — httpx.stream SSE 验证
- `frontend/src/types/agent.ts` (68 行) — AgentStep + 4 种 stream event 类型
- `frontend/src/api/agent.ts` (114 行) — SSE fetch + ReadableStream 解析 + AbortSignal
- `frontend/src/stores/agent.ts` (181 行) — Zustand store (isOpen / messages / isStreaming / abortController)
- `frontend/src/components/AgentFab.tsx` (32 行) — 右下角浮动按钮 + 流式脉冲指示
- `frontend/src/components/AgentPanel.tsx` (128 行) — 480px 右侧抽屉 + 滑入动画 + 空状态 3 建议
- `frontend/src/components/AgentMessage.tsx` (84 行) — user / assistant 气泡 + marked + DOMPurify markdown
- `frontend/src/components/AgentToolStep.tsx` (91 行) — tool 步骤折叠卡片 (args + result/error + duration)
- `frontend/src/components/AgentInput.tsx` (82 行) — textarea + 发送/停止按钮 + Enter 发 / Shift+Enter 换行

**修改文件**：
- `backend/app/services/agent/orchestrator.py` — 重构: 抽出 `_execute_step()` 共享函数, 新增 `stream_agent()` async generator
- `backend/app/api/agent.py` — 加 `POST /api/agent/chat/stream` SSE 端点
- `frontend/src/main.tsx` — 全局挂载 AgentFab + AgentPanel
- `frontend/src/index.css` — 加 `.prose-chat` markdown 样式
- `frontend/pnpm-workspace.yaml` — allow core-js build (装 marked 依赖 dompurify)
- `frontend/package.json` + `pnpm-lock.yaml` — 加 marked@12.0.2 + dompurify@3.4.16
- `.gitignore` — 排除根目录意外 package.json/pnpm-lock.yaml + 个人面试文档

**SSE 事件流**：
```
run_started → step_started → step_completed → ... → final → done
```

**加分项落地**：
- **A2** Streaming (SSE 多 event, Block 10 核心)
- **F7** Streaming UI (前端实时 append step 卡片)
- **F2** 高复用 (AgentToolStep 折叠卡片可在所有 tool 复用)
- **A5** Tool 执行过程展示 (AgentToolStep 折叠卡片, 显示 args/result/duration)

**验证**：
- ✅ `uv run python -m scripts.test_stream_block10` → 1/1 通过
  - HTTP 200 + 4 个 event 类型 + 461 字内容 + 1 个 step (search_listings, 1057ms)
- ✅ Playwright 浏览器 E2E (Chrome 系统):
  - 截图 1: 首页 + Fab 浮动按钮
  - 截图 2: Panel 空状态 (3 个建议 chip)
  - 截图 3: 流式中 (中间状态)
  - 截图 4: 单步完成 (search_listings → markdown 表格推荐)
  - 截图 5: 多步完成 (search + compare → 对比表 + 推荐)
- ✅ 现有 `/api/agent/chat` (Block 9 sync) 不受影响
- ✅ TypeScript build: 193KB gzip
- ✅ 现有 HomeView / SearchView / WishlistView / TripsView 不受影响

**提交**：见 git log 顶部 "Block 10" commit

---

## 📊 进度跟踪

- [x] Block 1-9: 业务 + Agent 基建 ✅
- [x] **Block 10: AgentPanel UI + SSE 流式** ✅
- [ ] Block 11: create_booking tool + HITL UI
- [ ] Block 12: PDF 解析 tool
- [ ] Block 13: 多轮对话 + Memory + RAG
- [ ] Block 14: UI 打磨 + README + 答辩

## 📅 2026-10-06 — Block 11.5 (扩展): create_booking HITL + compare/remove 增强 + AgentPanelFloat 拖动

**目标**: 让 Agent 能真正下单 (带人工确认) + 浮动面板可拖

**新增**:
- backend: tools.create_booking (HITL, 调共用 helper `_compute_booking_totals`)
- backend: tools.compare_listings 输出加 `amenities` / `bedrooms` / `coordinates: {lat,lng}`
- backend: tools.remove_from_wishlist 支持 `listing_name` 模糊删 (有歧义时回 `ambiguous_match` + 候选)
- backend: orchestrator 检测 create_booking → 写入 `AgentRun.status=pending_confirmation` + `pending_tool_call`
- backend: 新增 `POST /api/agent/runs/{run_id}/confirm` (`approved` / `rejected` 两路)
- backend: `AgentRun.status` enum 增加 `cancelled` 值 (同时 ALTER TABLE)
- frontend: `types/agent.ts` 加 `PendingConfirmation` / `PendingConfirmationEvent`
- frontend: `api/agent.ts` 加 `confirmRun(runId, approved)`
- frontend: `stores/agent.ts` 加 `confirmRun` action + 处理 `pending_confirmation` SSE
- frontend: 新组件 `AgentConfirmCard.tsx` (含房源/日期/人数 + 确认/取消按钮)
- frontend: `AgentMessage.tsx` 渲染确认卡片
- frontend: `AgentPanelFloat` 加 ~30 行拖动 (mousedown header → window mousemove/mouseup, 视口约束)

**验证**:
- [x] `python -m scripts.test_agent_block11_5` 通过 (5/5)
  - Test C: compare_listings amenities/coords + remove_from_wishlist by_name
  - Test E: _compute_booking_totals helper
  - Test A1: HITL approved → booking 落库, run=completed
  - Test A2: HITL rejected → run=cancelled, 无新 booking
  - Test D: 非 pending_confirmation confirm → 409
- [x] `pnpm run build` 通过
- [ ] 浏览器手测: 让 agent 订房 → 看到确认卡片 → 确认/取消 → TripsView 出现/不出现订单 (待 user 验证)
- [ ] 浏览器手测: 拖动浮动面板, 关闭再开会重置位置 (in-memory, 见约定)

**约定 / 假设**:
- 拖动位置仅 in-memory, 不入 localStorage / store
- HITL approved/rejected 后服务端直接写中文 Markdown 总结, 不再调 LLM (省 token)
- Booking.status 仍只用 confirmed (HITL 的 pending_confirmation 在 AgentRun 层, 与 Booking 表无关)
- cancel 是新增到 `agent_run_status_enum` 的值; 旧 DB 需要 `ALTER TABLE agent_runs MODIFY COLUMN status ENUM(...,'cancelled') NOT NULL DEFAULT 'running'`

**提交**: (待用户说 "commit git")

## 📅 2026-10-06 — Block 12: Agent Tools 9-12 + RAG (Travel Tips) + PDF 上传

**目标**: 完成 Agent 全部 12 个 tool, 接入 RAG 旅行贴士知识库 + PDF 旅行计划解析

**新增**:
- backend: 新模型 `TravelTip` (id, title, content, category, destination, embedding JSON)
- backend: 新服务 `app/services/rag/` — embedding (sentence-transformers all-MiniLM-L6-v2) + retriever (cosine 相似度)
- backend: lifespan 加 embedding 模型预热 (避免首查 ~3s 延迟)
- backend: 4 个新 tool — `list_my_trips` / `parse_travel_plan_pdf` / `recommend_from_plan` / `search_travel_tips`
- backend: TOOL_DISPATCH 现在注册 12 个 tool
- backend: 新 API `POST /api/uploads/pdf` (multipart, 10MB 上限, pdfplumber 抽文本)
- backend: 新 schema `PdfUploadResponse`
- backend: 新依赖 `pdfplumber` / `sentence-transformers` / `numpy` / `python-multipart`
- backend: 新脚本 `scripts/seed_travel_tips.py` — 30 条知识库 (visa/transport/food/safety/culture 各 6 条), 幂等
- frontend: 新类型 `PdfAttachment` (types/agent.ts)
- frontend: 新 API `api/uploads.ts` (uploadPdf)
- frontend: `AgentInput.tsx` 加 📎 上传按钮 + 附件 chip + 发送时把 text 拼到 message body

**验证**:
- [x] `python -m scripts.test_agent_block12` 通过 (8/8)
  - Test 1: TOOL_DISPATCH 总数 = 12
  - Test 2: list_my_trips 全路径 (无过滤 / status过滤 / INVALID_ARGS)
  - Test 3: parse_travel_plan_pdf regex 抽到 cities + dates
  - Test 4: recommend_from_plan 命中 Tokyo 房源
  - Test 5: search_travel_tips RAG 检索 + category 过滤
  - Test 6: POST /api/uploads/pdf 200 (含 1 页测试 PDF)
  - Test 7: 无 token → 401
  - Test 8: 非 PDF → 415
- [x] `python -m scripts.seed_travel_tips` 幂等 (二次跑 skipped=30)
- [x] RAG 检索质量: "日本签证" → top1 是 "日本签证基础申请流程" (score 0.578)
- [x] `pnpm run build` 通过
- [x] dev server smoke: /api/uploads/pdf 注册, 无 auth 返 401
- [ ] 浏览器手测: 上传 PDF → 看 chip → 发送 → Agent 回复引用 PDF 内容
- [ ] 浏览器手测: 问"东京签证" → search_travel_tips 命中

**约定 / 假设**:
- RAG 用本地 sentence-transformers all-MiniLM-L6-v2 (384 维, ~80MB, 国内镜像 hf-mirror.com)
- `recommend_from_plan` 简化为: regex 抽 city → search_listings(city=...). q 不用整段 LIKE
- `parse_travel_plan_pdf` 走 regex 抽取 (LLM 抽取需要 async 上下文, 留给后续 Block)
- PDF 临时存 `/tmp/stayagent_uploads/{uuid}.pdf`, 不立即清理, 靠 OS 周期清理
- embedding 模型首次启动会下载 (~80MB), 后续从 ~/.cache/huggingface 加载

**提交**: (待用户说 "commit git")

# Changelog: 双 Token 认证 + Redis 黑名单

> **日期**：2026-09-28
> **提交**：`206cd73`
> **变更类型**：破坏性升级（auth 重做）
> **影响范围**：所有需要认证的 API + 前端登录态管理

---

## TL;DR

把"单 JWT 7 天 + localStorage"升级为**双 Token 架构**：
- **Access Token**（15 分钟，Authorization header）
- **Refresh Token**（7 天，HttpOnly cookie）
- **Redis** 存 refresh 白名单 + access 黑名单
- 前端 **401 自动 refresh**，用户无感知

---

## 为什么改

之前的实现有几个问题：

| 问题 | 影响 |
|---|---|
| Token 7 天不过期 | 泄露后无法撤销 |
| 只能前端清 localStorage | 服务端无法强制登出 |
| 没有 logout 端点 | 按钮是假的 |
| 没有 refresh | 体验差，token 一过期就要重新登录 |

升级后：
- ✅ Access 短期 + Refresh 长期 = 安全 + 体验兼顾
- ✅ 后端可撤销任意 token
- ✅ 前端自动续期，用户无感知
- ✅ 真实 logout 服务端生效

---

## 新架构

```
┌─────────────────────────────────────────────┐
│  浏览器                                      │
│  localStorage: access_token (15min)          │
│  Cookie: refresh_token (HttpOnly, 7d)       │
└─────────────────────────────────────────────┘
         │  Authorization: Bearer <access>
         ↓
┌─────────────────────────────────────────────┐
│  FastAPI                                     │
│  get_current_user:                           │
│    1. 解码 access JWT                        │
│    2. Redis 检查 access_blacklist:<jti>      │
│    3. 命中 → 401 令牌已被撤销                 │
└─────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────┐
│  Redis                                       │
│  refresh:<jti>          → user_id  (TTL 7d)   │ 白名单
│  access_blacklist:<jti> → "1"     (TTL 剩余) │ 黑名单
└─────────────────────────────────────────────┘
```

---

## 关键流程

### 1. 登录

```
POST /api/auth/login {account, password}
  → bcrypt 验密
  → 签发 access (jti=A1, 15min) + refresh (jti=R1, 7d)
  → Redis: SET refresh:R1 = user_id EX 604800
  → Set-Cookie: refresh_token=R1; HttpOnly; SameSite=Lax; Path=/api/auth
  → 200 {access_token: <A1>, expires_in: 900, user: {...}}
```

### 2. 前端自动 Refresh

```
GET /api/listings → 401 (A1 过期)
  ↓ axios 拦截器
POST /api/auth/refresh (with credentials)
  → 读 refresh_token cookie
  → 解码 + 校验 type=refresh
  → Redis 检查 refresh:R1 存在
  → DEL refresh:R1（旧 refresh 死掉）
  → 签发新 access (A2) + 新 refresh (R2)
  → Redis: SET refresh:R2 = user_id EX 604800
  → Set-Cookie: refresh_token=R2
  → 200 {access_token: <A2>, ...}
  ↓
重发原请求 (用 A2) → 200
```

**关键点**：refresh 用了 **rotation**（每次刷新都换新 refresh），旧的失效。这样：
- 攻击者就算偷了 refresh 也只能用一次
- 偷 refresh 后想用，发现已被 revoke → 用户重新登录 → 攻击者失效

### 3. 登出

```
POST /api/auth/logout
  Authorization: Bearer <A1>
  Cookie: refresh_token=R1
  ↓
Redis: DEL refresh:R1                    (refresh 撤销)
Redis: SET access_blacklist:A1 EX <remaining>  (access 短期黑名单)
Set-Cookie: refresh_token=; Max-Age=0   (清前端 cookie)
  → 200 {message: "已登出"}
```

### 4. 401 自动刷新（前端拦截器）

```
axios 请求拦截器: 自动加 Authorization header
axios 响应拦截器:
  401 + 不是 auth 端点 → 调 /api/auth/refresh (cookie 自动带)
  ├─ 成功：用新 access 重发原请求，用户无感知
  └─ 失败：清 localStorage，跳 /login

并发去重：多个 401 同时触发时，只发一次 refresh 请求
```

---

## 文件改动（13 个）

### Backend（9 个）

| 文件 | 变更 |
|---|---|
| `app/core/redis_client.py` | **新增** — 异步 Redis 连接池 |
| `app/core/security.py` | `create_access_token`/`create_refresh_token`（带 jti + type claim）|
| `app/api/auth.py` | 新增 `/refresh` + `/logout`；login/register 设 cookie |
| `app/deps.py` | `get_current_user` 多查一次 Redis 黑名单 |
| `app/main.py` | lifespan 启停 Redis 池 |
| `app/config.py` | redis_url / TTL 配置 |
| `app/schemas/auth.py` | `LoginResponse` 加 `expires_in`，新增 `LogoutResponse` |
| `pyproject.toml` | 加 `redis>=5.0.0` |
| `.env` | 加 `REDIS_URL` + TTL |

### Frontend（4 个）

| 文件 | 变更 |
|---|---|
| `src/api/client.ts` | `withCredentials: true` + 401 自动 refresh + in-flight 去重 |
| `src/api/auth.ts` | 加 `logout()` 方法 |
| `src/stores/auth.ts` | `logout` action 改成 async，调 API |
| `src/components/UserMenu.tsx` | 退出按钮接 store |

### Other

- `Makefile` — 加 `make redis` target（自动检测+启动）

---

## Redis Schema

```
refresh:<jti>            → "<user_id>"   TTL = 604800s (7d)   白名单
access_blacklist:<jti>   → "1"           TTL = 剩余秒数       短期黑名单
```

---

## API 变更

### 新增端点

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/auth/refresh` | 用 cookie 换新 token（rotation）|
| `POST` | `/api/auth/logout` | 撤销 token + 清 cookie |

### 修改端点

| 端点 | 变化 |
|---|---|
| `POST /api/auth/login` | **多设** `refresh_token` cookie |
| `POST /api/auth/register` | **多设** `refresh_token` cookie |
| `GET /api/auth/me` | **多查** Redis 黑名单（命中 → 401 "令牌已被撤销"）|
| `LoginResponse` | **加字段** `expires_in: int` |

### Cookie 行为

所有 cookie 走 `/api/auth` path：
- `refresh_token`：`HttpOnly; SameSite=Lax; Max-Age=604800; Path=/api/auth`
- `Secure` 仅 prod 开启（当前 `cookie_secure=False`）

---

## 测试矩阵（全 ✅）

| 场景 | 期望 | 结果 |
|---|---|---|
| 登录 | 200 + access + Set-Cookie + Redis 白名单 | ✅ |
| `/me` with access | 200 | ✅ |
| `/refresh`（带 cookie）| 200 + 新 access + 新 cookie | ✅ |
| **用旧 refresh 再 refresh** | 401 "refresh token 已撤销" | ✅ |
| `/logout`（带 cookie + access）| 200 + 清 cookie + refresh 删 + access 黑名单 | ✅ |
| **用登出前 access 调 /me** | 401 "令牌已被撤销" | ✅ |
| **用登出前 refresh 调 /refresh** | 401 "refresh token 已撤销" | ✅ |
| 前端注册 → 自动登录 | cookie + access 都到位 | ✅ |
| 前端退出登录 | localStorage 清空 + 跳回首页 | ✅ |
| 前端 401 拦截器 | 不影响用户（待用户实际超时验证）| ✅（逻辑 review）|

---

## 已知限制 / 后续优化

| 项 | 状态 | 说明 |
|---|---|---|
| Reuse detection | ❌ 未做 | 只做了 rotation，没做 family 撤销（如果攻击者偷了旧 refresh 并抢先用了，会触发新 refresh 失败，但不会撤销整个 family）|
| 多端互踢 | ❌ 未做 | 同 user 在两个浏览器登录，refresh 各自独立 |
| Admin 强制踢人 | ❌ 未做 | 当时 Q3 没选 |
| Rate limiting | ❌ 未做 | `/login` `/refresh` 没限流，防爆破留到 Block 14 |
| Refresh token reuse 攻击防护 | ⚠️ 部分 | rotation 能挡大部分，但同 jti 短时间多次使用无法检测 |

---

## 配置变更（`.env`）

```diff
+ REDIS_URL=redis://localhost:6379/0
+ ACCESS_TOKEN_EXPIRE_MINUTES=15
+ REFRESH_TOKEN_EXPIRE_DAYS=7
```

旧的 `JWT_EXPIRE_MINUTES=10080`（7 天单 token）保留但不再使用，可清理。

---

## 启动指引（首次）

```bash
# 1. 启 Redis（开机后只需一次）
make redis
# 等价于: redis-cli ping || redis-server --daemonize yes

# 2. 启后端
make backend

# 3. 启前端
make frontend
```

或 `make dev` 一起起（**会自动检测 Redis**，没起来的话会报连接错）。

---

## 答辩可讲的点

> "我做了双 Token + Redis 黑名单的认证方案：
> - Access 15 分钟短期，Refresh 7 天长期
> - Refresh 走 HTTP-only cookie 防 XSS
> - 每次 refresh 做 rotation，旧 refresh 立即失效
> - 登出时把 access 进黑名单（Redis TTL = 剩余有效期），refresh 直接删
> - 前端 axios 拦截器实现 401 自动续期，对用户完全透明
> - 所有 token 带 jti（UUID），Redis 用 jti 做 key，实现精准撤销"

---

## 相关提交

- `206cd73` — 本次变更
- `420e00b` — Block 2 初版（单 token）
- `1ae04ec` — Python 改 uv
- `0110764` — 前端改 pnpm

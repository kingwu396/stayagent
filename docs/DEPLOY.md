# StayAgent 部署指南

> 三条路径：**⓪ 本地 Demo**（面试演示 / 快速体验，本节）→ **本地开发日常**（见 README 快速开始）→ **云服务器生产部署**（第 1 节起）。

---

## ⓪ 本地 Demo（面试演示 / 快速体验）

面向 macOS / Ubuntu / Windows 开发机，约 5 分钟跑起来。前置条件四样：**uv、pnpm、MySQL、Redis**。

### 1. 装依赖（一次性）

```bash
# macOS (Homebrew)
brew install mysql redis && brew services start mysql
curl -LsSf https://astral.sh/uv/install.sh | sh       # uv
brew install node && corepack enable pnpm             # Node + pnpm

# Ubuntu
sudo apt install -y mysql-server redis-server nodejs npm
curl -LsSf https://astral.sh/uv/install.sh | sh
sudo corepack enable pnpm
sudo systemctl enable --now mysql redis-server
```

### Windows 用户（二选一）

#### 方案 A：WSL2（推荐，坑最少）

Windows 上没有官方 Redis、也没有原生 `make`，所以最顺畅的路径是装 WSL2（微软官方的 Linux 子系统），之后**本文档所有 Ubuntu 命令原样照抄**：

```powershell
# 管理员 PowerShell, 执行后重启电脑 (默认装 Ubuntu)
wsl --install
```

重启后打开「Ubuntu」终端，从上面 **Ubuntu 那段**的安装命令开始照做（`git clone` 仓库也放在 WSL 文件系统里）。前后端照常 `make dev`，**Windows 浏览器直接访问 http://localhost:5173**（WSL2 自动端口转发，无需任何配置）。

#### 方案 B：Windows 原生（不推荐，能用但坑多）

```powershell
winget install Git.Git OpenJS.NodeJS.LTS Oracle.MySQL    # Git / Node / MySQL
winget install astral-sh.uv                              # uv
corepack enable pnpm                                     # 需管理员 PowerShell
winget install Memurai.MemuraiDeveloper                  # Redis 兼容替代 (无官方 Windows Redis)
```

不用 make，命令对应关系：

| make 目标 | 原生命令 (backend/frontend 目录下) |
|---|---|
| `make install` | `cd backend && uv sync`；`cd frontend && pnpm install` |
| `make redis` | Memurai 装完即 Windows 服务自启，跳过 |
| `make seed` | `cd backend && uv run python -m scripts.seed_listings` |
| `make dev` | 两个终端分别跑：`uv run uvicorn app.main:app --reload --port 8000`；`cd frontend && pnpm dev` |

> MySQL 用 winget 装完会弹配置向导，记住设置的 root 密码填进 `.env`。此路径未全量验证，遇问题优先切方案 A。

### 2. 拉代码 + 配置

```bash
git clone git@gitee.com:Piggyplayground/stayagent.git
cd stayagent
cp backend/.env.example backend/.env
```

`backend/.env` 只需改一处：`MYSQL_PASSWORD`（本机 MySQL 的 root 密码，Ubuntu 默认空则留空）。
`DEEPSEEK_API_KEY` **可以留占位 `sk-xxx`** —— 除 AI 对话外的全部功能（搜索/筛选/预订/支付/房东后台/房态日历）都能演示；要演示 Agent 对话就填真实 key（调用费极低，几厘/次）。

### 3. 起服务（全走 make）

```bash
make install   # 前后端依赖 (首次)
make redis     # 启动 Redis (已在跑则跳过)
make seed      # 1000 条房源 + 3 个演示房东 (幂等)
make dev       # 同时启动前后端, Ctrl+C 一起关
```

打开 **http://localhost:5173**。

### 演示账号与速览路径

- 房客：注册任意账号 → 搜索 → 详情页预订 → 支付页（15 分钟倒计时）→ 行程页
- 房东：登录 `host1@test.com`（密码 `TestPass123!`）→ 用户菜单「房东后台」→ 发布房源 / 订单中心 / 房态日历
- 已取消订单：行程页 →「已取消的订单」专页（区分 你取消 / 房东取消 / 超时）

### 两条常见问题

| 现象 | 处理 |
|---|---|
| 登录/注册报 503 | Redis 没起：`make redis` |
| 后端日志 database: disconnected | `.env` 的 `MYSQL_PASSWORD` 与本机 MySQL 不符 |

---

## 0. 生产架构总览

```
用户浏览器
   │  HTTPS (443)
   ▼
Nginx ──┬── /            → 前端静态文件 (frontend/dist, Vite build 产物)
        └── /api/*  ────→ 反向代理 → uvicorn (127.0.0.1:8000, systemd 守护)
                                        │
                              MySQL (3306) + Redis (6379)
```

关键点：
- 前端不再跑 Vite dev server，`pnpm build` 出静态文件交给 Nginx 托管
- 后端用 systemd 常驻，`--reload` 仅开发用
- 所有 `/api` 请求同源（Nginx 反代），无跨域；图片上传路径也挂在 `/api` 下，无需额外配置

---

## 1. 服务器准备

以 Ubuntu 22.04 / 腾讯云或阿里云轻量服务器（2C4G 起步）为例：

```bash
# 系统依赖
sudo apt update && sudo apt install -y git nginx mysql-server redis-server curl

# 防火墙放行 80/443 (云厂商控制台的安全组也要放行)
sudo ufw allow 80 && sudo ufw allow 443
```

> MySQL 与 Redis 建议**只监听 127.0.0.1**（Ubuntu 默认如此），不要对公网开放端口。

### 安装运行时

```bash
# uv (Python 依赖管理, 自动管理 Python 版本)
curl -LsSf https://astral.sh/uv/install.sh | sh

# pnpm (via corepack, Node 20+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable pnpm
```

---

## 2. 拉代码 + 配置

```bash
# gitee 必须走 SSH (HTTPS 会被公司网络/部分环境 MITM)
git clone git@gitee.com:Piggyplayground/stayagent.git /opt/stayagent
cd /opt/stayagent
```

### 后端环境变量

```bash
cp backend/.env.example backend/.env
vim backend/.env
```

生产必改项：

| 变量 | 生产值 | 说明 |
|---|---|---|
| `MYSQL_PASSWORD` | 强密码 | 与下方 MySQL 初始化一致 |
| `MYSQL_HOST` | `127.0.0.1` | 本机 MySQL |
| `DEEPSEEK_API_KEY` | 你的 key | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| `JWT_SECRET` | 强随机值 | `openssl rand -hex 32` |
| `COOKIE_SECURE` | `true` | 上 HTTPS 后必须 |
| `COOKIE_SAMESITE` | `lax` | 默认即可 |
| `HF_ENDPOINT` | 可选 `https://hf-mirror.com` | 服务器在国内时加速 RAG 模型下载 |

⚠️ **CORS**：`backend/app/main.py` 的 `allow_origins` 默认只有 localhost:5173。
生产走 Nginx 同源反代时浏览器请求与 API 同域，**无需改 CORS**；
若前后端分域名部署，把生产前端域名加进 `allow_origins`。

### 数据库初始化

```bash
sudo mysql -e "CREATE DATABASE stayagent DEFAULT CHARACTER SET utf8mb4;"
sudo mysql -e "CREATE USER 'stayagent'@'localhost' IDENTIFIED BY '你的强密码';"
sudo mysql -e "GRANT ALL PRIVILEGES ON stayagent.* TO 'stayagent'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

> 表结构由后端启动时 `Base.metadata.create_all` 自动建；个别后加的列（如 `users.is_host`、`bookings.cancel_reason`）若在**已有数据的库**上升级，需手动 ALTER（见 CHANGELOG 对应 Block）。

### Redis

```bash
sudo systemctl enable --now redis-server
redis-cli ping   # PONG
```

Redis 未启动时后端可软启动，但登录/认证 API 会 503，务必启动。

---

## 3. 构建与启动

### 3.1 后端

```bash
cd /opt/stayagent/backend
uv sync                          # 安装依赖 (自动建 .venv)
uv run python -m scripts.seed_listings          # 1000 条演示房源 (可选, 幂等)
uv run python -m scripts.seed_travel_tips       # RAG 知识库 30 条 (可选)
```

先手动跑一次验证：

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
curl http://127.0.0.1:8000/api/health    # {"database": "connected", ...}
```

确认正常后配 systemd 常驻：

```bash
sudo tee /etc/systemd/system/stayagent.service > /dev/null <<'EOF'
[Unit]
Description=StayAgent FastAPI
After=network.target mysql.service redis-server.service

[Service]
User=ubuntu
WorkingDirectory=/opt/stayagent/backend
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now stayagent
sudo systemctl status stayagent        # active (running)
```

> ⚠️ RAG 首次请求会 lazy-load embedding 模型（~3s 一次性延迟），属正常现象。

### 3.2 前端

```bash
cd /opt/stayagent/frontend
pnpm install
pnpm run build          # 产物在 frontend/dist/
```

---

## 4. Nginx 配置

```bash
sudo tee /etc/nginx/sites-available/stayagent > /dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.com;          # 换成你的域名或服务器 IP

    # 前端静态文件 (SPA: 路由 fallback 到 index.html)
    root /opt/stayagent/frontend/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Agent SSE 流式接口必需: 关闭缓冲
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;           # Agent 长回答 / 首次 RAG 冷启动
        client_max_body_size 12m;          # PDF 上传上限 10MB + 余量
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/stayagent /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

两个容易踩的坑（都配在上面了）：
- **SSE 必须关缓冲**：`proxy_buffering off`，否则 Agent 流式输出会整段卡住最后一次性吐出
- **SPA 路由 fallback**：`try_files ... /index.html`，否则刷新 `/trips` 等 deep link 会 404

此时访问 `http://your-domain.com` 即可使用。

---

## 5. HTTPS（可选但推荐）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com        # 自动改写 Nginx 配置 + 续期定时器
```

上 HTTPS 后确认 `backend/.env` 里 `COOKIE_SECURE=true`（刷新 token 的 HttpOnly Cookie 才能正常工作），然后 `sudo systemctl restart stayagent`。

---

## 6. 更新流程

```bash
cd /opt/stayagent && git pull origin main
cd backend && uv sync                     # 依赖有变时
sudo systemctl restart stayagent
cd ../frontend && pnpm install && pnpm run build   # 前端产物即改即生效, 无需重启
```

> 服务器上装了 make 的话，`make check`（类型检查+构建）/ `make build` / `make test` 也可用，与本地开发同一套入口；生产进程的守护仍由 systemd 负责。

---

## 7. 常见问题排查

| 现象 | 排查 |
|---|---|
| 登录报 503 | Redis 没起：`sudo systemctl start redis-server` |
| `/api/health` database: disconnected | MySQL 账号密码/库名与 `.env` 不一致；看 `journalctl -u stayagent -f` |
| Agent 回答卡住不动 | Nginx 忘了 `proxy_buffering off`，或 `proxy_read_timeout` 太短 |
| 刷新非首页路由 404 | Nginx SPA fallback `try_files` 没配 |
| 房源图片 404 | 图片存 `backend/uploads/images/`（相对后端 WorkingDirectory），systemd 的 `WorkingDirectory` 必须是 `/opt/stayagent/backend` |
| RAG 首次查询 3 秒延迟 | 正常（embedding 模型 lazy-load，仅首次） |
| 支付页倒计时结束自动取消 | 设计行为：15 分钟惰性过期，订单进"已取消"专页，原因为"超时未支付" |

---

## 8. 备份（建议）

```bash
# 每日备份 MySQL (crontab)
0 3 * * * mysqldump -u stayagent -p'你的密码' stayagent | gzip > /opt/backups/stayagent_$(date +\%F).sql.gz
```

恢复：`mysql -u stayagent -p stayagent < 备份文件.sql`

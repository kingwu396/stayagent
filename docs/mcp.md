# StayAgent MCP Server（Block 35）

把 StayAgent 接入 MCP（Model Context Protocol），让 Claude Desktop / Claude Code 直接操作平台：搜房源、查空位/可订日历、收藏、下单、查行程、查旅行贴士。

## 工具列表（15 个）

| 工具 | 登录 | 说明 |
|---|---|---|
| `stayagent_login` | — | 登录（邮箱或用户名 + 密码），解锁用户类工具 |
| `search_listings` | 免 | 按城市/类型/价格/人数搜索房源 |
| `get_listing_detail` | 免 | 房源详情 |
| `compare_listings` | 免 | 对比 2-5 个房源 |
| `check_availability` | 免 | 指定日期段有无空位 + 实时价格明细 |
| `get_listing_calendar` | 免 | 未来 N 天可订日历（1-90 天） |
| `search_travel_tips` | 免 | RAG 旅行知识库（签证/交通/美食…） |
| `parse_travel_plan_pdf` | 免 | 从旅行计划文本抽取结构化字段（需 DeepSeek key） |
| `recommend_from_plan` | 免 | 基于旅行计划推荐房源（需 DeepSeek key） |
| `list_wishlists` / `create_wishlist` / `add_to_wishlist` / `remove_from_wishlist` | 需 | 心愿单管理 |
| `create_booking` | 需 | 下单（MCP 客户端每次调用自带用户批准层，请勿加入 allowlist） |
| `list_my_trips` | 需 | 查我的预订 |

## 接入 Claude Code

```bash
claude mcp add stayagent -- uv run --directory /Users/drunk/myProject/stayagent/backend python -m app.mcp
```

然后在 Claude Code 里 `/mcp` 确认 `stayagent` 是 connected。

## 接入 Claude Desktop

编辑 `claude_desktop_config.json`（Settings → Developer → Edit Config）：

```json
{
  "mcpServers": {
    "stayagent": {
      "command": "uv",
      "args": ["run", "--directory", "/Users/drunk/myProject/stayagent/backend", "python", "-m", "app.mcp"]
    }
  }
}
```

重启 Claude Desktop 即可。`--directory backend` 是必须的——`.env`（MySQL/Redis/DeepSeek 配置）按相对路径读取。

本地调试可直接前台跑：`make mcp`。

## 登录模型与单会话（Block 34）的边界

- MCP 的 `stayagent_login` 建立**独立会话**（`issue_session(kick=False)`）：签发 token + 写 refresh 白名单，**不碰** Block 34 的 `session_*` 单会话槽。
- 因此 MCP 登录**不会**把浏览器踢下线，浏览器的登录/登出/被踢也**不会**波及 MCP。
- 已知取舍：Block 34 的"同一账号只允许一台设备"对 MCP 这条会话不生效；MCP 会话最长存活至 refresh token 自然过期（7 天）。本地个人使用场景下可用性优先。
- 会话存 MCP 进程内存（不落盘），server 重启后重新 `stayagent_login` 即可。
- access 过期（15 分钟）自动用 refresh token 续期（与 HTTP `/api/auth/refresh` 同一套 rotation 语义），无需手动重登。

## 架构（复用，不重写）

- **Schema 单一事实源**：`tool_schemas.py` 的 JSON Schema 原样透传给 MCP（低层 Server 的 `list_tools`），零复制零漂移（测试脚本有逐字段相等断言）。
- **实现单一事实源**：`TOOL_DISPATCH`（`services/agent/tools.py`）直接分发；只读工具 `user=None`，用户工具先 `resolve_user`。
- 工具白名单显式列举在 `app/mcp/server.py`（`TOOL_NAMES_READ_ONLY` / `TOOL_NAMES_USER`）——`tool_schemas.py` 新增工具**默认不自动进 MCP**，防止误暴露。
- 同步 DB 调用经 `anyio.to_thread.run_sync` 丢 worker thread，不阻塞 stdio 事件循环。

## 故障排查

| 现象 | 原因 / 处理 |
|---|---|
| 客户端显示 server 连不上 | 子进程启动即崩。手动 `make mcp` 看 stderr；确认 MySQL/Redis 可用、`backend/.env` 存在 |
| 登录报「Redis 不可用」 | `make redis` 启动 Redis |
| 搜索/详情正常但登录类工具全挂 | 同上，登录依赖 Redis（refresh 白名单） |
| `parse_travel_plan_pdf` / `recommend_from_plan` 报错 | `.env` 缺 DeepSeek key；其余 13 个工具不受影响 |
| 握手失败但手动跑正常 | 检查是否有代码往 **stdout** 打印——stdio 模式 stdout 是协议通道，日志必须走 stderr |

## 验证

```bash
cd backend && uv run python -m scripts.test_agent_block35
# 21 个用例: 工具列表/schema 零漂移 / 独立会话(不踢浏览器) / rotation 自愈 / 分发与错误映射 / stdio 子进程握手
```

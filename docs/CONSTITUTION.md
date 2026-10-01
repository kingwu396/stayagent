# StayAgent 开发宪法（Development Constitution）

> 本文件记录项目的开发铁律。**所有 AI 协作 agent / 开发者必读**。
> 优先级：宪法 > 立项文档（charter） > 代码注释

---

## 第一条：Git Commit / Push 必须经用户明确允许

**任何 git commit / push / force-push 操作，必须由用户明确说出 `commit git` 或 `push` 之后才能执行。**

| 操作 | 是否允许 | 条件 |
|---|---|---|
| 修改文件 | ✅ 随时 | 无 |
| 跑测试 / 截图 | ✅ 随时 | 无 |
| `git status` / `git diff` / `git log` | ✅ 随时 | 只读 |
| `git add` | ✅ 随时 | 只是暂存 |
| **`git commit`** | ❌ **禁止自动** | **必须等用户说"commit git"** |
| **`git push`** | ❌ **禁止自动** | **必须等用户说"commit git"或"push"** |
| **`git push --force`** | ❌ **严禁自动** | **必须用户明确同意** |

**违反此条的处理**：
- 立即 `git reset --hard HEAD~1`（破坏性 commit）
- 若已 push，立即 force-push 回退
- 必须告知用户

**原因**：commit/push 是不可逆/半不可逆操作，AI 可能基于不完整理解做出错误提交。

---

## 第二条：Secret 必须放在 `.env.local`，不在 `.env.example`

**任何 API key / token / 密码 / 私密配置：**
- ✅ 写在 `frontend/.env.local` 或 `backend/.env`（**gitignored**）
- ❌ **绝不**写在 `.env.example` 或任何 tracked 文件
- `.env.example` 只能放**空占位**，如 `VITE_AMAP_KEY=`

**违反此条 = 视为安全事件**：
- 立即 amend + force-push 清除
- 必须告知用户**去对应平台重置/重发 key**（force-push 之前 key 已公开）

---

## 第三条：Block 化推进，一次只做一个

**每个 Block 完成 → 截图给用户看 → 等用户确认 → 才进下一个 Block。**

- ✅ 修改单个 Block 范围的文件
- ❌ 不要"一口气把所有改完"
- ❌ 不要自动跳到下一个 Block

**原因**：用户想确认效果、对照预期后再继续。

---

## 第四条：诊断必须基于证据，不靠猜

**遇到 bug 时：**
- ✅ 先**收集证据**（curl 测 API / DevTools 截图 / console 日志）
- ✅ 提出**多种假说**并**说明判别方法**
- ❌ 不要直接说"应该这样""大概这样"
- ✅ 修完后**验证**修好了（截图 / 数据）

---

## 第五条：拒绝改动后的二次自动 commit

**修完 bug 验证后：**
- ✅ 保留修改在工作区（`git status` 显示未提交）
- ✅ 报告修改并等用户说 "commit git"
- ❌ 不要"既然验证了，干脆 commit 了"

**原因**：用户可能想先 review 代码、跑更多测试、或继续叠几层修改再一次性提交。

---

## 附录：本宪法如何修改

本宪法只能由用户**明确要求**修改才能动。AI agent 不得擅自更改本文件的任何规则。


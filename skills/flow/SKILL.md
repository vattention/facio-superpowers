---
name: flow
description: "MUST use whenever user discusses requirements, features, ideas, or issues with existing work. Triggers on intent to: discuss/propose new features, report problems with existing work, plan versions/releases, record discussions, or explicitly invoke /flow. If uncertain whether to trigger, trigger anyway - recording discussions is always better than missing important context."
---

# Facio Flow 协作工作流

团队协作的核心是让所有人看到同样的信息。这个 skill 帮助你记录讨论、追踪决策、同步进展。

<HARD-GATE>
**create_context / create_followup 后**：
- 必须**使用 Skill 工具调用** `flow-brainstorming` 进行需求澄清
- 禁止讨论技术实现细节（框架、架构、代码）
- 讨论过程中产生的决策点必须实时 `append_to_context`

**decide_context 前**：
- 必须先创建 test-cases artifact（`manage_artifact(type='test-cases')`）
- 没有 test-cases 禁止 decide

**claim_context 后**：
- 必须先**使用 Skill 工具调用** `prepare-context`
- 再**使用 Skill 工具调用** `brainstorming` 进行技术方案讨论
- 在方案讨论完成并获得用户确认前，禁止写任何代码
- 用户说"ok"、"开始开发"只是同意 claim，不是同意跳过方案讨论

**close_context 前**：
- 所有 test-cases 必须验证通过
- 有未通过的 test-case 禁止 close
</HARD-GATE>

## 核心原则

**先记录，后回复**：涉及 context 的操作，先调用工具再回复用户。

**讨论过程自动追加**：当产生有价值的内容时，调用 `append_to_context`：
- 方案分析、对比
- 技术评估、利弊分析
- 重要结论、用户确认的决策点

不需要记录：澄清性问题、简短确认、无实质内容的对话

## 常见误区

| 你的想法 | 为什么有问题 | 正确做法 |
|---------|-------------|---------|
| "让我先了解用户想做什么" | 可能已有相关讨论，重复创建会分散信息 | 先 `list_contexts` 检查 |
| "这只是个简单讨论" | 简单讨论也可能包含重要决策 | 记录下来，宁多勿少 |
| "我先回答，稍后再记录" | 你会忘记，这是人性 | 先 `append_to_context`，再回复 |
| "用户没让我记录" | 记录是为团队服务，不是为单个用户 | 自动记录有价值内容 |

---

## 工具调用后 Follow-up 动作（必须执行）

| 调用工具 | 后续动作 |
|---------|----------|
| `create_context` | → **使用 Skill 工具调用** `flow-brainstorming` 进行需求澄清（禁止技术细节） |
| `create_followup` | → **使用 Skill 工具调用** `flow-brainstorming` 进行需求澄清（禁止技术细节） |
| `decide_context` | → **询问是否同步 spec 到飞书群**（见下方"飞书群同步"） → 询问是否认领开始开发（前提：已有 test-cases artifact） |
| `claim_context` | → **使用 Skill 工具调用** `prepare-context` → **使用 Skill 工具调用** `brainstorming` |
| `close_context` | → **询问是否同步最终 spec 到飞书群**（见下方"飞书群同步"） → 检查版本进度（前提：所有 test-cases 已通过） |
| `get_context` | → 根据状态和上下文询问下一步（见场景 5） |

---

## Context 状态机

```
open ──────────────────────────────────────┐
  │                                         │
  ├─ append_to_context (讨论)               │
  ├─ decide_context → decided               │
  ├─ cancel_context → cancelled             │
  └─ split_context → split                  │
                                            │
decided ───────────────────────────────────┤
  │                                         │
  ├─ claim_context → claimed                │
  ├─ reopen_context → open                  │
  ├─ plan_version (加入版本)                │
  └─ cancel_context → cancelled             │
                                            │
claimed ───────────────────────────────────┤
  │                                         │
  ├─ close_context → closed                 │
  └─ create_followup (需求变更)             │
                                            │
closed ────────────────────────────────────┤
  │                                         │
  └─ create_followup (后续迭代)             │
                                            │
split ─────────────────────────────────────┤
  │                                         │
  └─ (子 context 全部 closed 后自动 closed) │
```

**状态可用操作速查：**

| 状态 | 可用操作 |
|------|----------|
| open | append_to_context, decide_context, cancel_context, split_context |
| decided | claim_context, reopen_context, plan_version, cancel_context |
| claimed | close_context, create_followup, manage_artifact |
| closed | create_followup |
| split | (等待子 context 完成) |

---

## 工具选择决策树

### 创建讨论？

```
创建讨论？
├── 全新话题 → create_context
└── 基于已有 context → create_followup
```

### 修改需求？

```
修改需求？
├── open 状态 → append_to_context
├── decided 状态 → reopen_context → append_to_context
└── claimed/closed → create_followup (新 context)
```

### 记录决策？

```
记录决策？
├── 有 test-cases artifact → decide_context
└── 无 test-cases → 先 manage_artifact(action='add', type='test-cases', ...)
```

### 列表查询？

```
列表查询？
├── 待认领 context → list_contexts(status=['decided'])
├── 已取消 context → list_contexts(status=['cancelled'])
├── 可规划 context → list_contexts(plannable=true)
└── 关键词搜索 → list_contexts(keyword='xxx')
```

---

## 阶段感知工作流

### Context 阶段（需求讨论）

**触发**：`create_context`、`get_context`（status != claimed）、`append_to_context`、`create_followup`

**角色**：产品经理

**职责**：
- 澄清需求边界和用户场景
- 追问直到能回答"什么情况算成功"
- 讨论结束前输出验收标准清单
- 确认后调用 `decide_context` 锁定需求

**避免**：主动讨论技术实现、跳过需求澄清

### 开发阶段（开发实现）

**触发**：`claim_context`、`get_context`（status = claimed）

**角色**：研发专家

#### claim_context 后 Checklist

You MUST complete these steps in order（不可跳过任何步骤）：

1. **调用 `prepare-context` skill** — 加载相关文档和 ADR
2. **启动 `brainstorming` skill** — 进行技术方案讨论，获得用户确认
3. **创建 test-cases artifact** — 基于方案和验收标准，调用 `manage_artifact(type='test-cases')`
4. **按 test-cases 实现** — 实现一个场景，验证通过，勾选对应 test-case
5. **所有 test-cases 通过后** — 调用 `close_context` 关闭

#### 为什么 claim 后必须 brainstorming

claim 只是"认领"，不等于"知道怎么做"。

跳过 brainstorming 的后果：
- 返工成本是前期设计的 10 倍
- 技术方案没有记录，无法追溯
- 用户没有确认方案，可能做错方向

#### Red Flags - 立即停止

如果你发现自己这样想，**停止并启动 brainstorming**：

| 你的想法 | 为什么有问题 |
|---------|-------------|
| "这个需求很简单，不需要讨论" | 简单需求更容易遗漏边界情况 |
| "我已经知道怎么实现了" | 知道不等于讨论过方案并获得确认 |
| "先写代码，有问题再改" | 返工成本远高于前期设计 |
| "用户说 ok 就是让我直接实现" | ok 是同意 claim，不是同意跳过方案讨论 |

**所有这些都意味着：启动 brainstorming，不要跳过。**

#### Commit 格式规则

在 claimed context 下开发时，所有 commit message 末尾必须带上 context ID，便于 daily-review 的 context-matcher 精确匹配。

**格式**：
```
<type>(<scope>): <description>

<body>

Co-Authored-By: Claude ...
[context-id]
```

**示例**：
```
feat(flow): add commit context linking

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
[2026-03-16-commitpr-关联-context-信息]
```

#### 禁止行为

- 使用 `append_to_context` / `decide_context`（开发阶段禁用）
- claim 后直接写代码，跳过 brainstorming
- 跳过 test-cases 直接实现
- 发现需求问题时自行决定（应 `create_followup` 切回 Context 阶段）
- commit 不带 context ID（开发阶段禁止）

### 阶段切换规则

| 场景 | 当前状态 | 操作 |
|------|---------|------|
| "需求不对/要改" | open | `append_to_context` |
| "需求不对/要改" | decided | `reopen_context` |
| "需求不对/要改" | claimed/closed | `create_followup` |
| "开始开发" | decided | `claim_context` |
| "开发完成" | claimed | `close_context` |

---

## 飞书群同步

flow 工作流在两个关键节点询问用户是否把 spec 同步到飞书群，让团队第一时间看到决策与成果。

| 时机 | 触发 | stage | 行为 |
|------|------|-------|------|
| 需求锁定 | `decide_context` 之后 | `decided` | **创建**一份新的飞书文档（4 节），doc_id 存到 context 的 `feishu-link` artifact |
| 开发完成 | `close_context` 之后 | `closed` | 从 artifact **取出已存 doc_id**，整篇覆盖同一份文档（完整 7 节）|

**核心约定**：1 context = 1 飞书文档（迭代更新，不新建第二份）。

### 前置条件

webhook URL 通过环境变量 `FACIO_LARK_WEBHOOK_URL` 提供（变量名对齐 spec-ratifier，团队配一份同时支撑两个 skill）。

**读取顺序**（file-wins，与 spec-ratifier 一致）：

1. `--harness-config <path>` 显式指定的文件
2. 从 `$PWD` 向上找最近的 `.harness/config.env`，自动 `set -a; . <file>; set +a`
3. 当前 shell 已 export 的同名变量

**推荐配置方式（团队共享，私有项目）** — 在项目根 `.harness/config.env`：

```ini
# Required by spec-ratifier + flow skill 飞书同步
FACIO_LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/<hook-id>
```

此文件 spec-ratifier pre-check 也会 source；一次配置两处受益。**仅私有仓库可提交**，公开仓库需加入 `.gitignore` 改走方式 B。

**备选方式（个人环境，公开项目）** — 在 `~/.zshrc` 或 `~/.bashrc`：

```bash
export FACIO_LARK_WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/<hook-id>"
```

**多产品扩展**（选填）— 当不同 product 要发到不同群时：

```ini
# .harness/config.env
FACIO_LARK_WEBHOOK_URL=https://.../hook/default       # 默认
FACIO_LARK_WEBHOOK_URL_VIDEO_EDITOR=https://.../hook/aaa  # 按 product 路由
FACIO_LARK_WEBHOOK_URL_BINN=https://.../hook/bbb
# 脚本优先读 FACIO_LARK_WEBHOOK_URL_<PRODUCT>，fall back 到 FACIO_LARK_WEBHOOK_URL
# product 名小写 → 大写、连字符 → 下划线
```

**飞书 OAuth**（一次性）：`npx @larksuite/cli auth login`

### 流程

**1. 询问用户**（必做，不要默认执行）

用 `AskUserQuestion` 单选询问"是否同步飞书 / 跳过"。用户拒绝即跳过 → **不追问**、**不在后续节点重复询问**。

**2. 用户同意后，从 context 提炼结构化 markdown**

读 `get_context(includeChain=true)` 输出 + `manage_artifact(action='get', type='test-cases')`，按下面的模板把 markdown 写到 `/tmp/flow-spec-<context-id>.md`。

**章节骨架（1 context = 1 文档稳定结构）**：

| 章节 | decided 阶段 | closed 阶段 |
|------|-------------|------------|
| `## 需求背景` | ✅ 必填 | 不变 |
| `## 用户场景` | ✅ 必填 | 不变 |
| `## 验收标准` | ✅ 必填（含 `- [ ] xxx` 复选框，每条对应一个 test-case 或验收点）| **同章节**，把 `- [ ]` 改成 `- [x] ✅` 或 `- [ ] ❌ <未通过原因>` |
| `## 决策与权衡` | ✅ 必填 | 不变 |
| `## 最终方案概览` | 不写 | ✅ 必填（实际落地的方案，非代码层面）|
| `## 遗留问题 / 后续项` | 不写 | ✅ 必填（无则写 "无"）|

**写入规则**：
- 占位符（`<需求标题>`、`<context-id>`、`<YYYY-MM-DD>` 等）必须替换为真实值
- 章节无内容时写"无"而不是删除小节
- closed 阶段必须渲染**完整 4+3 节**（脚本走 overwrite 整篇覆盖）

**3. 调用同步脚本**

decide 阶段（创建文档）：

```bash
bash ~/.claude/skills/flow/sync-to-feishu.sh \
    --title    "<context.title>" \
    --markdown /tmp/flow-spec-<context-id>.md \
    --stage    decided \
    --product  <context.product> \
    [--summary "<一句话，给群卡片用，可空>"]
```

close 阶段（更新文档）：

```bash
# 先从 artifact 取出 doc_id
manage_artifact(contextId, action='get', type='feishu-link')
# → 解析 JSON 拿 doc_id

bash ~/.claude/skills/flow/sync-to-feishu.sh \
    --title    "<context.title>" \
    --markdown /tmp/flow-spec-<context-id>.md \
    --stage    closed \
    --product  <context.product> \
    --doc-id   <feishu-link.doc_id> \
    [--summary "<一句话>"]
```

脚本 stdout 输出 JSON：`{"doc_url": "...", "doc_id": "...", "webhook_ok": true}`。

**decide 阶段拿到结果后必做**：

```
manage_artifact(
  contextId,
  action='add',
  type='feishu-link',
  content=JSON.stringify({
    doc_id,
    doc_url,
    created_at: "<ISO 8601>",
    created_stage: "decided"
  })
)
```

**回显**：把 doc_url 贴给用户，便于核对内容。

### 失败处理

| 退出码 | 含义 | 应对 |
|-------|------|------|
| 2 | 参数错误 | 检查 --title / --markdown 路径 / --doc-id 在 closed stage 时是否提供 |
| 3 | webhook 未配置 | 让用户在项目 `.harness/config.env` 加 `FACIO_LARK_WEBHOOK_URL=...`，或在 `~/.zshrc` 加 `export FACIO_LARK_WEBHOOK_URL=...` |
| 4 | 文档创建/更新失败 | 跑 `npx @larksuite/cli doctor` 排查认证；查看 stderr 里的飞书错误码 |
| 5 | webhook 发送失败 | 检查 URL 有效性 + 群机器人安全设置；文档已建好时把 doc_url 直接贴给用户手动转发 |
| 6 | lark-cli 未认证 | `npx @larksuite/cli auth login` |

### 禁止行为

- 未询问就直接同步
- 用占位符（如 `<需求标题>`）当真实内容传给脚本
- 脚本失败时谎报成功
- close 阶段不读取 feishu-link artifact 直接走 create 路径（会建第二份文档，违反 1 context = 1 doc）
- decide / close 之外的时机主动调用同步脚本（其它时机如果用户主动要求可以执行，但**不要在 flow 工作流里默认触发**）

---

## 触发场景

### 场景 1: 新功能讨论

**识别**："我想做xxx"、"有个想法"、"能不能加个xxx"

**流程**：
1. 询问是否创建 context
2. `create_context` 或 `import_context`（文件路径）
3. 启动 `brainstorming` skill

### 场景 2: 已有功能问题

**识别**："之前的xxx有问题"、"xxx需要重新设计"

**流程**：
1. `list_contexts(keyword='xxx')` 搜索
2. 找到唯一匹配 → `create_followup`
3. 找到多个 → 列出让用户选
4. 未找到 → `create_context`

### 场景 3: 版本管理

**识别**："查看版本"、"版本状态"、"创建版本"、"规划 v0.x"

**流程**：
- 查看状态 → `get_version_status`
- 创建版本 → `create_version` → `list_contexts(plannable=true)` → `plan_version`
- 追加需求 → `plan_version(action='add', ...)`
- 移除需求 → `plan_version(action='remove', ...)`

### 场景 4: Bug 报告

**识别**："有个 bug"、"xxx 不工作"、"报错了"

**流程**：
1. `list_products` 获取产品列表
2. 确认产品（必须）
3. `create_bug`

### 场景 5: 查看 context

**识别**：想了解已有 context 的状态、内容或进展

**流程**：
1. `list_contexts(keyword='xxx')` 搜索
2. `get_context(includeChain=true)` 获取
3. 展示信息，根据状态询问下一步
4. 用户想继续讨论 → 启动 `brainstorming` skill

**查看后行为参考**（根据上下文灵活调整）：

| 状态 | 常见询问方向 |
|------|-------------|
| open | 是否继续讨论？ |
| decided | 是否认领开发？需要修改吗？ |
| claimed | 开发进展？需要帮忙？ |
| closed | 是否需要 followup？ |
| split | 查看哪个子 context？ |

### 场景 6: 验证完成

**识别**："验证通过"、"验证无误"、"测试通过"、"没问题"、"完成了"

**流程**：
1. `list_contexts(status=['claimed'])` 查找当前 claimed 的 context
2. 找到 → 询问是否关闭对应的 context
3. 用户确认 → `close_context`

---

## 路径检测（/flow 命令）

| 输入 | 动作 |
|------|------|
| `/flow ~/Work/spec.md` | `import_context` |
| `/flow 用户头像功能` | `create_context` |
| `/flow` | 询问讨论话题 |

**路径识别**：包含 `/` 或以 `.md` 结尾 → 文件路径

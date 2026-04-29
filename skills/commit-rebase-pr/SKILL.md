---
name: commit-rebase-pr
description: 所有 git 提交、推送、PR 操作都用此 skill — "commit"、"提交"、"push"、"推代码"、"提PR"、"create PR"、"rebase"、"合到main"。本地代码推到远端的标准流程。
---

# Commit → Rebase → PR

## Steps

### 1. 展示 diff，等用户确认
```bash
git status && git diff HEAD
```

### 2. Commit
```bash
git add <specific files>   # 不用 -A，避免误包含 sdk submodule / docs / .env
git commit -m "type(scope): description

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
commit message 风格跟随 `git log --oneline -5`。

### 3. Fetch + Review 云端改动
```bash
git fetch origin
git log HEAD..origin/main --oneline   # 云端有哪些新 commit
git diff HEAD...origin/main -- <我改过的文件>   # 云端在同文件改了什么
```

**Review 重点**（有云端改动时必做）：
- 云端与本地改动是否涉及同一函数/逻辑？
- 云端改动的意图是什么，和本地是否方向一致？
- rebase 后合并结果是否逻辑正确（不只是无冲突标记）？

把结论告诉用户（一两句）：「云端改了 X，与本地无冲突」或「云端改了 Y，需要注意 Z」。

### 3.5 Regression Check（有云端改动时必做）

检查本次 diff 是否把云端**刚删的东西加回来**，或**刚加的东西删掉**：

```bash
# 我的 branch 删掉了哪些文件（云端最近还加过的）
git diff origin/main...HEAD --diff-filter=D --name-only

# 我的 diff 里有没有加回云端最近 10 个 commit 刚删掉的行
git log --oneline -10 origin/main
git diff origin/main...HEAD | grep '^+' | grep -v '^+++' > /tmp/my_additions.txt
# 对照 git show <recent-commit> 里的 '-' 行手动比对
```

如果发现命中 → **停下来告诉用户，让用户决定是否保留**，不要自动 rebase 过去。

### 4. Rebase
```bash
git rebase origin/main
```
有冲突时：逐文件解决 → 验证逻辑正确 → `git add` → `git rebase --continue`。

### 5. Push
```bash
git push origin HEAD --force-with-lease
```

### 6. 生成 PR 描述并创建 PR

#### 6.1 判断改动类型

阅读完整 diff（所有 commit，不只是最新的），判断属于以下哪种：

| 类型 | 特征 |
|------|------|
| UI/样式 | 改了组件、CSS、布局、动画 |
| Bug 修复 | 修复了错误行为、崩溃、数据异常 |
| 新功能 | 新增用户可感知的能力 |
| 重构 | 行为不变，改结构/命名/抽象 |
| 性能优化 | 减少耗时、内存、渲染次数 |
| 基础设施 | CI、构建、依赖、配置 |

一个 PR 可能混合多种类型，按主要类型组织，次要类型在 Impact 中说明。

#### 6.2 按以下结构生成 PR body

**Why（必填）**
完整描述用户/开发者遇到了什么问题，或缺少什么能力。
篇幅根据问题复杂度决定——简单 typo 一句话，多模块架构问题用几段话讲清楚背景、现状、痛点。
- 让一个不了解这段代码历史的 reviewer 也能完全理解问题
- 如有 issue/讨论/Sentry link，引用后仍需用自己的话描述问题本质
- 不要写"优化了 XX"——说清楚优化前的痛点是什么
- 如果问题有量化数据（崩溃率、影响用户数、性能指标），务必包含

**Root Cause（仅 Bug 修复）**
详细解释 bug 的因果链：
- 什么前置条件/操作序列触发了问题
- 代码执行到哪里时，哪个变量/状态不符合预期
- 这个错误状态如何传播并最终导致用户可见的问题

用代码块贴关键片段、错误日志或堆栈。目标是让 reviewer 读完后能独立得出"确实是这里的问题"的结论。

**Solution（必填）**
- 选择了什么方案、为什么选这个
- 如果改动不止一处，解释每处改动的作用和它们之间的关系
- 如果考虑过其他方案但放弃了，说明放弃的理由
- 如果方案有已知局限或 tradeoff，主动说明

**Impact（必填）**
分两部分：
- 受影响范围：改了哪些模块/文件/接口；如果改了公共接口/类型/协议，列出所有调用方及影响
- 不受影响范围：哪些看似相关的模块确认不受影响，以及为什么（帮 reviewer 缩小 review 范围）

**Risk（必填）**
逐条列出风险点和边界情况。每条包含：
- 风险描述：什么情况下可能出问题
- 处理方式：已处理（如何）/ 可接受（为什么）/ 需关注（请 reviewer 重点看）
- 概率和影响评估

如果确实低风险，解释为什么低风险——要说清楚原因（比如：该常量只在一处使用、该函数没有其他调用方）。

**Evidence（必填，根据类型选择）**

| 改动类型 | 必须提供的证据 |
|----------|--------------|
| UI/样式 | Before/After 截图或 GIF，覆盖正常态和边界态。未提供则标注 `[TODO: 补充截图]` |
| Bug 修复 | 复现步骤（精确到操作序列）+ 修复前错误日志/堆栈 + 修复后正常输出 |
| 新功能 | 功能演示截图/GIF，或关键路径的输入→输出示例 |
| 重构 | `tsc --noEmit` 通过 + 现有测试全绿（贴输出） |
| 性能优化 | 优化前后的 benchmark/profile 数据对比（同环境、同数据集） |
| 基础设施 | CI 运行结果截图，或本地验证命令的完整输出 |

**Test Plan（必填，checklist 格式）**
用 `- [ ]` 列出验证项，分三层：
- 自动化测试：新增/已有的单测、集成测试（标注文件名和场景）
- 手动验证：写清楚操作步骤和预期结果（不是"测试 resize"，而是"将面板从 600px 拖到 200px，观察卡片列数变化"）
- 回归验证：相关功能未被破坏的验证点；确保每个 Risk 条目都有对应覆盖

#### 6.3 自检

生成后逐条检查：
1. 一个不了解这段代码的 reviewer，只看描述能否完全理解这个 PR？
2. Why 是否回答了"为什么现在要改"和"不改会怎样"？
3. Solution 是否回答了"为什么选这个方案而不是其他"？
4. 每个 Risk 都有对应的 Evidence 或 Test Plan 项覆盖？
5. Evidence 有没有空着的？空着的标注 `[TODO: 用户补充]`
6. Test Plan 的手动验证步骤，是否具体到另一个人能照着做？

#### 6.4 创建 PR

```bash
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
<生成的 PR body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
返回 PR URL。

## 注意事项
- `git add` 指定文件，不用 `-A`
- rebase 后用 `--force-with-lease`，不用 `--force`
- 云端无新 commit 时跳过 Step 3 的 review

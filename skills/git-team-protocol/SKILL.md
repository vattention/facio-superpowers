---
name: git-team-protocol
description: 涉及团队协作的 git 操作都用此 skill — 共享分支、merge 冲突、pull 远端改动、review 同事提交、静默覆盖问题、force-push 安全、团队 git 规范。触发词："同事改了"、"代码被覆盖"、"分支冲突"、"merge"、"pull下来有问题"。
---

# Git 团队协作规范

## 概述

Git 的三方合并**无法检测语义级覆盖** — 如果同事 A 拉取了你的删除 commit 后推送了旧文件副本，Git 会认为这是"新增"并静默接受。唯一的防线是流程 + CI，而不是 Git 机制本身。

## 分支模型

```
main / dev          ← 受保护，只能通过 PR 合入，禁止直接推送
feat/<你>/<主题>     ← 个人短期分支（≤3 天）
feat/<共享>          ← 团队集成分支，同样受保护
```

**硬性规则：**
- 受保护分支：零直推、零强推
- 一个分支 = 一个主题 = 一个 PR
- 开分支 → 完成 → 合并 → 删除，不超过 3 天

## 日常工作流

```bash
# 开始
git checkout main && git pull --rebase
git checkout -b feat/<你>/<主题>

# 推送前自检（全部 5 步必做）
yarn tsc --noEmit                        # 1. 类型检查通过
git fetch origin
git diff origin/main...HEAD --name-only  # 2. 确认改动范围
git log origin/main..HEAD --oneline      # 3. 确认 commit 数量合理
git rebase origin/main                   # 4. 保持线性历史
yarn tsc --noEmit                        # 5. rebase 后再查一遍

git push -u origin feat/<你>/<主题>
gh pr create --base main
```

## 回归检测器（每次推送前必跑）

检测"我的 PR 是否静默撤销了别人最近的改动"：

```bash
# 我的分支删掉了哪些 main 上最近新增的文件
git diff origin/main...HEAD --diff-filter=D --name-only

# 我的分支是否加回了 main 上最近删掉的行
git log --oneline -10 origin/main | awk '{print $1}' | xargs -I{} \
  git diff {}^..{} --unified=0 | grep '^-' | grep -Fxf - \
  <(git diff origin/main...HEAD | grep '^+') | head -20
```

任一命令有输出：**停下来排查，确认无误后再推送。**

本地快捷别名：

```bash
git config --global alias.regcheck \
  "!git fetch origin && git diff origin/main...HEAD --diff-filter=D --name-only && echo '---deleted-check done'"
```

## 文件同步提交检测

文件同步提交的特征（发现后警告作者，合并前要求解释）：

| 信号 | 阈值 |
|------|------|
| 单次提交改动文件数 | > 15 |
| 提交信息包含 `Sync`、`Update from local`、`Batch` | 任何 |
| 作者邮箱含机器名（`MacBook`、`DESKTOP-`） | 任何 |
| diff 删除了最近已合并 PR 新增的行 | 任何 |

审查清单：
- diff 是否删除了 main 最近 5 个 commit 中合入的内容？
- diff 是否加回了被明确移除的 import/文件？
- `yarn tsc --noEmit` 是否通过？

## 冲突处理规范

| 冲突类型 | 处理规则 |
|----------|----------|
| 不重叠的编辑 | 两边都保留 — rebase 后手动验证 |
| 你删了，对方加回来了 | 跟作者确认意图后再解决 |
| 双方改了同一函数 | 对齐需求，必要时保留双方逻辑 |
| 对方删了，你依赖它 | 创建 followup 任务，不要静默恢复 |

**禁止：**不看 diff 直接 accept-all-ours 或 accept-all-theirs。

## 高风险删除规范

删除业务逻辑 / 公共 API / 共享工具时 — 先在删除 PR 之前提交一个废弃标记：

```ts
// DEPRECATED 2026-04-22 @yourname — 下个 PR 移除，请勿依赖
```

这会迫使 Git 在其他仍使用旧代码的分支上产生**真实冲突**，而不是静默覆盖。

## 分支保护设置（GitHub）

`main` 及所有 `feat/*` 集成分支必须开启：

- ☑ 合并前必须 PR（至少 1 人批准）
- ☑ 新提交后自动撤销过期批准
- ☑ 必须通过状态检查：`ci/tsc`、`ci/lint`
- ☑ 合并前分支必须是最新的
- ☑ 要求线性历史
- ☑ 不允许绕过（包括管理员）

## 最小 CI 门禁

```yaml
# .github/workflows/ci.yml
on:
  pull_request:
    branches: [main, 'feat/**']
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: yarn }
      - run: yarn install --immutable
      - run: yarn tsc --noEmit
      - run: yarn lint
```

## 红线（违反则立即 revert）

1. 直推受保护分支
2. 文件同步 / 整目录覆盖提交
3. 在共享分支上 `git push --force`
4. 未通过 CI 就合并
5. 不看 diff 直接全部接受解决冲突
6. PR 开超过 3 天未合并或关闭

## 一句话记住

> fetch + rebase 再推 · 小提交 · 删除先标废弃 · 共享分支必须 PR · CI 必须过

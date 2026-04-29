---
name: sdk-ship
description: Use when user wants to publish/ship/release SDK changes, sync SDK to production, update app SDK version, push SDK fix to remote, or says things like "发布sdk", "sdk上线", "把sdk改动同步", "提交sdk", "sdk打包发布", "推到线上" — covers SDK rebase, beta publish, app rebase, and PR creation.
---

# SDK Ship Flow

完成 SDK 修改后，将改动同步到线上并更新应用层的标准流程。

## 流程总览

```
SDK: rebase → review → push → beta publish
App: sdk:unlink → 升级版本 → rebase main → commit → push → open PR
```

---

## Step 1 — SDK rebase & push

```bash
# 在 sdk/ 目录下操作
git fetch origin
git log HEAD..origin/main --oneline                        # 云端有哪些新 commit
git diff HEAD...origin/main -- <我改过的文件>               # 云端在同文件改了什么
```

**Review 重点**（有云端改动时必做）：
- 云端与本地改动是否涉及同一函数/逻辑？
- 合并后结果是否逻辑正确？

把结论告诉用户后再继续：

```bash
git rebase origin/main
git push origin main
```

**冲突逻辑规则**
- `package.json` 版本号：取 origin/main 的正式版本号，不保留 beta 版本号
- `transforms.ts` / `filter.cpp`：保留我们的修复逻辑（均匀缩放、meta.media 覆盖）
- 其他文件：优先取 origin/main，逐处确认逻辑正确性

---

## Step 2 — 发布 beta 包

**前提：确认 GitHub Packages 认证已配置**

SDK 发布到 GitHub Packages（`https://npm.pkg.github.com`），需要有效的 GitHub Token（`write:packages` 权限）：

```bash
# 检查 token 是否已配置
npm config get //npm.pkg.github.com/:_authToken

# 若未配置，先设置（token 需有 write:packages 权限）
npm config set //npm.pkg.github.com/:_authToken <GITHUB_TOKEN>
```

确认后再执行发布：

```bash
cd /Users/boye/code/vattention/facio-next/sdk
bash scripts/publish-all.sh --beta --yes
```

脚本自动：编译 native → 计算版本号（如 `0.4.X-beta.N`）→ 发布所有包 → 验证上线 → 还原 package.json

---

## Step 3 — 应用层切回 npm 模式并升级版本

```bash
cd /Users/boye/code/vattention/facio-next
yarn sdk:unlink                 # 切回 npm 硬链接

# 更新 package.json 中四个 SDK 依赖到 beta 版本
node -e "
const fs = require('fs'), v = 'NEW_VERSION';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
['@vattention/mlt-engine','@vattention/mlt-export','@vattention/mlt-node','@vattention/mlt-preview']
  .forEach(k => pkg.dependencies[k] = v);
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
yarn install
```

---

## Step 4 — 应用层 rebase main 并处理冲突

```bash
git fetch origin
git log HEAD..origin/main --oneline                        # 云端有哪些新 commit
git diff HEAD...origin/main -- <我改过的文件>               # 云端在同文件改了什么
```

**Review 重点**（有云端改动时必做）：
- 云端与本地改动是否涉及同一函数/逻辑？
- 合并后结果是否逻辑正确？

把结论告诉用户后再继续：

```bash
git rebase origin/main
```

**冲突规则**
- `package.json` SDK 版本号：保留我们刚写入的 beta 版本
- `yarn.lock`：重新生成（`yarn install` 后 `git add yarn.lock`）
- `sdk` submodule：取 origin/main 引用的 commit（`git ls-tree origin/main sdk`）
- 业务文件（组件/domain）：逐处对比 main 改动，确认逻辑不冲突后合并
- 遇到逻辑冲突时：阅读双方改动意图，选取更完整的版本，必要时人工确认

处理完毕后：
```bash
git add <resolved files>
git rebase --continue
```

---

## Step 5 — commit & push & open PR

```bash
# 如有未提交的工作先提交
git add -A
git commit -m "feat/fix: <描述>"

# 推送当前分支
git push origin HEAD

# 开 PR 到 main
gh pr create --base main --title "<PR 标题>" --body "$(cat <<'EOF'
## Summary
- SDK 修复：<描述>
- 应用层变更：<描述>

## SDK 版本
`@vattention/mlt-* NEW_VERSION`

## Test plan
- [ ] 验证旋转/变换效果
- [ ] 验证其他受影响功能

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 快速检查清单

- [ ] SDK `git push origin main` 完成
- [ ] beta 包所有 6 个包验证上线
- [ ] 应用层 `package.json` 版本已更新
- [ ] `yarn install` 成功，无报错
- [ ] rebase 无遗留冲突标记（`grep -r "<<<<<<" src/`）
- [ ] PR 已创建，链接已贴给用户

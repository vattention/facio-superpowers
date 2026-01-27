# 发布到 GitHub Packages

## 步骤 1：更新 package.json

将 `your-github-username` 替换为你的 GitHub 用户名：

```json
{
  "name": "@vattention/facio-superpowers",
  "repository": {
    "url": "https://github.com/vattention/facio-superpowers.git"
  }
}
```

## 步骤 2：创建 GitHub Personal Access Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 设置：
   - Note: `npm-publish`
   - Expiration: 根据需要选择
   - 勾选权限：
     - ✅ `write:packages` (包含 read:packages)
     - ✅ `repo` (如果是私有仓库)
4. 点击 "Generate token"
5. **复制 token**（只显示一次）

## 步骤 3：配置 NPM 认证

```bash
# 方式 1：使用 npm login
npm login --registry=https://npm.pkg.github.com

# 输入：
# Username: 你的 GitHub 用户名
# Password: 刚才创建的 Personal Access Token
# Email: 你的 GitHub 邮箱

# 方式 2：直接配置 .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN" >> ~/.npmrc
```

## 步骤 4：推送到 GitHub

```bash
cd /Users/dawinialo/Work/facio-superpowers

# 初始化 git（如果还没有）
git init
git add .
git commit -m "feat: initial release"

# 添加远程仓库
git remote add origin https://github.com/vattention/facio-superpowers.git

# 推送
git branch -M main
git push -u origin main
```

## 步骤 5：发布到 GitHub Packages

```bash
npm publish
```

## 步骤 6：验证发布

访问：
```
https://github.com/vattention/facio-superpowers/packages
```

## 使用已发布的包

### 用户需要配置 .npmrc

在项目根目录创建 `.npmrc`：

```
@vattention:registry=https://npm.pkg.github.com
```

### 安装使用

```bash
# 安装
npm install -g @vattention/facio-superpowers

# 或直接使用 npx
npx @vattention/facio-superpowers init
```

## 自动化发布流程

本项目已配置自动化发布工作流。当推送新的 git tag 时，GitHub Actions 会自动创建 Release 并发布到 GitHub Packages。

### 快速发布流程

**方式 1：使用 npm 脚本（推荐）**

```bash
cd /Users/dawinialo/Work/facio-superpowers

# 1. 确保所有更改已提交
git add .
git commit -m "feat: your feature description"

# 2. 自动 bump 版本并创建 tag
npm run version:patch   # 1.0.0 -> 1.0.1（修复 bug）
# 或
npm run version:minor   # 1.0.0 -> 1.1.0（新功能）
# 或
npm run version:major   # 1.0.0 -> 2.0.0（重大变更）

# 3. 推送代码和 tag，触发自动发布
npm run release
```

**方式 2：手动创建 tag**

```bash
# 1. 手动更新 package.json 中的 version 字段
# 例如：从 "1.0.0" 改为 "1.0.1"

# 2. 提交版本更改
git add package.json
git commit -m "chore: bump version to 1.0.1"

# 3. 创建 tag（必须以 v 开头）
git tag v1.0.1

# 4. 推送到 GitHub
git push && git push --tags
```

### 发布后验证

1. **查看工作流执行**
   - 访问：https://github.com/vattention/facio-superpowers/actions
   - 等待工作流完成（通常 1-2 分钟）

2. **验证 Release**
   - 访问：https://github.com/vattention/facio-superpowers/releases
   - 确认新版本已创建，包含 RELEASE-NOTES.md 的内容

3. **验证包发布**
   - 访问：https://github.com/vattention/facio-superpowers/packages
   - 确认新版本已发布

4. **测试安装**
   ```bash
   npm install @vattention/facio-superpowers@版本号 --registry=https://npm.pkg.github.com
   ```

### Tag 命名规范

- ✅ **正确格式**：`v1.0.0`, `v1.2.3`, `v2.0.0-beta.1`
- ❌ **错误格式**：`1.0.0`（缺少 v 前缀），`release-1.0.0`

### 预发布版本

发布 beta 或 alpha 版本：

```bash
# 手动更新 package.json version 为 "1.0.0-beta.1"
git add package.json
git commit -m "chore: bump version to 1.0.0-beta.1"
git tag v1.0.0-beta.1
git push && git push --tags
```

预发布版本会自动标记为 "Pre-release"。

### 工作流详情

`.github/workflows/publish.yml` 会执行以下步骤：

1. ✅ 验证 `package.json` 版本号与 tag 是否匹配
2. 📦 安装依赖
3. 🎉 创建 GitHub Release（使用 RELEASE-NOTES.md）
4. 📤 发布到 GitHub Packages
5. ✨ 输出发布结果链接

### 故障排查

**问题：工作流失败，提示版本号不匹配**
- 确保 `package.json` 中的 `version` 字段与 tag 版本一致
- Tag `v1.0.1` 应对应 `package.json` 中的 `"version": "1.0.1"`

**问题：npm publish 失败**
- 检查仓库的 Actions 权限设置
- 确保 GitHub Actions 有 `packages: write` 权限

**问题：tag 推送后没有触发工作流**
- 确保 tag 以 `v` 开头（如 `v1.0.0`）
- 检查 `.github/workflows/publish.yml` 文件是否存在

---

## 手动发布（仅用于特殊情况）

如果需要手动发布（不推荐）：

1. **包名必须带 scope**：`@vattention/package-name`
2. **仓库必须存在**：先在 GitHub 创建仓库
3. **Token 权限**：确保 token 有 `write:packages` 权限
4. **公开访问**：GitHub Packages 默认是私有的，需要设置为公开

## 设置包为公开

发布后，在 GitHub 包页面：
1. 进入 Package settings
2. 找到 "Danger Zone"
3. 点击 "Change visibility" → "Public"

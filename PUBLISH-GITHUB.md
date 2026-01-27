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

## 自动化发布（可选）

创建 `.github/workflows/publish.yml`：

```yaml
name: Publish Package

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://npm.pkg.github.com'
      - run: npm ci
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

之后只需在 GitHub 上创建 Release，就会自动发布。

## 注意事项

1. **包名必须带 scope**：`@vattention/package-name`
2. **仓库必须存在**：先在 GitHub 创建仓库
3. **Token 权限**：确保 token 有 `write:packages` 权限
4. **公开访问**：GitHub Packages 默认是私有的，需要设置为公开

## 设置包为公开

发布后，在 GitHub 包页面：
1. 进入 Package settings
2. 找到 "Danger Zone"
3. 点击 "Change visibility" → "Public"

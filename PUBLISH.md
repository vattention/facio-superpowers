# 发布到 NPM 的步骤

## 发布前检查

### 1. 更新仓库信息

在 `package.json` 中更新以下字段：
- `repository.url`: 你的 GitHub 仓库地址
- `bugs.url`: Issues 页面地址
- `homepage`: 项目主页地址

### 2. 确保 Git 仓库已推送

```bash
cd /Users/dawinialo/Work/facio-superpowers

# 添加所有文件
git add .

# 提交
git commit -m "feat: add CLI tool for easy installation"

# 推送到 GitHub
git push origin main
```

### 3. 测试 CLI 工具

```bash
# 本地测试
cd /Users/dawinialo/Work/facio-superpowers
npm link

# 在测试项目中使用
cd /path/to/test-project
facio-superpowers init

# 验证是否正常工作
```

### 4. 登录 NPM

```bash
npm login
```

需要输入：
- Username
- Password
- Email
- 2FA code (如果启用了)

### 5. 发布到 NPM

```bash
cd /Users/dawinialo/Work/facio-superpowers

# 发布（首次发布）
npm publish --access public

# 或者如果不使用 @facio scope
# 修改 package.json 中的 name 为 "facio-superpowers"
# 然后运行
npm publish
```

### 6. 验证发布

```bash
# 在新目录测试
cd /tmp
mkdir test-install
cd test-install

# 测试安装
npx @facio/superpowers init
# 或
npx facio-superpowers init
```

## 后续更新

### 更新版本

```bash
# 补丁版本 (1.0.0 -> 1.0.1)
npm version patch

# 小版本 (1.0.0 -> 1.1.0)
npm version minor

# 大版本 (1.0.0 -> 2.0.0)
npm version major
```

### 发布更新

```bash
git push && git push --tags
npm publish
```

## 注意事项

1. **包名选择**：
   - `@facio/superpowers` - 需要 NPM organization
   - `facio-superpowers` - 不需要 organization，更简单

2. **首次发布**：
   - 如果使用 scoped package (@facio/superpowers)，需要 `--access public`
   - 如果使用普通包名，直接 `npm publish`

3. **版本管理**：
   - 遵循语义化版本 (Semantic Versioning)
   - 每次发布前更新版本号

## 推荐的包名

建议使用 `facio-superpowers`（不带 scope），因为：
- ✅ 更简单，不需要创建 NPM organization
- ✅ 用户使用更方便：`npx facio-superpowers init`
- ✅ 避免权限问题

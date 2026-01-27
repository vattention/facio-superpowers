#!/bin/bash
# 发布脚本

set -e

echo "🚀 准备发布 facio-superpowers..."
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在 facio-superpowers 目录下运行此脚本"
    exit 1
fi

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  检测到未提交的更改"
    echo ""
    git status --short
    echo ""
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 运行测试
echo "🧪 测试 CLI..."
node cli.js || {
    echo "❌ CLI 测试失败"
    exit 1
}
echo "✅ CLI 测试通过"
echo ""

# 检查 NPM 登录状态
echo "🔐 检查 NPM 登录状态..."
npm whoami || {
    echo "❌ 未登录 NPM，请先运行: npm login"
    exit 1
}
echo "✅ 已登录 NPM"
echo ""

# 显示将要发布的文件
echo "📦 将要发布的文件："
npm pack --dry-run
echo ""

# 确认发布
read -p "确认发布到 NPM？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消发布"
    exit 1
fi

# 发布
echo "📤 发布到 NPM..."
npm publish

echo ""
echo "✅ 发布成功！"
echo ""
echo "验证安装："
echo "  npx facio-superpowers init"
echo ""
echo "查看包信息："
echo "  https://www.npmjs.com/package/facio-superpowers"

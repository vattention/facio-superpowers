# {项目名称}

> {一句话描述项目}

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 项目架构

本项目采用模块化架构，详细文档请参见：

- 📚 [文档地图](./docs/DOCUMENTATION-MAP.md) - 完整文档导航
- 🏗️ [系统架构](./docs/ARCHITECTURE.md) - 整体架构说明
- 📦 [模块文档](./docs/modules/) - 各模块详细文档

### 核心模块

| 模块 | 描述 | 文档 |
|------|------|------|
| Renderer | 渲染进程 | [docs/modules/renderer/](./docs/modules/renderer/) |
| Main | 主进程 | [docs/modules/main/](./docs/modules/main/) |
| Account | 账户系统 | [docs/modules/account/](./docs/modules/account/) |
| Settings | 设置系统 | [docs/modules/settings/](./docs/modules/settings/) |

## 开发工作流

本项目使用 AI 辅助开发工作流（基于 Claude Code / Cursor）：

### 开发新功能

```bash
# 1. 设计阶段
/brainstorming

# 2. 实现计划
/writing-plans

# 3. 开发前准备
/prepare-context

# 4. 实现功能
# ... 编写代码 ...

# 5. 完成验证
/verification-before-completion
```

详见：[开发工作流文档](./docs/WORKFLOW.md)

## 技术栈

- **框架**：{框架名称}
- **语言**：TypeScript
- **状态管理**：{状态管理方案}
- **样式**：{样式方案}

详见：[技术栈文档](./docs/TECH-STACK.md)

## 贡献指南

请参阅 [CONTRIBUTING.md](./CONTRIBUTING.md)

## 许可证

{许可证类型}

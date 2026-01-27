# 文档地图

> 项目文档导航 | 最后更新：{DATE}

## 📖 快速导航

### 新成员入门

1. [项目 README](../README.md) - 项目概述和快速开始
2. [系统架构](./ARCHITECTURE.md) - 整体架构说明
3. [技术栈](./TECH-STACK.md) - 技术选型和理由
4. [开发工作流](./WORKFLOW.md) - 开发流程和规范

### 开发者指南

- [贡献指南](../CONTRIBUTING.md) - 如何贡献代码
- [代码规范](./CODE-STYLE.md) - 编码标准
- [测试指南](./TESTING.md) - 测试策略和方法

## 🏗️ 架构文档

### 系统级文档

| 文档 | 描述 | 路径 |
|------|------|------|
| 系统架构 | 整体架构设计 | [docs/ARCHITECTURE.md](./ARCHITECTURE.md) |
| 技术栈 | 技术选型说明 | [docs/TECH-STACK.md](./TECH-STACK.md) |
| 数据流 | 系统数据流向 | [docs/DATA-FLOW.md](./DATA-FLOW.md) |

### 模块文档

| 模块 | 描述 | 文档入口 |
|------|------|---------|
| Renderer | 渲染进程 | [docs/modules/renderer/README.md](./modules/renderer/README.md) |
| Main | 主进程 | [docs/modules/main/README.md](./modules/main/README.md) |
| Account | 账户系统 | [docs/modules/account/README.md](./modules/account/README.md) |
| Settings | 设置系统 | [docs/modules/settings/README.md](./modules/settings/README.md) |

## 📋 架构决策记录（ADR）

所有重要的架构决策都记录在 [docs/adr/](./adr/) 目录中。

### 按主题分类

#### 技术选型
- [ADR-001: 技术栈选择](./adr/001-tech-stack.md)
- [ADR-002: 状态管理方案](./adr/002-state-management.md)

#### 架构模式
- [ADR-003: 模块化架构](./adr/003-modular-architecture.md)
- [ADR-004: IPC 通信模式](./adr/004-ipc-pattern.md)

#### 功能实现
- [ADR-005: 认证方案](./adr/005-authentication.md)

完整列表：[docs/adr/README.md](./adr/README.md)

## 📝 设计文档

开发前的设计文档存放在 [docs/plans/](./plans/) 目录中。

### 最近的设计

| 日期 | 功能 | 文档 | 状态 |
|------|------|------|------|
| 2026-01-27 | 功能A | [设计文档](./plans/2026-01-27-feature-a-design.md) | ✅ 已完成 |
| 2026-01-26 | 功能B | [设计文档](./plans/2026-01-26-feature-b-design.md) | 🚧 开发中 |

完整列表：[docs/plans/README.md](./plans/README.md)

## 💡 示例代码

标准实现模式的示例代码分布在各模块的 `examples/` 目录中：

- [Renderer 示例](./modules/renderer/examples/)
- [Main 示例](./modules/main/examples/)
- [Account 示例](./modules/account/examples/)
- [Settings 示例](./modules/settings/examples/)

## 🔍 如何查找文档

### 按需求类型

| 我想... | 查看文档 |
|---------|---------|
| 了解项目整体架构 | [系统架构](./ARCHITECTURE.md) |
| 了解某个模块 | [模块文档](./modules/) |
| 了解某个技术决策的理由 | [ADR](./adr/) |
| 查看标准实现方式 | [示例代码](./modules/*/examples/) |
| 了解开发流程 | [开发工作流](./WORKFLOW.md) |

### 按模块查找

每个模块的文档入口是 `docs/modules/{module}/README.md`，包含：
- 模块概述
- 技术栈
- 核心组件
- API 文档
- 示例代码
- 相关 ADR

## 📚 文档维护

### 文档更新流程

文档由 AI 工具自动生成和更新：

1. **开发前**：`/brainstorming` 生成设计文档
2. **开发后**：`/verification-before-completion` 更新模块文档和 ADR
3. **手动审查**：开发者审查并确认文档准确性

### 文档同步检查

```bash
# 检查文档与代码是否同步
npm run docs:check

# 更新文档索引
npm run docs:index
```

## 🔗 外部资源

- [项目 Wiki](https://github.com/org/project/wiki)
- [API 文档](https://api-docs.example.com)
- [设计稿](https://figma.com/...)

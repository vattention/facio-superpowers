# 模块化文档系统指南

> 为 AI 辅助开发设计的模块化文档管理方案

## 概述

本指南介绍如何使用模块化文档系统来管理项目文档，使文档与代码保持同步，并作为 LLM 的有效输入。

## 核心理念

### 1. 文档与代码同步

- 文档由 AI 工具自动生成和更新
- 每次代码变更后自动检查文档需求
- 模块文档反映代码的当前状态

### 2. 模块化组织

- 每个模块有独立的文档目录
- 模块文档包含：README、ARCHITECTURE、API、示例
- 便于模块独立维护和理解

### 3. LLM 友好

- 结构化的文档格式
- 清晰的导航和引用
- 包含文件路径，便于验证

## 文档结构

```
project-root/
├── README.md                        # 简化的项目介绍
├── CLAUDE.md                        # AI 工具配置
│
├── docs/
│   ├── DOCUMENTATION-MAP.md         # 文档地图（导航入口）
│   ├── ARCHITECTURE.md              # 系统架构
│   ├── TECH-STACK.md                # 技术栈说明
│   ├── WORKFLOW.md                  # 开发工作流
│   │
│   ├── adr/                         # 架构决策记录（扁平化）
│   │   ├── 001-decision.md
│   │   ├── 002-decision.md
│   │   └── README.md                # ADR 索引
│   │
│   ├── plans/                       # 设计文档（扁平化）
│   │   ├── 2026-01-27-feature-design.md
│   │   └── README.md
│   │
│   └── modules/                     # 模块文档（核心）
│       ├── renderer/
│       │   ├── README.md            # 模块概述（LLM 主要输入）
│       │   ├── ARCHITECTURE.md      # 架构详细说明
│       │   ├── COMPONENTS.md        # 组件清单
│       │   ├── API.md               # API 文档
│       │   └── examples/            # 示例代码
│       ├── main/
│       │   ├── README.md
│       │   ├── ARCHITECTURE.md
│       │   └── examples/
│       ├── account/
│       │   ├── README.md
│       │   ├── ARCHITECTURE.md
│       │   ├── API.md
│       │   └── examples/
│       └── settings/
│           ├── README.md
│           ├── ARCHITECTURE.md
│           └── examples/
```

## 文档类型说明

### 1. 根目录 README.md

**用途**：项目快速介绍

**内容**：
- 项目概述（一句话）
- 快速开始（安装、启动、构建）
- 文档地图链接
- 核心模块列表
- 开发工作流简介

**模板**：`templates/README-ROOT.md`

**特点**：
- 简洁明了，避免信息过载
- 主要作为导航入口
- 详细内容链接到专门文档

### 2. 文档地图（DOCUMENTATION-MAP.md）

**用途**：文档导航中心

**内容**：
- 快速导航（新成员入门、开发者指南）
- 架构文档索引
- 模块文档索引
- ADR 分类索引
- 设计文档列表
- 示例代码索引

**模板**：`templates/DOCUMENTATION-MAP.md`

**特点**：
- 作为文档的"目录"
- 按主题和模块分类
- 提供快速查找指南

### 3. 模块 README.md

**用途**：模块的主要文档，LLM 的主要输入

**内容**：
- 模块概述
- 当前状态（已实现、开发中、计划中）
- 技术栈（链接到 ADR）
- 核心组件表格（包含文件路径）
- 数据流简图
- API 列表
- 示例链接
- 相关 ADR
- 开发指南

**模板**：`templates/MODULE-README.md`

**特点**：
- 结构化，易于 AI 解析
- 包含文件路径，便于验证同步
- 链接到详细文档
- 反映模块当前状态

### 4. 模块 ARCHITECTURE.md

**用途**：模块架构详细说明

**内容**：
- 架构概述
- 设计原则
- 目录结构
- 分层架构（表现层、状态层、业务层、数据层）
- 数据流详解
- 核心组件详解
- 状态管理
- API 设计
- 依赖关系
- 错误处理
- 性能优化
- 测试策略
- 安全考虑
- 扩展性

**模板**：`templates/MODULE-ARCHITECTURE.md`

**特点**：
- 深入的架构说明
- 包含代码示例
- 说明设计决策
- 指导新功能开发

### 5. ADR（架构决策记录）

**用途**：记录重要架构决策

**位置**：`docs/adr/`（扁平化，按时间编号）

**内容**：
- 决策背景
- 决策内容
- 决策理由
- 备选方案分析
- 影响评估
- 相关决策链接

**模板**：`templates/adr-template.md`

**特点**：
- 只增不改（历史记录）
- 按时间顺序编号
- 文件名标注相关模块

### 6. 设计文档

**用途**：开发前的设计说明

**位置**：`docs/plans/`（扁平化）

**生成方式**：`/brainstorming` skill

**特点**：
- 开发前生成
- 完成后归档到 archive/
- 文件名标注功能/模块

## 自动化工作流

### 开发新功能的完整流程

```bash
# 1. 设计阶段
/brainstorming
# → 生成 docs/plans/YYYY-MM-DD-feature-design.md

# 2. 实现计划
/writing-plans
# → 生成 docs/plans/YYYY-MM-DD-feature.md

# 3. 开发前准备
/prepare-context
# → 自动查找相关 ADR 和设计文档

# 4. 实现功能
# ... 编写代码 ...

# 5. 完成验证
/verification-before-completion
# → 自动检查：
#   - 运行测试
#   - 检查 ADR 需求
#   - 检查模块文档需求
#   - 提供自动生成/更新选项
```

### verification-before-completion 的文档检查

当你调用 `/verification-before-completion` 时，AI 工具会：

1. **分析代码变更**
   ```bash
   git diff --cached --stat
   git diff --cached
   ```

2. **识别涉及的模块**
   - 通过文件路径识别（如 `src/modules/account/` → account 模块）

3. **检查 ADR 需求**
   - 新库/框架？
   - 架构模式变更？
   - 技术选型？
   - 重要权衡决策？

4. **检查模块文档需求**
   - 模块 README 是否存在？
   - 新增组件是否已记录？
   - 新增 API 是否已记录？
   - 架构是否有变化？

5. **提供自动生成选项**
   ```
   📋 Documentation updates needed:

   - [ ] ADR: New library (React Query)
   - [ ] Module Doc: account module (missing)
   - [ ] Update: docs/modules/account/README.md
         - Add LoginForm to "核心组件"
         - Add useAuth to "API"

   Should I generate/update these documents? (yes/no)
   ```

6. **自动生成/更新文档**
   - 使用模板生成新文档
   - 更新现有文档的相关部分
   - 更新文档索引
   - 提示用户审查

## 初始化项目文档

### 使用 facio-superpowers CLI

```bash
# 初始化项目
npx @vattention/facio-superpowers init

# 这会创建：
# - .claude/skills/ (包含自定义 skills)
# - docs/adr/
# - docs/plans/
# - docs/modules/ (需要手动创建模块子目录)
# - templates/
```

### 手动创建模块文档

```bash
# 为每个模块创建文档目录
mkdir -p docs/modules/renderer
mkdir -p docs/modules/main
mkdir -p docs/modules/account
mkdir -p docs/modules/settings

# 复制模板创建初始文档
cp templates/MODULE-README.md docs/modules/account/README.md
cp templates/MODULE-ARCHITECTURE.md docs/modules/account/ARCHITECTURE.md

# 编辑文档，填入模块信息
# 或者让 AI 工具帮你生成
```

### 简化根目录 README

```bash
# 备份当前 README
mv README.md README-OLD.md

# 使用简化模板
cp templates/README-ROOT.md README.md

# 编辑 README.md，填入项目信息
# 将详细内容移到 docs/ 目录
```

### 创建文档地图

```bash
# 创建文档地图
cp templates/DOCUMENTATION-MAP.md docs/DOCUMENTATION-MAP.md

# 编辑文档地图，更新模块列表和链接
```

## 维护文档

### 文档同步原则

1. **代码变更 → 文档更新**
   - 每次代码变更后调用 `/verification-before-completion`
   - AI 工具自动检查文档需求
   - 确认后自动更新文档

2. **组件列表同步**
   - 新增组件 → 更新模块 README 的"核心组件"表格
   - 包含：组件名、职责、文件路径、状态

3. **API 列表同步**
   - 新增导出 → 更新模块 README 的"API"部分
   - 包含：函数名、描述、参数、返回值

4. **架构变更同步**
   - 架构调整 → 更新 ARCHITECTURE.md
   - 重大变更 → 生成 ADR

### 文档审查

虽然文档由 AI 自动生成，但需要人工审查：

1. **准确性**：信息是否准确？
2. **完整性**：是否遗漏重要信息？
3. **清晰性**：是否易于理解？
4. **链接**：链接是否正确？

### 定期维护

建议定期（如每月）：

1. 审查模块文档的"当前状态"部分
2. 更新"未来规划"部分
3. 归档已完成的设计文档
4. 更新文档地图

## 最佳实践

### 1. 保持 README 简洁

- 根目录 README 只包含基本信息
- 详细内容放在专门文档中
- 提供清晰的导航链接

### 2. 模块文档作为 LLM 输入

- 模块 README 是 LLM 的主要输入
- 包含足够的上下文信息
- 结构化，易于解析

### 3. ADR 记录决策理由

- 不是记录"做了什么"，而是"为什么这样做"
- 包含备选方案和权衡分析
- 建立决策之间的关联

### 4. 文档与代码路径对应

- 文档中包含实际的文件路径
- 便于验证文档与代码的同步
- 便于 AI 工具定位代码

### 5. 使用自动化工具

- 依赖 `/verification-before-completion` 自动检查
- 让 AI 工具生成和更新文档
- 人工负责审查和确认

## 常见问题

### Q: 是否所有模块都需要完整的文档？

A: 不一定。根据模块的复杂度和重要性决定：
- 核心模块：完整文档（README + ARCHITECTURE + API + 示例）
- 简单模块：只需 README
- 工具模块：README + API 文档

### Q: 文档更新会不会很耗时？

A: 不会。因为：
- AI 工具自动生成和更新
- 你只需确认和审查
- 增量更新，不是重写

### Q: 如何处理跨模块的功能？

A:
- 在主要模块的文档中记录
- 在"依赖关系"部分说明跨模块交互
- 如果是重要的架构决策，生成 ADR

### Q: 文档地图需要手动维护吗？

A:
- 初始创建后，主要由 AI 工具更新
- `/verification-before-completion` 会自动更新索引
- 你只需定期审查

### Q: 如何确保文档与代码同步？

A:
- 每次代码变更后调用 `/verification-before-completion`
- AI 工具会检查文档是否需要更新
- 文档中包含文件路径，便于验证

## 总结

模块化文档系统的核心价值：

1. **与代码同步**：自动检查和更新，保持一致性
2. **LLM 友好**：结构化格式，作为有效的 AI 输入
3. **易于导航**：清晰的文档地图和模块组织
4. **自动化优先**：AI 工具生成，人工审查
5. **信息不过载**：简化 README，详细内容分模块

通过这个系统，你可以：
- 保持文档的准确性和时效性
- 让 AI 工具更好地理解项目
- 帮助团队成员快速了解模块
- 记录架构决策的历史和理由

开始使用：
```bash
npx @vattention/facio-superpowers init
```

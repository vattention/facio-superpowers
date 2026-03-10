# Facio Superpowers

> **Version 1.1.4** | Built on [obra/superpowers](https://github.com/obra/superpowers)

AI 辅助开发框架，在 superpowers 基础上增加了 **Facio Flow 团队协作** 和 **自动文档管理** 能力。

## 核心特性

| 特性 | 说明 |
|-----|------|
| **Facio Flow 集成** | Context/Task 管理、需求讨论记录、版本规划 |
| **Blueprint 搜索** | 自动搜索 facio-blueprint 中的相关讨论和规格 |
| **Spec 冲突检测** | 检测 blueprint 与本地 spec 的版本差异 |
| **自动 ADR 生成** | 架构决策自动记录 |
| **文档索引维护** | 自动更新 docs/adr/README.md 等索引 |

## 快速开始

### 前置条件

确保项目已初始化 Claude Code：

```bash
cd your-project
claude init
```

### 安装 Facio Superpowers

```bash
npx @vattention/facio-superpowers init
```

这会：
- ✅ 安装所有 skills（16 个）
- ✅ 创建文档结构（docs/adr, docs/plans, templates）
- ✅ 注入工作流指令到 CLAUDE.md
- ✅ 创建文档索引

### 更新到最新版本

```bash
npx @vattention/facio-superpowers sync
```

## Facio Flow 团队协作

Facio Superpowers 与 Facio Flow MCP 集成，提供完整的团队协作能力。

### 核心概念

| 概念 | 说明 | 类比 |
|-----|------|------|
| **Context** | 需求讨论的容器，记录想法、分析、决策 | 会议纪要 |
| **Task** | 具体的开发任务，从 Context 决策产生 | 工单 |
| **Version** | 版本规划，组织多个 Context/Task | 里程碑 |

### 工作阶段

```
Context 阶段（需求讨论）          Task 阶段（开发实现）
AI 角色：产品经理                 AI 角色：研发专家
├─ 澄清需求边界                   ├─ 技术方案讨论
├─ 识别边界条件                   ├─ 任务拆分
├─ 确定验收标准                   ├─ TDD 实现
└─ 生成测试用例                   └─ 验证完成
```

### 自动行为

当你说"我想做 xxx 功能"，AI 会自动：
1. 询问是否创建 Context
2. 引导需求讨论
3. 记录有价值的内容
4. 确定验收标准后记录决策

### 使用 /flow 命令

显式启动跟踪讨论：

```
/flow 用户头像功能
```

AI 会创建 Context 并开始结构化的 brainstorming 流程。

## 推荐工作流

```
1. /prepare-context              # 加载相关文档（自动提醒）
2. /brainstorming                # 设计讨论（如需要）
3. /writing-plans                # 创建实现计划
4. [实现]
5. /verification-before-completion  # 验证并更新文档（自动提醒）
```

### 自动提醒机制

开始开发时，AI 会自动提醒：

```
⚠️ Development Preparation Required

Before starting development, I recommend:
1. Call /prepare-context to find relevant documentation

Would you like me to call /prepare-context now? (yes/no)
```

完成开发后：

```
⚠️ Completion Verification Required

Development complete. Before committing, I recommend:
1. Call /verification-before-completion

Would you like me to call /verification-before-completion now? (yes/no)
```

## Skills 一览

Facio Superpowers 包含 16 个 skills：

### Facio 特有/增强

| Skill | 说明 |
|-------|------|
| `flow` | 启动 Facio Flow 跟踪讨论，创建 Context 并引导 brainstorming |
| `prepare-context` | **增强**：搜索 facio-blueprint + 本地文档，检测 spec 冲突 |
| `verification-before-completion` | **增强**：自动生成 ADR，更新文档索引 |

### 设计规划类

| Skill | 说明 |
|-------|------|
| `brainstorming` | 需求讨论、方案设计，强制在实现前完成设计 |
| `writing-plans` | 将设计拆分为 2-5 分钟的小任务 |

### 开发实现类

| Skill | 说明 |
|-------|------|
| `test-driven-development` | RED-GREEN-REFACTOR 循环 |
| `systematic-debugging` | 4 阶段系统化排查 |
| `subagent-driven-development` | 子代理并行开发，两阶段评审 |
| `executing-plans` | 批量执行任务，人工检查点 |
| `dispatching-parallel-agents` | 并行执行独立任务 |

### 协作流程类

| Skill | 说明 |
|-------|------|
| `requesting-code-review` | 发起代码评审前的自检 |
| `receiving-code-review` | 收到评审意见后的处理 |
| `using-git-worktrees` | 创建隔离的开发分支 |
| `finishing-a-development-branch` | 完成开发后的合并/PR 决策 |

### 元技能

| Skill | 说明 |
|-------|------|
| `using-superpowers` | Skills 系统介绍 |
| `writing-skills` | 创建新 skill 的指南 |

## prepare-context 详解

`/prepare-context` 是 Facio Superpowers 的核心 skill，在开发前自动搜索相关文档。

### 搜索范围

1. **Facio Blueprint**（如已配置）
   - 相关 Context 讨论和决策
   - Spec 文档
   - 产品级文档（vision, gaps）

2. **本地代码库**
   - `docs/adr/` 中的架构决策记录
   - `docs/plans/` 中的设计文档
   - `docs/specs/` 中的本地规格

### Spec 冲突检测

当 blueprint 和本地都有同一功能的 spec 时，AI 会询问：

```
⚠️ Spec version conflict detected

Found different specs for [feature]:
- Blueprint (latest design)
- Codebase (current implementation)

Which version should this task reference?
1. Blueprint - new feature development
2. Codebase - bugfix, follow current implementation
```

### 输出示例

```markdown
📚 Context Preparation Complete

## Blueprint Contexts
- [用户认证流程] - decided
  Summary: 使用 JWT，refresh token 机制
  Artifacts: spec, test-cases

## Codebase ADRs
- [ADR-001: Use Zustand for state](docs/adr/001-use-zustand.md)

## Key Constraints
- 必须使用 JWT 模式
- 状态管理使用 Zustand

✅ Proceed with development
```

## 目录结构

安装后的项目结构：

```
your-project/
├── CLAUDE.md                    # 项目配置（Claude Code 自动读取）
├── CLAUDE-TEAM.md               # 团队标准
├── .claude/skills/              # Skills 目录
│   ├── brainstorming/
│   ├── flow/                    # Facio Flow 集成
│   ├── prepare-context/         # 上下文准备（增强版）
│   ├── verification-before-completion/
│   └── ... (共 16 个)
├── docs/
│   ├── adr/                     # 架构决策记录
│   │   ├── 001-use-zustand.md
│   │   └── README.md            # 自动维护的索引
│   ├── plans/                   # 设计文档
│   │   └── README.md
│   └── specs/                   # 本地规格文档
├── templates/
│   └── adr-template.md
└── scripts/
    └── sync-skills.sh
```

## 与原版 Superpowers 对比

| Feature | Original Superpowers | Facio Superpowers |
|---------|---------------------|-------------------|
| Brainstorming | ✅ | ✅ |
| Writing Plans | ✅ | ✅ |
| TDD | ✅ | ✅ |
| Code Review | ✅ | ✅ |
| Subagent Development | ✅ | ✅ |
| Git Worktrees | ✅ | ✅ |
| **Facio Flow 集成** | ❌ | ✅ |
| **Blueprint 搜索** | ❌ | ✅ |
| **Spec 冲突检测** | ❌ | ✅ |
| **自动 ADR 生成** | ❌ | ✅ |
| **文档索引维护** | ❌ | ✅ |
| **工作流自动提醒** | ❌ | ✅ |

## 配置文件

### CLAUDE.md（项目级）

项目特定配置，Claude Code 会话启动时自动读取。包含：
- 工作流提醒（开发前/后）
- 项目特定技术栈
- 重要 ADR 引用

### CLAUDE-TEAM.md（团队级）

团队共享标准，包含：
- 技术标准（框架、库）
- 代码风格规范
- 开发流程要求

## FAQ

**Q: 需要为每个项目运行 init 吗？**

A: 是的，每个项目需要独立设置。但用 npx 只需 10 秒。

**Q: 已有的 CLAUDE.md 会被覆盖吗？**

A: 不会。init 命令会在现有内容顶部**注入**工作流指令，保留原有内容。

**Q: 可以多次运行 init 吗？**

A: 可以，安全的。命令会检查工作流指令是否已存在，不会重复添加。

**Q: 支持 Cursor 吗？**

A: 支持。Skills 同时安装到 `.claude/skills` 和 `.cursor/skills`。

**Q: 如何配置 Facio Flow？**

A: 需要配置 facio-flow MCP。详见 facio-flow 文档。

**Q: 可以自定义 skills 吗？**

A: 可以。init 后 skills 在你的项目中，可以修改。

**Q: 需要原版 superpowers 吗？**

A: 不需要。Facio Superpowers 包含所有功能，且兼容原版 skills。

## 新人培训

完整的新人培训文档见 [docs/onboarding/](docs/onboarding/)，包括：

- 学习路径指南
- 核心概念解释
- 角色指南（产品/开发/测试）
- 实践项目

## Credits

Built on [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

## License

MIT

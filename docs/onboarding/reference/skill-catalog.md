# Skill 速查表

本文档列出所有可用的 Skill，包括用途、触发方式和使用示例。

## Skill 分类总览

```
┌─────────────────────────────────────────────────────────────────┐
│                         Skill 分类                              │
├──────────────────┬──────────────────┬───────────────────────────┤
│    设计规划类     │     开发实现类    │       协作流程类          │
├──────────────────┼──────────────────┼───────────────────────────┤
│ brainstorming    │ test-driven-dev  │ prepare-context           │
│ writing-plans    │ systematic-debug │ verification-before-done  │
│                  │                  │ requesting-code-review    │
│                  │                  │ receiving-code-review     │
│                  │                  │ finishing-dev-branch      │
│                  │                  │ dispatching-parallel      │
│                  │                  │ executing-plans           │
│                  │                  │ subagent-driven-dev       │
└──────────────────┴──────────────────┴───────────────────────────┘
```

---

## 设计规划类

### brainstorming

**用途**：将想法变成完整的设计方案

**触发方式**：
- 命令：`/brainstorming`
- 自动：说"我想做 xxx"、"有个想法"

**流程**：
1. 探索项目上下文
2. 逐一澄清问题
3. 提出 2-3 个方案
4. 确认设计
5. 保存设计文档

**示例**：
```
用户：我想给用户列表加搜索功能
AI：[进入 brainstorming]
    - 搜索哪些字段？
    - 实时搜索还是点击搜索？
    - 搜索结果如何展示？
    ...
```

**注意**：在设计确认前，AI 不会写任何代码。

---

### writing-plans

**用途**：把设计拆成可执行的任务清单

**触发方式**：
- 命令：`/writing-plans`
- 自动：brainstorming 完成后自动触发

**流程**：
1. 分析设计文档
2. 拆分成 2-5 分钟的小任务
3. 确定任务依赖关系
4. 生成任务清单

**输出示例**：
```markdown
## 任务清单

1. [5min] 创建搜索输入框组件
2. [10min] 实现搜索 API 接口
3. [5min] 添加防抖处理
4. [10min] 实现搜索结果高亮
5. [10min] 编写测试用例
```

---

## 开发实现类

### test-driven-development

**用途**：确保代码质量，先写测试再写实现

**触发方式**：
- 命令：直接在开发时生效
- 自动：开始实现任务时

**流程**（RED-GREEN-REFACTOR）：
1. **RED**：先写失败的测试
2. **GREEN**：写最小代码让测试通过
3. **REFACTOR**：重构优化

**示例**：
```
AI：首先编写测试用例...

[生成测试代码]

AI：运行测试，预期失败... ✗
AI：现在编写实现代码...

[生成实现代码]

AI：运行测试... ✓
AI：测试通过，是否需要重构？
```

---

### systematic-debugging

**用途**：系统化排查和修复问题

**触发方式**：
- 自动：描述 bug 或问题时

**四阶段流程**：
1. **信息收集**：复现步骤、错误信息、环境
2. **假设形成**：可能的原因列表
3. **假设验证**：逐一排查
4. **修复验证**：修复并确认

**示例**：
```
用户：登录后有时候会显示未登录状态

AI：[进入 systematic-debugging]

Phase 1: 让我收集一些信息
- 这种情况多久发生一次？
- 有错误信息吗？
- 刷新页面会恢复吗？

Phase 2: 基于信息，可能的原因：
1. Token 存储问题
2. 异步时序问题
3. 缓存问题

Phase 3: 让我验证每个假设...
```

---

## 协作流程类

### prepare-context

**用途**：开发前查找相关文档和决策

**触发方式**：
- 命令：`/prepare-context`
- 提示：AI 在开始开发前会提醒

**搜索内容**：
- ADR（架构决策记录）
- 历史 Context 讨论
- 设计文档
- 相关代码

**输出示例**：
```
📚 Context 准备完成

相关 ADR：
- ADR-003: 使用 JWT 认证

相关讨论：
- [CTX-012] 用户认证流程讨论

关键约束：
- 必须使用 JWT 模式
- Token 有效期 7 天
```

---

### verification-before-completion

**用途**：完成前验证代码质量和文档

**触发方式**：
- 命令：`/verification-before-completion`
- 提示：说"做完了"时 AI 会提醒

**检查项**：
1. 运行测试套件
2. 检查代码覆盖率
3. 检查是否需要生成 ADR
4. 更新相关文档索引

**输出示例**：
```
✅ 验证完成

测试：34/34 通过
覆盖率：87%
ADR：已生成 ADR-005
文档：已更新 docs/adr/README.md

可以提交了！
```

---

### requesting-code-review

**用途**：发起代码评审前的自检

**触发方式**：
- 命令：`/requesting-code-review`
- 说"帮我 review"

**检查清单**：
- 代码风格一致性
- 测试覆盖充分
- 无安全漏洞
- 注释和文档完整

---

### receiving-code-review

**用途**：收到评审意见后的处理

**触发方式**：
- 命令：`/receiving-code-review`

**流程**：
1. 理解评审意见
2. 评估建议是否合理
3. 实施修改或反馈

---

### finishing-a-development-branch

**用途**：开发完成后决定如何处理分支

**触发方式**：
- 说"开发完了，准备合并"

**选项**：
- 合并到主分支
- 创建 PR
- 清理临时分支

---

### dispatching-parallel-agents

**用途**：并行执行多个独立任务

**触发方式**：
- 自动：当有多个独立任务时

**适用场景**：
- 同时开发多个不相关的组件
- 同时运行多个测试套件

---

### executing-plans

**用途**：按计划批量执行任务

**触发方式**：
- 命令：`/executing-plans`

**特点**：
- 按顺序执行任务
- 关键节点人工检查点

---

### subagent-driven-development

**用途**：使用子代理并行开发

**触发方式**：
- 自动：执行任务列表时

**特点**：
- 每个任务独立子代理
- 两阶段评审（规格符合性 + 代码质量）

---

## 快速参考表

| Skill | 命令 | 何时使用 |
|-------|------|---------|
| brainstorming | `/brainstorming` | 有新想法时 |
| writing-plans | `/writing-plans` | 设计确认后 |
| test-driven-development | - | 开发时自动 |
| systematic-debugging | - | 遇到 bug 时 |
| prepare-context | `/prepare-context` | 开发前 |
| verification-before-completion | `/verification-before-completion` | 完成前 |
| requesting-code-review | `/requesting-code-review` | 提交评审前 |
| receiving-code-review | `/receiving-code-review` | 收到评审后 |
| finishing-a-development-branch | - | 准备合并时 |
| dispatching-parallel-agents | - | 并行任务时 |
| executing-plans | `/executing-plans` | 批量执行时 |
| subagent-driven-development | - | 并行开发时 |

---

## Skill 调用原则

1. **自动优先**：大多数 Skill 会在合适时机自动触发
2. **显式调用**：不确定时可以用命令显式调用
3. **可跳过**：简单任务可以要求跳过某些 Skill
4. **可组合**：多个 Skill 可以串联使用

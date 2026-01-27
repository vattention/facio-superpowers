# Facio Superpowers CLI 使用指南

## 概述

Facio Superpowers 提供命令行工具，用于快速初始化项目、同步更新和监控成本。

## 安装

无需安装，直接使用 npx：

```bash
npx @vattention/facio-superpowers <command>
```

## 命令列表

### 1. init - 初始化项目

初始化项目，安装 skills、模板和配置文件。

```bash
npx @vattention/facio-superpowers init
```

**功能：**
- 创建目录结构（docs/adr, docs/plans, docs/modules, templates, scripts）
- 安装自定义 skills（verification-before-completion, prepare-context）
- 复制文档模板（ADR, MODULE-README, MODULE-ARCHITECTURE, DOCUMENTATION-MAP）
- 配置 CLAUDE.md（注入工作流指令）
- 安装文档指南（MODULAR-DOCS-GUIDE.md）

**输出示例：**
```
🚀 Initializing Facio Superpowers

📁 Creating directories...
  ✓ .claude/skills
  ✓ .cursor/skills
  ✓ docs/adr
  ✓ docs/plans
  ✓ docs/modules
  ✓ templates
  ✓ scripts

📚 Installing skills...
  ✓ verification-before-completion
  ✓ prepare-context

📄 Installing templates...
  ✓ templates/adr-template.md
  ✓ templates/README-ROOT.md
  ✓ templates/DOCUMENTATION-MAP.md
  ✓ templates/MODULE-README.md
  ✓ templates/MODULE-ARCHITECTURE.md
  ✓ CLAUDE-TEAM.md
  ✓ CLAUDE.md

📋 Creating document indexes...
  ✓ docs/adr/README.md
  ✓ docs/plans/README.md

⚙️  Configuring CLAUDE.md...
  ✓ Injected workflow instructions into CLAUDE.md

📖 Installing documentation guide...
  ✓ docs/MODULAR-DOCS-GUIDE.md

✅ Initialization complete!

Next steps:
1. Review docs/MODULAR-DOCS-GUIDE.md for documentation system overview
2. Edit CLAUDE.md to add project-specific information
3. Review CLAUDE-TEAM.md for team standards
4. Create module documentation:
   mkdir -p docs/modules/your-module
   cp templates/MODULE-README.md docs/modules/your-module/README.md
5. Start using skills:
   - /prepare-context (before development)
   - /verification-before-completion (after development)

📚 Documentation: https://github.com/vattention/facio-superpowers
```

**前置条件：**
- 项目已运行 `claude init`（需要先有 CLAUDE.md）

**注意事项：**
- 可以多次运行（幂等性）
- 已存在的文件不会被覆盖
- 会自动更新到最新版本

---

### 2. sync - 同步更新

同步 skills 和模板到最新版本。

```bash
npx @vattention/facio-superpowers sync
```

**功能：**
- 更新 skills 到最新版本
- 更新模板文件
- 更新文档指南

**使用场景：**
- facio-superpowers 发布新版本时
- skills 有重要更新时
- 模板文件需要更新时

**输出示例：**
```
🔄 Syncing skills from facio-superpowers

📚 Updating skills...
  ✓ verification-before-completion
  ✓ prepare-context

📄 Updating templates...
  ✓ templates/adr-template.md
  ✓ templates/README-ROOT.md
  ✓ templates/DOCUMENTATION-MAP.md
  ✓ templates/MODULE-README.md
  ✓ templates/MODULE-ARCHITECTURE.md
  ✓ CLAUDE-TEAM.md

📖 Updating documentation guide...
  ✓ docs/MODULAR-DOCS-GUIDE.md

✅ Sync complete!
```

**注意事项：**
- 会覆盖 skills 和模板文件
- 不会覆盖 CLAUDE.md（项目配置）
- 建议定期运行以获取最新功能

---

### 3. 成本监控命令（通过脚本）

成本监控功能通过独立脚本提供。

#### 3.1 analyze-cost - 成本分析

查看实时成本状态。

```bash
./scripts/analyze-cost.sh
```

**功能：**
- 显示今日/本月成本
- 按模型和操作分类统计
- 预算状态检查
- 成本预测
- 优化建议

**输出示例：**
```
📊 Facio Superpowers - Cost Analysis
========================================

📅 Today (2026-01-27):
   Operations: 8
   Cost: $1.2300

📆 This Month (2026-01):
   Operations: 156
   Cost: $23.4500

🤖 By Model:
   haiku:     45 ops, $2.3400
   sonnet:    111 ops, $21.1100

⚙️  By Operation:
   verification:         89 ops, $15.6700
   brainstorming:        34 ops, $6.7800
   writing-plans:        23 ops, $0.8900
   prepare-context:      10 ops, $0.1100

💰 Budget Status:
   Monthly Budget: $50.00
   Used: $23.4500 (46.9%)
   ✅ Within budget

📈 Statistics:
   Average cost per operation: $0.1503
   Projected monthly cost: $48.23

========================================
💡 Tips:
   - Use 'haiku' model for simple tasks
   - Enable batch mode for documentation updates
   - Increase trigger thresholds to reduce operations

Run './scripts/daily-report.sh' for detailed report
```

#### 3.2 daily-report - 每日报告

生成详细的每日成本报告。

```bash
./scripts/daily-report.sh
```

**功能：**
- 详细的操作分解
- 按小时分布
- 最贵操作 Top 5
- 自动化建议

**输出：**
- 报告保存在：`.facio-superpowers/reports/daily-YYYY-MM-DD.md`
- 同时输出到终端

---

## 完整工作流示例

### 初始化新项目

```bash
# 1. 初始化 Claude Code
claude init

# 2. 初始化 Facio Superpowers
npx @vattention/facio-superpowers init

# 3. 配置预算（可选）
vim .facio-superpowers.yml
# 设置 monthly_budget: 30

# 4. 开始开发
# 使用 /brainstorming, /writing-plans, /verification-before-completion
```

### 日常开发

```bash
# 早上：查看成本状态
./scripts/analyze-cost.sh

# 开发过程中：正常使用 AI 工具
# /verification-before-completion 会自动记录成本

# 晚上：生成每日报告
./scripts/daily-report.sh
```

### 定期维护

```bash
# 每周：同步更新
npx @vattention/facio-superpowers sync

# 每月：审查成本
./scripts/analyze-cost.sh
# 根据数据调整配置
```

---

## 配置文件

### .facio-superpowers.yml

项目配置文件，控制文档更新和成本追踪。

```yaml
# 文档自动更新配置
documentation:
  auto_update: true
  trigger:
    min_files_changed: 2
    min_lines_changed: 20
    skip_test_only: true
    skip_style_only: true
  model:
    check: haiku
    generate: sonnet
  cache:
    enabled: true
    ttl: 3600

# 成本监控配置
cost_tracking:
  enabled: true
  log_file: .facio-superpowers/cost-log.jsonl
  monthly_budget: 50
  alert_thresholds:
    warning: 70
    critical: 90
```

**配置说明：**
- `auto_update`: 是否自动更新文档
- `min_files_changed`: 触发文档更新的最少文件数
- `min_lines_changed`: 触发文档更新的最少行数
- `model.check`: 检查阶段使用的模型
- `model.generate`: 生成阶段使用的模型
- `monthly_budget`: 月度预算（美元）
- `alert_thresholds`: 预警阈值（百分比）

---

## 常见问题

### Q: 如何查看所有可用命令？

```bash
npx @vattention/facio-superpowers
```

不带参数运行会显示帮助信息。

### Q: init 命令可以多次运行吗？

可以。init 命令是幂等的，已存在的文件不会被覆盖。

### Q: 如何更新到最新版本？

```bash
npx @vattention/facio-superpowers sync
```

sync 命令会自动拉取最新版本。

### Q: 成本日志存储在哪里？

```
.facio-superpowers/cost-log.jsonl
```

这是一个 JSONL 格式的文件，每行一条记录。

### Q: 如何重置成本日志？

```bash
# 备份旧日志
mv .facio-superpowers/cost-log.jsonl .facio-superpowers/cost-log-backup.jsonl

# 或直接删除
rm .facio-superpowers/cost-log.jsonl
```

### Q: 如何禁用成本追踪？

编辑 `.facio-superpowers.yml`：

```yaml
cost_tracking:
  enabled: false
```

### Q: 如何调整预算？

编辑 `.facio-superpowers.yml`：

```yaml
cost_tracking:
  monthly_budget: 30  # 改为你的预算
```

---

## 故障排除

### 问题：init 命令提示 "CLAUDE.md not found"

**原因：** 项目还没有运行 `claude init`

**解决：**
```bash
claude init
npx @vattention/facio-superpowers init
```

### 问题：成本分析脚本没有权限

**原因：** 脚本没有执行权限

**解决：**
```bash
chmod +x scripts/analyze-cost.sh
chmod +x scripts/daily-report.sh
```

### 问题：成本分析显示 "No cost log found"

**原因：** 还没有使用过 AI 工具，或成本追踪未启用

**解决：**
- 正常使用 AI 工具（/verification-before-completion）
- AI 工具会自动记录成本
- 或手动创建日志文件

---

## 更多信息

- **项目文档**: https://github.com/vattention/facio-superpowers
- **模块化文档指南**: docs/MODULAR-DOCS-GUIDE.md
- **成本监控指南**: COST-MONITORING-GUIDE.md
- **问题反馈**: https://github.com/vattention/facio-superpowers/issues

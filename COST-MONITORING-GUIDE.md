# 成本监控实现指南

> 如何在 AI 辅助开发中追踪和控制 token 使用成本

## 概述

本指南说明如何实现成本监控系统，帮助团队：
1. 追踪每次 AI 调用的 token 使用
2. 计算实际成本
3. 生成成本报告
4. 设置预算预警

## 实现方式

### 方式 1：AI 工具自动记录（推荐）

在每次 AI 调用后，自动记录 token 使用情况。

#### 在 verification-before-completion skill 中添加

```markdown
## Cost Tracking

After completing verification and documentation updates:

1. **Record token usage:**
   ```javascript
   {
     "timestamp": "2026-01-27T10:30:00Z",
     "operation": "verification-before-completion",
     "model": "sonnet",
     "tokens": {
       "input": 15234,
       "output": 3421
     },
     "cost": {
       "input": 0.046,
       "output": 0.051,
       "total": 0.097
     },
     "context": {
       "files_changed": 3,
       "modules": ["account", "auth"],
       "doc_updates": ["account/README.md", "adr/005.md"]
     }
   }
   ```

2. **Append to log file:**
   ```bash
   echo '{json}' >> .facio-superpowers/cost-log.jsonl
   ```

3. **Check budget:**
   - Read current month's total cost
   - Compare with monthly budget
   - If > 70%: Show warning
   - If > 90%: Show critical warning

4. **Display summary:**
   ```
   💰 Cost Summary:
   This operation: $0.097
   Today: $1.23 (8 operations)
   This month: $23.45 / $50.00 (46.9%)
   ```
```

#### 记录格式（JSONL）

每行一条记录：

```jsonl
{"timestamp":"2026-01-27T10:30:00Z","operation":"verification","model":"sonnet","tokens":{"input":15234,"output":3421},"cost":{"input":0.046,"output":0.051,"total":0.097},"context":{"files_changed":3,"modules":["account"]}}
{"timestamp":"2026-01-27T11:15:00Z","operation":"brainstorming","model":"sonnet","tokens":{"input":8234,"output":5621},"cost":{"input":0.025,"output":0.084,"total":0.109},"context":{"feature":"login-page"}}
{"timestamp":"2026-01-27T14:20:00Z","operation":"verification","model":"haiku","tokens":{"input":5234,"output":1221},"cost":{"input":0.001,"output":0.002,"total":0.003},"context":{"files_changed":1,"modules":["utils"]}}
```

### 方式 2：Claude Code API 追踪

如果使用 Claude Code，可以通过 API 获取 token 使用情况。

#### 在每次会话结束时

```bash
# Claude Code 会在响应中包含 token 使用信息
# 提取并记录到日志文件
```

### 方式 3：手动记录（备选）

如果 AI 工具不支持自动记录，可以手动记录：

```bash
# 创建记录脚本
cat > scripts/log-cost.sh << 'EOF'
#!/bin/bash
# 手动记录成本

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
OPERATION=$1
MODEL=$2
INPUT_TOKENS=$3
OUTPUT_TOKENS=$4

# 计算成本（根据模型）
case $MODEL in
  haiku)
    INPUT_COST=$(echo "$INPUT_TOKENS * 0.25 / 1000000" | bc -l)
    OUTPUT_COST=$(echo "$OUTPUT_TOKENS * 1.25 / 1000000" | bc -l)
    ;;
  sonnet)
    INPUT_COST=$(echo "$INPUT_TOKENS * 3.0 / 1000000" | bc -l)
    OUTPUT_COST=$(echo "$OUTPUT_TOKENS * 15.0 / 1000000" | bc -l)
    ;;
  opus)
    INPUT_COST=$(echo "$INPUT_TOKENS * 15.0 / 1000000" | bc -l)
    OUTPUT_COST=$(echo "$OUTPUT_TOKENS * 75.0 / 1000000" | bc -l)
    ;;
esac

TOTAL_COST=$(echo "$INPUT_COST + $OUTPUT_COST" | bc -l)

# 记录到日志
mkdir -p .facio-superpowers
echo "{\"timestamp\":\"$TIMESTAMP\",\"operation\":\"$OPERATION\",\"model\":\"$MODEL\",\"tokens\":{\"input\":$INPUT_TOKENS,\"output\":$OUTPUT_TOKENS},\"cost\":{\"input\":$INPUT_COST,\"output\":$OUTPUT_COST,\"total\":$TOTAL_COST}}" >> .facio-superpowers/cost-log.jsonl

echo "✅ Logged: $OPERATION ($MODEL) - \$$TOTAL_COST"
EOF

chmod +x scripts/log-cost.sh

# 使用
./scripts/log-cost.sh verification sonnet 15234 3421
```

## 成本分析脚本

### 创建分析脚本

```bash
cat > scripts/analyze-cost.sh << 'EOF'
#!/bin/bash
# 分析成本日志

LOG_FILE=".facio-superpowers/cost-log.jsonl"

if [ ! -f "$LOG_FILE" ]; then
  echo "❌ No cost log found"
  exit 1
fi

echo "📊 Cost Analysis"
echo "================"
echo ""

# 今天的成本
TODAY=$(date +%Y-%m-%d)
TODAY_COST=$(grep "$TODAY" "$LOG_FILE" | jq -s 'map(.cost.total) | add')
TODAY_OPS=$(grep "$TODAY" "$LOG_FILE" | wc -l)

echo "📅 Today ($TODAY):"
echo "   Operations: $TODAY_OPS"
echo "   Cost: \$$TODAY_COST"
echo ""

# 本月成本
MONTH=$(date +%Y-%m)
MONTH_COST=$(grep "$MONTH" "$LOG_FILE" | jq -s 'map(.cost.total) | add')
MONTH_OPS=$(grep "$MONTH" "$LOG_FILE" | wc -l)

echo "📆 This Month ($MONTH):"
echo "   Operations: $MONTH_OPS"
echo "   Cost: \$$MONTH_COST"
echo ""

# 按模型统计
echo "🤖 By Model:"
for model in haiku sonnet opus; do
  MODEL_COST=$(grep "\"model\":\"$model\"" "$LOG_FILE" | jq -s 'map(.cost.total) | add // 0')
  MODEL_OPS=$(grep "\"model\":\"$model\"" "$LOG_FILE" | wc -l)
  if [ "$MODEL_OPS" -gt 0 ]; then
    echo "   $model: $MODEL_OPS ops, \$$MODEL_COST"
  fi
done
echo ""

# 按操作统计
echo "⚙️  By Operation:"
for op in verification brainstorming writing-plans prepare-context; do
  OP_COST=$(grep "\"operation\":\"$op\"" "$LOG_FILE" | jq -s 'map(.cost.total) | add // 0')
  OP_OPS=$(grep "\"operation\":\"$op\"" "$LOG_FILE" | wc -l)
  if [ "$OP_OPS" -gt 0 ]; then
    echo "   $op: $OP_OPS ops, \$$OP_COST"
  fi
done
echo ""

# 预算检查
BUDGET=50
PERCENTAGE=$(echo "scale=1; $MONTH_COST / $BUDGET * 100" | bc)
echo "💰 Budget Status:"
echo "   Monthly Budget: \$$BUDGET"
echo "   Used: \$$MONTH_COST ($PERCENTAGE%)"

if (( $(echo "$PERCENTAGE > 90" | bc -l) )); then
  echo "   ⚠️  CRITICAL: Over 90% of budget!"
elif (( $(echo "$PERCENTAGE > 70" | bc -l) )); then
  echo "   ⚠️  WARNING: Over 70% of budget"
else
  echo "   ✅ Within budget"
fi
echo ""

# 平均成本
AVG_COST=$(echo "scale=4; $MONTH_COST / $MONTH_OPS" | bc)
echo "📈 Average Cost per Operation: \$$AVG_COST"
EOF

chmod +x scripts/analyze-cost.sh
```

### 使用分析脚本

```bash
# 查看成本分析
./scripts/analyze-cost.sh

# 输出示例：
# 📊 Cost Analysis
# ================
#
# 📅 Today (2026-01-27):
#    Operations: 8
#    Cost: $1.23
#
# 📆 This Month (2026-01):
#    Operations: 156
#    Cost: $23.45
#
# 🤖 By Model:
#    haiku: 45 ops, $2.34
#    sonnet: 111 ops, $21.11
#
# ⚙️  By Operation:
#    verification: 89 ops, $15.67
#    brainstorming: 34 ops, $6.78
#    writing-plans: 23 ops, $0.89
#    prepare-context: 10 ops, $0.11
#
# 💰 Budget Status:
#    Monthly Budget: $50
#    Used: $23.45 (46.9%)
#    ✅ Within budget
#
# 📈 Average Cost per Operation: $0.1503
```

## 生成报告

### 每日报告脚本

```bash
cat > scripts/daily-report.sh << 'EOF'
#!/bin/bash
# 生成每日成本报告

LOG_FILE=".facio-superpowers/cost-log.jsonl"
REPORT_DIR=".facio-superpowers/reports"
TODAY=$(date +%Y-%m-%d)
REPORT_FILE="$REPORT_DIR/daily-$TODAY.md"

mkdir -p "$REPORT_DIR"

# 提取今天的数据
TODAY_DATA=$(grep "$TODAY" "$LOG_FILE")

if [ -z "$TODAY_DATA" ]; then
  echo "No operations today"
  exit 0
fi

# 计算统计
TOTAL_OPS=$(echo "$TODAY_DATA" | wc -l)
TOTAL_COST=$(echo "$TODAY_DATA" | jq -s 'map(.cost.total) | add')
TOTAL_INPUT=$(echo "$TODAY_DATA" | jq -s 'map(.tokens.input) | add')
TOTAL_OUTPUT=$(echo "$TODAY_DATA" | jq -s 'map(.tokens.output) | add')

# 生成报告
cat > "$REPORT_FILE" << REPORT
# Daily Cost Report - $TODAY

## Summary

- **Total Operations**: $TOTAL_OPS
- **Total Cost**: \$$TOTAL_COST
- **Total Input Tokens**: $(printf "%'d" $TOTAL_INPUT)
- **Total Output Tokens**: $(printf "%'d" $TOTAL_OUTPUT)

## By Model

$(echo "$TODAY_DATA" | jq -r '.model' | sort | uniq -c | awk '{print "- **" $2 "**: " $1 " operations"}')

## By Operation

$(echo "$TODAY_DATA" | jq -r '.operation' | sort | uniq -c | awk '{print "- **" $2 "**: " $1 " times"}')

## Hourly Distribution

$(echo "$TODAY_DATA" | jq -r '.timestamp' | cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c | awk '{print "- **" $2 ":00**: " $1 " operations"}')

## Top Expensive Operations

$(echo "$TODAY_DATA" | jq -s 'sort_by(-.cost.total) | .[:5] | .[] | "- **\(.operation)** (\(.model)): $\(.cost.total) - \(.context.modules // [] | join(", "))"')

## Recommendations

REPORT

# 添加建议
AVG_COST=$(echo "scale=4; $TOTAL_COST / $TOTAL_OPS" | bc)
if (( $(echo "$AVG_COST > 0.15" | bc -l) )); then
  echo "- ⚠️ Average cost per operation (\$$AVG_COST) is high. Consider using Haiku model for simple tasks." >> "$REPORT_FILE"
fi

if [ "$TOTAL_OPS" -gt 50 ]; then
  echo "- ⚠️ High number of operations today. Consider batch mode for documentation updates." >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "Generated at $(date)" >> "$REPORT_FILE"

echo "✅ Report generated: $REPORT_FILE"
cat "$REPORT_FILE"
EOF

chmod +x scripts/daily-report.sh
```

### 每周报告脚本

```bash
cat > scripts/weekly-report.sh << 'EOF'
#!/bin/bash
# 生成每周成本报告

LOG_FILE=".facio-superpowers/cost-log.jsonl"
REPORT_DIR=".facio-superpowers/reports"
WEEK_START=$(date -d "7 days ago" +%Y-%m-%d)
TODAY=$(date +%Y-%m-%d)
REPORT_FILE="$REPORT_DIR/weekly-$TODAY.md"

mkdir -p "$REPORT_DIR"

# 提取本周数据
WEEK_DATA=$(awk -v start="$WEEK_START" -v end="$TODAY" '$0 >= start && $0 <= end' "$LOG_FILE")

if [ -z "$WEEK_DATA" ]; then
  echo "No operations this week"
  exit 0
fi

# 计算统计
TOTAL_OPS=$(echo "$WEEK_DATA" | wc -l)
TOTAL_COST=$(echo "$WEEK_DATA" | jq -s 'map(.cost.total) | add')

# 生成报告
cat > "$REPORT_FILE" << REPORT
# Weekly Cost Report - $WEEK_START to $TODAY

## Summary

- **Total Operations**: $TOTAL_OPS
- **Total Cost**: \$$TOTAL_COST
- **Average Daily Cost**: \$$(echo "scale=2; $TOTAL_COST / 7" | bc)
- **Average Cost per Operation**: \$$(echo "scale=4; $TOTAL_COST / $TOTAL_OPS" | bc)

## Daily Breakdown

$(for i in {0..6}; do
  day=$(date -d "$i days ago" +%Y-%m-%d)
  day_cost=$(grep "$day" "$LOG_FILE" | jq -s 'map(.cost.total) | add // 0')
  day_ops=$(grep "$day" "$LOG_FILE" | wc -l)
  echo "- **$day**: $day_ops ops, \$$day_cost"
done)

## Model Usage

$(echo "$WEEK_DATA" | jq -r '.model' | sort | uniq -c | awk '{print "- **" $2 "**: " $1 " operations"}')

## Most Active Modules

$(echo "$WEEK_DATA" | jq -r '.context.modules[]?' | sort | uniq -c | sort -rn | head -5 | awk '{print "- **" $2 "**: " $1 " updates"}')

## Cost Trends

$(echo "TODO: Add trend analysis")

## Recommendations

REPORT

# 添加建议
PROJECTED_MONTHLY=$(echo "scale=2; $TOTAL_COST * 4.3" | bc)
echo "- 📊 Projected monthly cost: \$$PROJECTED_MONTHLY" >> "$REPORT_FILE"

if (( $(echo "$PROJECTED_MONTHLY > 50" | bc -l) )); then
  echo "- ⚠️ Projected cost exceeds monthly budget. Consider optimization strategies." >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "Generated at $(date)" >> "$REPORT_FILE"

echo "✅ Report generated: $REPORT_FILE"
EOF

chmod +x scripts/weekly-report.sh
```

## 实时监控

### 在 CLAUDE.md 中添加成本提醒

```markdown
## Cost Awareness

Before each operation, check current cost status:

```bash
./scripts/analyze-cost.sh
```

If approaching budget limit:
- Use Haiku model instead of Sonnet
- Enable batch mode for documentation updates
- Skip documentation updates for minor changes
```

### 在 verification-before-completion 中添加预算检查

```markdown
## Budget Check (Before Documentation Update)

1. Read current month's cost from log file
2. Calculate percentage of budget used
3. If > 90%:
   ```
   ⚠️  BUDGET ALERT: 90% of monthly budget used ($45/$50)

   Options:
   1. Skip documentation update (save ~$0.05)
   2. Use Haiku model (save ~$0.03)
   3. Continue with Sonnet (recommended for quality)

   Your choice?
   ```

4. If > 70%:
   ```
   ⚠️  Budget warning: 70% of monthly budget used ($35/$50)
   Continuing with documentation update...
   ```
```

## 成本优化建议

### 基于监控数据的优化

```bash
# 分析哪些操作最贵
grep '"operation"' .facio-superpowers/cost-log.jsonl | \
  jq -s 'group_by(.operation) | map({operation: .[0].operation, total: map(.cost.total) | add, count: length}) | sort_by(-.total)'

# 输出示例：
# [
#   {"operation": "verification", "total": 15.67, "count": 89},
#   {"operation": "brainstorming", "total": 6.78, "count": 34},
#   ...
# ]

# 针对性优化：
# - verification 最贵 → 提高触发阈值
# - brainstorming 次数多 → 考虑是否必要
```

## 集成到 CLI

### 在 cli.js 中添加成本命令

```javascript
case 'cost':
  showCostAnalysis();
  break;
case 'report':
  generateReport(process.argv[3]); // daily or weekly
  break;
```

### 使用

```bash
# 查看成本分析
npx facio-superpowers cost

# 生成每日报告
npx facio-superpowers report daily

# 生成每周报告
npx facio-superpowers report weekly
```

## 总结

### 监控流程

```
1. AI 调用 → 自动记录 token 使用
2. 追加到 cost-log.jsonl
3. 实时检查预算状态
4. 每日/每周生成报告
5. 根据数据优化配置
```

### 关键指标

- **每次操作成本**：$0.03-0.15
- **每日成本**：$0.50-3.00
- **每月成本**：$10-60
- **预算利用率**：< 90%

### 优化策略

1. **智能触发**：减少不必要的调用
2. **模型选择**：简单任务用 Haiku
3. **批量处理**：积累后统一更新
4. **缓存机制**：避免重复扫描
5. **预算预警**：及时调整策略

通过这套监控系统，团队可以：
- ✅ 清楚了解成本构成
- ✅ 及时发现异常消耗
- ✅ 基于数据优化配置
- ✅ 控制成本在预算内

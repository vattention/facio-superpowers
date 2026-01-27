#!/bin/bash
# Facio Superpowers - 每日成本报告

set -e

LOG_FILE=".facio-superpowers/cost-log.jsonl"
REPORT_DIR=".facio-superpowers/reports"
TODAY=$(date +%Y-%m-%d)
REPORT_FILE="$REPORT_DIR/daily-$TODAY.md"

# 检查日志文件
if [ ! -f "$LOG_FILE" ]; then
  echo "❌ No cost log found"
  exit 1
fi

# 创建报告目录
mkdir -p "$REPORT_DIR"

# 提取今天的数据
TODAY_DATA=$(grep "$TODAY" "$LOG_FILE" 2>/dev/null || echo "")

if [ -z "$TODAY_DATA" ]; then
  echo "No operations today"
  exit 0
fi

# 计算统计
TOTAL_OPS=$(echo "$TODAY_DATA" | wc -l | tr -d ' ')
TOTAL_COST=$(echo "$TODAY_DATA" | jq -s 'map(.cost.total) | add' 2>/dev/null || echo "0")
TOTAL_INPUT=$(echo "$TODAY_DATA" | jq -s 'map(.tokens.input) | add' 2>/dev/null || echo "0")
TOTAL_OUTPUT=$(echo "$TODAY_DATA" | jq -s 'map(.tokens.output) | add' 2>/dev/null || echo "0")

# 生成报告
cat > "$REPORT_FILE" << REPORT
# Daily Cost Report - $TODAY

## Summary

- **Total Operations**: $TOTAL_OPS
- **Total Cost**: \$$TOTAL_COST
- **Total Input Tokens**: $(printf "%'d" $TOTAL_INPUT 2>/dev/null || echo $TOTAL_INPUT)
- **Total Output Tokens**: $(printf "%'d" $TOTAL_OUTPUT 2>/dev/null || echo $TOTAL_OUTPUT)
- **Average Cost per Operation**: \$$(awk "BEGIN {printf \"%.4f\", $TOTAL_COST / $TOTAL_OPS}" 2>/dev/null || echo "0")

## By Model

REPORT

# 按模型统计
echo "$TODAY_DATA" | jq -r '.model' 2>/dev/null | sort | uniq -c | while read count model; do
  model_cost=$(echo "$TODAY_DATA" | jq -s --arg model "$model" 'map(select(.model == $model)) | map(.cost.total) | add' 2>/dev/null || echo "0")
  echo "- **$model**: $count operations, \$$model_cost" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" << REPORT

## By Operation

REPORT

# 按操作统计
echo "$TODAY_DATA" | jq -r '.operation' 2>/dev/null | sort | uniq -c | while read count op; do
  op_cost=$(echo "$TODAY_DATA" | jq -s --arg op "$op" 'map(select(.operation == $op)) | map(.cost.total) | add' 2>/dev/null || echo "0")
  echo "- **$op**: $count times, \$$op_cost" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" << REPORT

## Hourly Distribution

REPORT

# 按小时统计
echo "$TODAY_DATA" | jq -r '.timestamp' 2>/dev/null | cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c | while read count hour; do
  echo "- **${hour}:00**: $count operations" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" << REPORT

## Top 5 Most Expensive Operations

REPORT

# 最贵的操作
echo "$TODAY_DATA" | jq -s 'sort_by(-.cost.total) | .[:5] | .[] | "- **\(.operation)** (\(.model)): $\(.cost.total) - \(.context.modules // [] | join(", "))"' 2>/dev/null >> "$REPORT_FILE"

cat >> "$REPORT_FILE" << REPORT

## Recommendations

REPORT

# 添加建议
AVG_COST=$(awk "BEGIN {printf \"%.4f\", $TOTAL_COST / $TOTAL_OPS}" 2>/dev/null || echo "0")
if (( $(echo "$AVG_COST > 0.15" | bc -l 2>/dev/null || echo "0") )); then
  echo "- ⚠️ Average cost per operation (\$$AVG_COST) is high. Consider using Haiku model for simple tasks." >> "$REPORT_FILE"
fi

if [ "$TOTAL_OPS" -gt 50 ]; then
  echo "- ⚠️ High number of operations today ($TOTAL_OPS). Consider batch mode for documentation updates." >> "$REPORT_FILE"
fi

# 检查是否有很多小操作
SMALL_OPS=$(echo "$TODAY_DATA" | jq -s 'map(select(.cost.total < 0.01)) | length' 2>/dev/null || echo "0")
if [ "$SMALL_OPS" -gt 10 ]; then
  echo "- 💡 Many small operations detected ($SMALL_OPS). These could be batched to reduce overhead." >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << REPORT

---

*Generated at $(date)*
REPORT

echo "✅ Report generated: $REPORT_FILE"
echo ""
cat "$REPORT_FILE"

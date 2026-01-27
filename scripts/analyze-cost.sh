#!/bin/bash
# Facio Superpowers - 成本分析工具

set -e

LOG_FILE=".facio-superpowers/cost-log.jsonl"
CONFIG_FILE=".facio-superpowers.yml"

# 颜色定义
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查日志文件
if [ ! -f "$LOG_FILE" ]; then
  echo -e "${YELLOW}⚠️  No cost log found${NC}"
  echo "Cost tracking will start when you use facio-superpowers skills."
  exit 0
fi

# 读取配置
BUDGET=50
if [ -f "$CONFIG_FILE" ]; then
  BUDGET=$(grep "monthly_budget:" "$CONFIG_FILE" | awk '{print $2}' || echo "50")
fi

echo -e "${BLUE}📊 Facio Superpowers - Cost Analysis${NC}"
echo "========================================"
echo ""

# 今天的成本
TODAY=$(date +%Y-%m-%d)
TODAY_COST=$(grep "$TODAY" "$LOG_FILE" 2>/dev/null | jq -s 'map(.cost.total) | add // 0' 2>/dev/null || echo "0")
TODAY_OPS=$(grep "$TODAY" "$LOG_FILE" 2>/dev/null | wc -l | tr -d ' ')

echo -e "${GREEN}📅 Today ($TODAY):${NC}"
printf "   Operations: %d\n" "$TODAY_OPS"
printf "   Cost: \$%.4f\n" "$TODAY_COST"
echo ""

# 本月成本
MONTH=$(date +%Y-%m)
MONTH_COST=$(grep "$MONTH" "$LOG_FILE" 2>/dev/null | jq -s 'map(.cost.total) | add // 0' 2>/dev/null || echo "0")
MONTH_OPS=$(grep "$MONTH" "$LOG_FILE" 2>/dev/null | wc -l | tr -d ' ')

echo -e "${GREEN}📆 This Month ($MONTH):${NC}"
printf "   Operations: %d\n" "$MONTH_OPS"
printf "   Cost: \$%.4f\n" "$MONTH_COST"
echo ""

# 按模型统计
echo -e "${BLUE}🤖 By Model:${NC}"
for model in haiku sonnet opus; do
  MODEL_COST=$(grep "\"model\":\"$model\"" "$LOG_FILE" 2>/dev/null | jq -s 'map(.cost.total) | add // 0' 2>/dev/null || echo "0")
  MODEL_OPS=$(grep "\"model\":\"$model\"" "$LOG_FILE" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$MODEL_OPS" -gt 0 ]; then
    printf "   %-10s %3d ops, \$%.4f\n" "$model:" "$MODEL_OPS" "$MODEL_COST"
  fi
done
echo ""

# 按操作统计
echo -e "${BLUE}⚙️  By Operation:${NC}"
for op in verification brainstorming writing-plans prepare-context; do
  OP_COST=$(grep "\"operation\":\"$op\"" "$LOG_FILE" 2>/dev/null | jq -s 'map(.cost.total) | add // 0' 2>/dev/null || echo "0")
  OP_OPS=$(grep "\"operation\":\"$op\"" "$LOG_FILE" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$OP_OPS" -gt 0 ]; then
    printf "   %-25s %3d ops, \$%.4f\n" "$op:" "$OP_OPS" "$OP_COST"
  fi
done
echo ""

# 预算检查
if [ "$MONTH_OPS" -gt 0 ]; then
  PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($MONTH_COST / $BUDGET) * 100}")

  echo -e "${BLUE}💰 Budget Status:${NC}"
  printf "   Monthly Budget: \$%.2f\n" "$BUDGET"
  printf "   Used: \$%.4f (%.1f%%)\n" "$MONTH_COST" "$PERCENTAGE"

  # 预警
  if (( $(echo "$PERCENTAGE > 90" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "   ${RED}⚠️  CRITICAL: Over 90% of budget!${NC}"
    echo -e "   ${YELLOW}Recommendation: Enable batch mode or use Haiku model${NC}"
  elif (( $(echo "$PERCENTAGE > 70" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "   ${YELLOW}⚠️  WARNING: Over 70% of budget${NC}"
    echo -e "   ${YELLOW}Recommendation: Monitor usage closely${NC}"
  else
    echo -e "   ${GREEN}✅ Within budget${NC}"
  fi
  echo ""

  # 平均成本
  AVG_COST=$(awk "BEGIN {printf \"%.4f\", $MONTH_COST / $MONTH_OPS}")
  echo -e "${BLUE}📈 Statistics:${NC}"
  printf "   Average cost per operation: \$%.4f\n" "$AVG_COST"

  # 预测
  DAYS_IN_MONTH=$(date -d "$(date +%Y-%m-01) +1 month -1 day" +%d 2>/dev/null || echo "30")
  CURRENT_DAY=$(date +%d | sed 's/^0//')
  PROJECTED=$(awk "BEGIN {printf \"%.2f\", ($MONTH_COST / $CURRENT_DAY) * $DAYS_IN_MONTH}")
  printf "   Projected monthly cost: \$%.2f\n" "$PROJECTED"

  if (( $(echo "$PROJECTED > $BUDGET" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "   ${YELLOW}⚠️  Projected to exceed budget${NC}"
  fi
fi

echo ""
echo "========================================"
echo -e "${BLUE}💡 Tips:${NC}"
echo "   - Use 'haiku' model for simple tasks"
echo "   - Enable batch mode for documentation updates"
echo "   - Increase trigger thresholds to reduce operations"
echo ""
echo "Run './scripts/daily-report.sh' for detailed report"

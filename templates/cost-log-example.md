# 成本日志示例

这是一个示例成本日志文件，展示了记录格式。

## 日志格式（JSONL）

每行一条记录，JSON 格式：

```jsonl
{"timestamp":"2026-01-27T10:30:00Z","operation":"verification","model":"sonnet","tokens":{"input":15234,"output":3421},"cost":{"input":0.046,"output":0.051,"total":0.097},"context":{"files_changed":3,"modules":["account"]}}
{"timestamp":"2026-01-27T11:15:00Z","operation":"brainstorming","model":"sonnet","tokens":{"input":8234,"output":5621},"cost":{"input":0.025,"output":0.084,"total":0.109},"context":{"feature":"login-page"}}
{"timestamp":"2026-01-27T14:20:00Z","operation":"verification","model":"haiku","tokens":{"input":5234,"output":1221},"cost":{"input":0.001,"output":0.002,"total":0.003},"context":{"files_changed":1,"modules":["utils"]}}
```

## 字段说明

- **timestamp**: ISO 8601 格式的时间戳
- **operation**: 操作类型（verification, brainstorming, writing-plans, prepare-context）
- **model**: 使用的模型（haiku, sonnet, opus）
- **tokens**: Token 使用情况
  - input: 输入 tokens
  - output: 输出 tokens
- **cost**: 成本（美元）
  - input: 输入成本
  - output: 输出成本
  - total: 总成本
- **context**: 上下文信息（可选）
  - files_changed: 变更的文件数
  - modules: 涉及的模块
  - feature: 功能名称
  - doc_updates: 更新的文档

## 如何记录

### 方式 1：AI 工具自动记录（推荐）

在 verification-before-completion skill 中，AI 工具会自动记录每次调用的 token 使用情况。

### 方式 2：手动记录

```bash
# 使用记录脚本
./scripts/log-cost.sh verification sonnet 15234 3421

# 或直接追加到日志文件
echo '{"timestamp":"2026-01-27T10:30:00Z","operation":"verification","model":"sonnet","tokens":{"input":15234,"output":3421},"cost":{"input":0.046,"output":0.051,"total":0.097}}' >> .facio-superpowers/cost-log.jsonl
```

## 查看成本

```bash
# 分析成本
./scripts/analyze-cost.sh

# 生成每日报告
./scripts/daily-report.sh

# 查看原始日志
cat .facio-superpowers/cost-log.jsonl | jq .
```

## 成本计算

### 模型价格（美元/百万 tokens）

| 模型 | Input | Output |
|------|-------|--------|
| Haiku | $0.25 | $1.25 |
| Sonnet | $3.00 | $15.00 |
| Opus | $15.00 | $75.00 |

### 计算公式

```
input_cost = (input_tokens / 1,000,000) * input_price
output_cost = (output_tokens / 1,000,000) * output_price
total_cost = input_cost + output_cost
```

### 示例

使用 Sonnet 模型：
- Input: 15,234 tokens
- Output: 3,421 tokens

计算：
```
input_cost = (15,234 / 1,000,000) * 3.00 = $0.046
output_cost = (3,421 / 1,000,000) * 15.00 = $0.051
total_cost = $0.046 + $0.051 = $0.097
```

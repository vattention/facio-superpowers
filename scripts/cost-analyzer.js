# 成本监控实现指南

> 如何在 AI 辅助开发中追踪和控制 token 使用成本

## 概述

本指南说明如何实现成本监控，包括：
1. Token 使用记录
2. 成本计算
3. 预算预警
4. 使用报告

## 实现方式

### 方式 1：客户端记录（推荐用于 Claude Code）

在每次 AI 工具调用后记录 token 使用情况。

#### 实现步骤

**1. 创建日志文件**

```bash
mkdir -p .facio-superpowers
touch .facio-superpowers/cost-log.jsonl
```

**2. 在 verification-before-completion skill 中添加记录逻辑**

在 skill 执行完成后，记录本次调用的 token 使用：

```markdown
## Cost Tracking

After completing verification and documentation updates, log the token usage:

```bash
# 记录格式（JSONL - 每行一个 JSON 对象）
{
  "timestamp": "2026-01-27T10:30:00Z",
  "skill": "verification-before-completion",
  "model": "sonnet",
  "input_tokens": 15234,
  "output_tokens": 3421,
  "cost_usd": 0.097,
  "operation": "doc_update",
  "module": "account",
  "files_changed": 3
}
```

**记录方法：**

```bash
# 使用 echo 追加到日志文件
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","skill":"verification-before-completion","model":"sonnet","input_tokens":15234,"output_tokens":3421,"cost_usd":0.097}' >> .facio-superpowers/cost-log.jsonl
```

**注意：** Claude Code 会在响应中显示 token 使用情况，AI 工具应该读取这些信息并记录。
```

#### 3. 创建成本计算脚本

<function_calls>
<invoke name="Write">
<parameter name="content">#!/usr/bin/env node

/**
 * Facio Superpowers 成本分析工具
 *
 * 用法：
 *   node cost-analyzer.js              # 显示今日成本
 *   node cost-analyzer.js --week       # 显示本周成本
 *   node cost-analyzer.js --month      # 显示本月成本
 *   node cost-analyzer.js --report     # 生成详细报告
 */

const fs = require('fs');
const path = require('path');

// 配置
const LOG_FILE = '.facio-superpowers/cost-log.jsonl';
const REPORT_DIR = '.facio-superpowers/reports';

// 模型价格（美元/百万 tokens）
const PRICING = {
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 }
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 读取日志
function readLogs() {
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }

  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = content.trim().split('\n').filter(line => line);

  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.error('Failed to parse log line:', line);
      return null;
    }
  }).filter(log => log !== null);
}

// 计算成本
function calculateCost(inputTokens, outputTokens, model) {
  const pricing = PRICING[model] || PRICING.sonnet;
  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  return inputCost + outputCost;
}

// 过滤日志
function filterLogs(logs, period) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return logs.filter(log => {
    const logDate = new Date(log.timestamp);

    switch (period) {
      case 'day':
        return logDate >= startOfDay;
      case 'week':
        return logDate >= startOfWeek;
      case 'month':
        return logDate >= startOfMonth;
      default:
        return true;
    }
  });
}

// 统计分析
function analyzeUsage(logs) {
  const stats = {
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    callCount: logs.length,
    byModel: {},
    bySkill: {},
    byModule: {},
    byDay: {}
  };

  logs.forEach(log => {
    // 总计
    stats.totalCost += log.cost_usd || calculateCost(log.input_tokens, log.output_tokens, log.model);
    stats.totalInputTokens += log.input_tokens || 0;
    stats.totalOutputTokens += log.output_tokens || 0;

    // 按模型
    if (!stats.byModel[log.model]) {
      stats.byModel[log.model] = { cost: 0, calls: 0, tokens: 0 };
    }
    stats.byModel[log.model].cost += log.cost_usd || 0;
    stats.byModel[log.model].calls += 1;
    stats.byModel[log.model].tokens += (log.input_tokens || 0) + (log.output_tokens || 0);

    // 按 skill
    if (!stats.bySkill[log.skill]) {
      stats.bySkill[log.skill] = { cost: 0, calls: 0 };
    }
    stats.bySkill[log.skill].cost += log.cost_usd || 0;
    stats.bySkill[log.skill].calls += 1;

    // 按模块
    if (log.module) {
      if (!stats.byModule[log.module]) {
        stats.byModule[log.module] = { cost: 0, calls: 0 };
      }
      stats.byModule[log.module].cost += log.cost_usd || 0;
      stats.byModule[log.module].calls += 1;
    }

    // 按日期
    const date = log.timestamp.split('T')[0];
    if (!stats.byDay[date]) {
      stats.byDay[date] = { cost: 0, calls: 0 };
    }
    stats.byDay[date].cost += log.cost_usd || 0;
    stats.byDay[date].calls += 1;
  });

  return stats;
}

// 显示摘要
function displaySummary(stats, period) {
  const periodName = {
    day: '今日',
    week: '本周',
    month: '本月'
  }[period] || '总计';

  log(`\n📊 ${periodName}成本统计\n`, 'blue');

  // 总览
  log('总览：', 'green');
  log(`  调用次数：${stats.callCount}`);
  log(`  总成本：$${stats.totalCost.toFixed(4)}`);
  log(`  输入 tokens：${stats.totalInputTokens.toLocaleString()}`);
  log(`  输出 tokens：${stats.totalOutputTokens.toLocaleString()}`);
  log(`  总 tokens：${(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()}`);

  // 按模型
  log('\n按模型：', 'green');
  Object.entries(stats.byModel)
    .sort((a, b) => b[1].cost - a[1].cost)
    .forEach(([model, data]) => {
      log(`  ${model.padEnd(10)} $${data.cost.toFixed(4).padStart(8)}  (${data.calls} 次调用, ${data.tokens.toLocaleString()} tokens)`);
    });

  // 按 skill
  log('\n按 Skill：', 'green');
  Object.entries(stats.bySkill)
    .sort((a, b) => b[1].cost - a[1].cost)
    .forEach(([skill, data]) => {
      log(`  ${skill.padEnd(35)} $${data.cost.toFixed(4).padStart(8)}  (${data.calls} 次)`);
    });

  // 按模块
  if (Object.keys(stats.byModule).length > 0) {
    log('\n按模块：', 'green');
    Object.entries(stats.byModule)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10)
      .forEach(([module, data]) => {
        log(`  ${module.padEnd(20)} $${data.cost.toFixed(4).padStart(8)}  (${data.calls} 次)`);
      });
  }

  // 预算检查
  const MONTHLY_BUDGET = 50; // 从配置读取
  if (period === 'month') {
    const percentage = (stats.totalCost / MONTHLY_BUDGET) * 100;
    log('\n预算使用：', 'green');

    let color = 'green';
    if (percentage >= 90) color = 'red';
    else if (percentage >= 70) color = 'yellow';

    log(`  ${percentage.toFixed(1)}% ($${stats.totalCost.toFixed(2)} / $${MONTHLY_BUDGET})`, color);

    if (percentage >= 90) {
      log('  ⚠️  警告：已接近预算上限！', 'red');
    } else if (percentage >= 70) {
      log('  ⚠️  注意：已使用超过 70% 预算', 'yellow');
    }
  }

  log('');
}

// 生成详细报告
function generateReport(stats, period) {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const reportFile = path.join(REPORT_DIR, `cost-report-${period}-${timestamp}.md`);

  let report = `# Facio Superpowers 成本报告\n\n`;
  report += `**生成时间：** ${new Date().toLocaleString('zh-CN')}\n`;
  report += `**统计周期：** ${period}\n\n`;

  report += `## 总览\n\n`;
  report += `| 指标 | 数值 |\n`;
  report += `|------|------|\n`;
  report += `| 调用次数 | ${stats.callCount} |\n`;
  report += `| 总成本 | $${stats.totalCost.toFixed(4)} |\n`;
  report += `| 输入 tokens | ${stats.totalInputTokens.toLocaleString()} |\n`;
  report += `| 输出 tokens | ${stats.totalOutputTokens.toLocaleString()} |\n`;
  report += `| 总 tokens | ${(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()} |\n\n`;

  report += `## 按模型统计\n\n`;
  report += `| 模型 | 成本 | 调用次数 | Tokens |\n`;
  report += `|------|------|---------|--------|\n`;
  Object.entries(stats.byModel)
    .sort((a, b) => b[1].cost - a[1].cost)
    .forEach(([model, data]) => {
      report += `| ${model} | $${data.cost.toFixed(4)} | ${data.calls} | ${data.tokens.toLocaleString()} |\n`;
    });

  report += `\n## 按 Skill 统计\n\n`;
  report += `| Skill | 成本 | 调用次数 |\n`;
  report += `|-------|------|----------|\n`;
  Object.entries(stats.bySkill)
    .sort((a, b) => b[1].cost - a[1].cost)
    .forEach(([skill, data]) => {
      report += `| ${skill} | $${data.cost.toFixed(4)} | ${data.calls} |\n`;
    });

  if (Object.keys(stats.byModule).length > 0) {
    report += `\n## 按模块统计（Top 10）\n\n`;
    report += `| 模块 | 成本 | 调用次数 |\n`;
    report += `|------|------|----------|\n`;
    Object.entries(stats.byModule)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 10)
      .forEach(([module, data]) => {
        report += `| ${module} | $${data.cost.toFixed(4)} | ${data.calls} |\n`;
      });
  }

  report += `\n## 每日趋势\n\n`;
  report += `| 日期 | 成本 | 调用次数 |\n`;
  report += `|------|------|----------|\n`;
  Object.entries(stats.byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([date, data]) => {
      report += `| ${date} | $${data.cost.toFixed(4)} | ${data.calls} |\n`;
    });

  fs.writeFileSync(reportFile, report);
  log(`\n📄 报告已生成：${reportFile}\n`, 'green');
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const period = args.includes('--week') ? 'week'
               : args.includes('--month') ? 'month'
               : 'day';
  const generateReportFlag = args.includes('--report');

  log('\n🔍 读取成本日志...', 'blue');
  const allLogs = readLogs();

  if (allLogs.length === 0) {
    log('  没有找到成本记录', 'gray');
    log('  提示：成本记录会在使用 skills 时自动生成\n', 'gray');
    return;
  }

  log(`  找到 ${allLogs.length} 条记录\n`, 'gray');

  const logs = filterLogs(allLogs, period);
  const stats = analyzeUsage(logs);

  displaySummary(stats, period);

  if (generateReportFlag) {
    generateReport(stats, period);
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { readLogs, analyzeUsage, calculateCost };

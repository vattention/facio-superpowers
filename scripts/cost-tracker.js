#!/usr/bin/env node

/**
 * Facio Superpowers 成本监控脚本
 *
 * 功能：
 * - 记录每次 AI 调用的 token 使用量
 * - 计算成本
 * - 生成报告
 * - 预算预警
 */

const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_DIR = path.join(process.cwd(), '.facio-superpowers');
const LOG_FILE = path.join(CONFIG_DIR, 'cost-log.jsonl');
const REPORT_DIR = path.join(CONFIG_DIR, 'reports');

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

// 确保目录存在
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 记录 token 使用
function logUsage(data) {
  ensureDir(CONFIG_DIR);

  const entry = {
    timestamp: new Date().toISOString(),
    model: data.model || 'sonnet',
    operation: data.operation || 'unknown',
    input_tokens: data.input_tokens || 0,
    output_tokens: data.output_tokens || 0,
    cost: calculateCost(data.model, data.input_tokens, data.output_tokens),
    module: data.module || null,
    files_changed: data.files_changed || 0
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  return entry;
}

// 计算成本
function calculateCost(model, inputTokens, outputTokens) {
  const pricing = PRICING[model] || PRICING.sonnet;
  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  return inputCost + outputCost;
}

// 读取日志
function readLogs(startDate = null, endDate = null) {
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }

  const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(l => l.trim());
  let logs = lines.map(line => JSON.parse(line));

  if (startDate) {
    logs = logs.filter(log => new Date(log.timestamp) >= startDate);
  }
  if (endDate) {
    logs = logs.filter(log => new Date(log.timestamp) <= endDate);
  }

  return logs;
}

// 生成统计报告
function generateStats(logs) {
  if (logs.length === 0) {
    return {
      total_calls: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost: 0,
      by_model: {},
      by_operation: {},
      by_module: {}
    };
  }

  const stats = {
    total_calls: logs.length,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cost: 0,
    by_model: {},
    by_operation: {},
    by_module: {}
  };

  logs.forEach(log => {
    stats.total_input_tokens += log.input_tokens;
    stats.total_output_tokens += log.output_tokens;
    stats.total_cost += log.cost;

    // 按模型统计
    if (!stats.by_model[log.model]) {
      stats.by_model[log.model] = {
        calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost: 0
      };
    }
    stats.by_model[log.model].calls++;
    stats.by_model[log.model].input_tokens += log.input_tokens;
    stats.by_model[log.model].output_tokens += log.output_tokens;
    stats.by_model[log.model].cost += log.cost;

    // 按操作统计
    if (!stats.by_operation[log.operation]) {
      stats.by_operation[log.operation] = {
        calls: 0,
        cost: 0
      };
    }
    stats.by_operation[log.operation].calls++;
    stats.by_operation[log.operation].cost += log.cost;

    // 按模块统计
    if (log.module) {
      if (!stats.by_module[log.module]) {
        stats.by_module[log.module] = {
          calls: 0,
          cost: 0
        };
      }
      stats.by_module[log.module].calls++;
      stats.by_module[log.module].cost += log.cost;
    }
  });

  return stats;
}

// 显示报告
function displayReport(period, stats, budget = null) {
  log(`\n📊 ${period} 成本报告\n`, 'blue');

  // 总览
  log('总览', 'blue');
  log(`  调用次数: ${stats.total_calls}`);
  log(`  输入 tokens: ${stats.total_input_tokens.toLocaleString()}`);
  log(`  输出 tokens: ${stats.total_output_tokens.toLocaleString()}`);
  log(`  总成本: $${stats.total_cost.toFixed(4)}`, 'green');

  // 预算检查
  if (budget) {
    const percentage = (stats.total_cost / budget) * 100;
    let color = 'green';
    let status = '✅';

    if (percentage >= 90) {
      color = 'red';
      status = '🚨';
    } else if (percentage >= 70) {
      color = 'yellow';
      status = '⚠️';
    }

    log(`  预算使用: ${status} ${percentage.toFixed(1)}% ($${stats.total_cost.toFixed(2)} / $${budget})`, color);
  }

  // 按模型统计
  if (Object.keys(stats.by_model).length > 0) {
    log('\n按模型统计', 'blue');
    Object.entries(stats.by_model).forEach(([model, data]) => {
      log(`  ${model}:`);
      log(`    调用: ${data.calls} 次`);
      log(`    成本: $${data.cost.toFixed(4)}`);
      log(`    平均: $${(data.cost / data.calls).toFixed(4)}/次`, 'gray');
    });
  }

  // 按操作统计
  if (Object.keys(stats.by_operation).length > 0) {
    log('\n按操作统计', 'blue');
    const sorted = Object.entries(stats.by_operation)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5);

    sorted.forEach(([operation, data]) => {
      log(`  ${operation}: ${data.calls} 次, $${data.cost.toFixed(4)}`);
    });
  }

  // 按模块统计
  if (Object.keys(stats.by_module).length > 0) {
    log('\n按模块统计（Top 5）', 'blue');
    const sorted = Object.entries(stats.by_module)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5);

    sorted.forEach(([module, data]) => {
      log(`  ${module}: ${data.calls} 次, $${data.cost.toFixed(4)}`);
    });
  }

  log('');
}

// 今日报告
function todayReport(budget = null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const logs = readLogs(today);
  const stats = generateStats(logs);

  displayReport('今日', stats, budget);
}

// 本周报告
function weekReport(budget = null) {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const logs = readLogs(weekStart);
  const stats = generateStats(logs);

  displayReport('本周', stats, budget);
}

// 本月报告
function monthReport(budget = null) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const logs = readLogs(monthStart);
  const stats = generateStats(logs);

  displayReport('本月', stats, budget);
}

// 导出报告为 JSON
function exportReport(period, outputPath) {
  let startDate;
  const today = new Date();

  switch (period) {
    case 'today':
      startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay());
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    default:
      startDate = null;
  }

  const logs = readLogs(startDate);
  const stats = generateStats(logs);

  const report = {
    period,
    generated_at: new Date().toISOString(),
    stats,
    logs
  };

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  log(`✅ 报告已导出到: ${outputPath}`, 'green');
}

// CLI
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'today':
    todayReport(arg ? parseFloat(arg) : null);
    break;

  case 'week':
    weekReport(arg ? parseFloat(arg) : null);
    break;

  case 'month':
    monthReport(arg ? parseFloat(arg) : null);
    break;

  case 'export':
    if (!arg) {
      log('❌ 请指定导出路径', 'red');
      process.exit(1);
    }
    const period = process.argv[4] || 'month';
    exportReport(period, arg);
    break;

  case 'log':
    // 手动记录使用（用于测试）
    const usage = {
      model: process.argv[3] || 'sonnet',
      operation: process.argv[4] || 'test',
      input_tokens: parseInt(process.argv[5]) || 1000,
      output_tokens: parseInt(process.argv[6]) || 500
    };
    const entry = logUsage(usage);
    log(`✅ 已记录: $${entry.cost.toFixed(4)}`, 'green');
    break;

  default:
    log('\nFacio Superpowers 成本监控工具\n', 'blue');
    log('用法:');
    log('  node cost-tracker.js today [budget]     # 今日报告');
    log('  node cost-tracker.js week [budget]      # 本周报告');
    log('  node cost-tracker.js month [budget]     # 本月报告');
    log('  node cost-tracker.js export <path> [period]  # 导出报告');
    log('  node cost-tracker.js log <model> <op> <in> <out>  # 手动记录\n');
    log('示例:');
    log('  node cost-tracker.js today 50           # 今日报告，预算 $50');
    log('  node cost-tracker.js month 100          # 本月报告，预算 $100');
    log('  node cost-tracker.js export report.json month\n');
    break;
}

// 导出函数供其他脚本使用
module.exports = {
  logUsage,
  calculateCost,
  readLogs,
  generateStats,
  todayReport,
  weekReport,
  monthReport,
  exportReport
};

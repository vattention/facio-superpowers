#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function loadSnapshot(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function compactName(value, max = 180) {
  const text = String(value ?? '(unknown)').replace(/\s+/g, ' ');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...<truncated:${text.length - max}>`;
}

function summarize(file, limit = 40) {
  const snapshot = loadSnapshot(file);
  const meta = snapshot.snapshot?.meta;
  if (!meta?.node_fields || !Array.isArray(snapshot.nodes)) {
    throw new Error('Unsupported heap snapshot format');
  }
  const fields = meta.node_fields;
  const fieldCount = fields.length;
  const typeIndex = fields.indexOf('type');
  const nameIndex = fields.indexOf('name');
  const selfSizeIndex = fields.indexOf('self_size');
  const edgeCountIndex = fields.indexOf('edge_count');
  const nodeTypes = meta.node_types?.[typeIndex] || [];
  const byName = new Map();

  for (let i = 0; i < snapshot.nodes.length; i += fieldCount) {
    const typeId = snapshot.nodes[i + typeIndex];
    const type = nodeTypes[typeId] || String(typeId);
    const nameId = snapshot.nodes[i + nameIndex];
    const name = compactName(snapshot.strings[nameId] || '(unknown)');
    const selfSize = snapshot.nodes[i + selfSizeIndex] || 0;
    const edgeCount = snapshot.nodes[i + edgeCountIndex] || 0;
    const key = `${type}:${name}`;
    const current = byName.get(key) || { type, name, count: 0, selfSize: 0, edgeCount: 0 };
    current.count += 1;
    current.selfSize += selfSize;
    current.edgeCount += edgeCount;
    byName.set(key, current);
  }

  const topBySelfSize = [...byName.values()]
    .sort((a, b) => b.selfSize - a.selfSize)
    .slice(0, limit);
  const topByCount = [...byName.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return {
    file,
    nodeCount: snapshot.snapshot.node_count,
    edgeCount: snapshot.snapshot.edge_count,
    topBySelfSize,
    topByCount,
  };
}

function compare(beforeFile, afterFile, limit = 40) {
  const before = summarize(beforeFile, Number.MAX_SAFE_INTEGER);
  const after = summarize(afterFile, Number.MAX_SAFE_INTEGER);
  const beforeMap = new Map(before.topBySelfSize.concat(before.topByCount).map((x) => [`${x.type}:${x.name}`, x]));
  const afterItems = after.topBySelfSize.concat(after.topByCount);
  const seen = new Set();
  const deltas = [];
  for (const item of afterItems) {
    const key = `${item.type}:${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const old = beforeMap.get(key) || { count: 0, selfSize: 0, edgeCount: 0 };
    deltas.push({
      type: item.type,
      name: item.name,
      countDelta: item.count - old.count,
      selfSizeDelta: item.selfSize - old.selfSize,
      afterCount: item.count,
      afterSelfSize: item.selfSize,
    });
  }
  return {
    before: beforeFile,
    after: afterFile,
    nodeCountDelta: (after.nodeCount || 0) - (before.nodeCount || 0),
    edgeCountDelta: (after.edgeCount || 0) - (before.edgeCount || 0),
    topDeltas: deltas
      .filter((x) => x.countDelta !== 0 || x.selfSizeDelta !== 0)
      .sort((a, b) => Math.abs(b.selfSizeDelta) - Math.abs(a.selfSizeDelta))
      .slice(0, limit),
  };
}

function writeOrPrint(args, data) {
  if (args.output) {
    fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
    fs.writeFileSync(args.output, `${JSON.stringify(data, null, 2)}\n`);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function main() {
  const args = parseArgs(process.argv);
  const command = args._[0];
  const limit = Number(args.limit || 40);
  if (command === 'summary') {
    const file = args.file || args._[1];
    if (!file) throw new Error('Missing --file');
    return writeOrPrint(args, summarize(file, limit));
  }
  if (command === 'compare') {
    const before = args.before || args._[1];
    const after = args.after || args._[2];
    if (!before || !after) throw new Error('Missing --before and --after');
    return writeOrPrint(args, compare(before, after, limit));
  }
  throw new Error(`Unknown command: ${command || '<missing>'}`);
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message, stack: error.stack }, null, 2));
  process.exit(1);
}

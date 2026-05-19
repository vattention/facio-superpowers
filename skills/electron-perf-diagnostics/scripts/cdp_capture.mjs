#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function timestamp() {
  return new Date().toISOString();
}

function slug(value) {
  return String(value || 'target').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'target';
}

function defaultRunDir(label) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return path.join(process.env.HOME || '.', '.codex', 'diagnostics', `${ts}-${slug(label)}`);
}

function ensureDirs(runDir) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(path.join(runDir, 'cdp'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'cpu'), { recursive: true });
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function appendJsonl(file, data) {
  fs.appendFileSync(file, `${JSON.stringify(data)}\n`);
}

async function getTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Failed to list targets: HTTP ${response.status}`);
  return response.json();
}

function selectTarget(targets, targetRef) {
  if (!targetRef) {
    const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (page) return page;
    return targets.find((t) => t.webSocketDebuggerUrl);
  }
  const byId = targets.find((t) => t.id === targetRef);
  if (byId) return byId;
  const numeric = Number(targetRef);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < targets.length) return targets[numeric];
  const lower = String(targetRef).toLowerCase();
  return targets.find((t) =>
    String(t.title || '').toLowerCase().includes(lower) ||
    String(t.url || '').toLowerCase().includes(lower)
  );
}

class CDPClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    if (!globalThis.WebSocket) {
      throw new Error('This Node runtime does not provide global WebSocket. Use Node 22+ or install a WebSocket-capable runtime.');
    }
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result || {});
        return;
      }
      if (message.method && this.listeners.has(message.method)) {
        for (const listener of this.listeners.get(message.method)) listener(message.params || {});
      }
    });
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(listener);
  }

  send(method, params = {}, options = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    const timeoutMs = Number(options.timeoutMs || 15000);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }

  close() {
    this.ws?.close();
  }
}

async function withTarget(args, fn) {
  const port = Number(args.port || 9222);
  const targets = await getTargets(port);
  const target = selectTarget(targets, args.target);
  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`Target not found or has no debugger URL: ${args.target || '<default page>'}`);
  }
  const runDir = args['run-dir'] ? path.resolve(args['run-dir']) : defaultRunDir(`cdp-${target.id}`);
  ensureDirs(runDir);
  writeJson(path.join(runDir, 'cdp', 'targets.json'), targets);
  const client = new CDPClient(target.webSocketDebuggerUrl);
  await client.connect();
  try {
    return await fn({ client, target, runDir, port });
  } finally {
    client.close();
  }
}

async function listTargets(args) {
  const port = Number(args.port || 9222);
  const targets = await getTargets(port);
  const out = targets.map((t, index) => ({
    index,
    id: t.id,
    type: t.type,
    title: t.title,
    url: t.url,
    webSocketDebuggerUrl: Boolean(t.webSocketDebuggerUrl),
  }));
  if (args['run-dir']) {
    const runDir = path.resolve(args['run-dir']);
    ensureDirs(runDir);
    writeJson(path.join(runDir, 'cdp', 'targets.json'), targets);
  }
  console.log(JSON.stringify({ port, targets: out }, null, 2));
}

function metricsToObject(result) {
  const out = {};
  for (const metric of result.metrics || []) out[metric.name] = metric.value;
  return out;
}

async function rendererMemory(args) {
  await withTarget(args, async ({ client, target, runDir }) => {
    const duration = Number(args.duration || 60);
    const interval = Number(args.interval || 2);
    const label = slug(args.label || target.id);
    const metricsPath = path.join(runDir, 'cdp', `${label}-metrics.jsonl`);
    const domPath = path.join(runDir, 'cdp', `${label}-dom-counters.jsonl`);
    await client.send('Performance.enable');
    if (args['prepare-leak-detection']) {
      await client.send('Memory.prepareForLeakDetection').catch((err) => {
        appendJsonl(domPath, { ts: timestamp(), targetId: target.id, prepareLeakDetectionError: err.message });
      });
    }
    const end = Date.now() + duration * 1000;
    while (Date.now() <= end) {
      const [perf, dom] = await Promise.all([
        client.send('Performance.getMetrics').catch((err) => ({ error: err.message })),
        client.send('Memory.getDOMCounters').catch((err) => ({ error: err.message })),
      ]);
      appendJsonl(metricsPath, { ts: timestamp(), targetId: target.id, metrics: metricsToObject(perf), error: perf.error });
      appendJsonl(domPath, { ts: timestamp(), targetId: target.id, ...dom });
      if (Date.now() > end) break;
      await sleep(Math.max(interval, 0.2) * 1000);
    }
    const summary = summarizeJsonlDeltas(metricsPath, domPath);
    writeJson(path.join(runDir, 'cdp', `${label}-renderer-memory-summary.json`), summary);
    console.log(JSON.stringify({ runDir, target: target.id, metricsPath, domPath, summary }, null, 2));
  });
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function summarizeJsonlDeltas(metricsPath, domPath) {
  const metrics = readJsonl(metricsPath);
  const dom = readJsonl(domPath);
  const firstMetrics = metrics[0]?.metrics || {};
  const lastMetrics = metrics[metrics.length - 1]?.metrics || {};
  const metricKeys = ['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'LayoutCount', 'RecalcStyleCount'];
  const metricDeltas = {};
  for (const key of metricKeys) {
    if (typeof firstMetrics[key] === 'number' && typeof lastMetrics[key] === 'number') {
      metricDeltas[key] = lastMetrics[key] - firstMetrics[key];
    }
  }
  const firstDom = dom[0] || {};
  const lastDom = dom[dom.length - 1] || {};
  const domDeltas = {};
  for (const key of ['documents', 'nodes', 'jsEventListeners']) {
    if (typeof firstDom[key] === 'number' && typeof lastDom[key] === 'number') {
      domDeltas[key] = lastDom[key] - firstDom[key];
    }
  }
  return {
    metricSamples: metrics.length,
    domSamples: dom.length,
    metricDeltas,
    domDeltas,
  };
}

async function heapSnapshot(args) {
  await withTarget(args, async ({ client, target, runDir }) => {
    const label = slug(args.label || target.id);
    const file = path.join(runDir, 'cdp', `${label}.heapsnapshot`);
    const stream = fs.createWriteStream(file);
    client.on('HeapProfiler.addHeapSnapshotChunk', (params) => {
      stream.write(params.chunk || '');
    });
    await client.send('HeapProfiler.enable');
    await client.send('HeapProfiler.collectGarbage').catch(() => ({}));
    await client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: true });
    await new Promise((resolve) => stream.end(resolve));
    console.log(JSON.stringify({ runDir, target: target.id, file }, null, 2));
  });
}

function summarizeCpuProfile(profile) {
  const idToNode = new Map();
  for (const node of profile.nodes || []) idToNode.set(node.id, node);
  const counts = new Map();
  for (const sample of profile.samples || []) {
    const node = idToNode.get(sample);
    if (!node) continue;
    const frame = node.callFrame || {};
    const key = `${frame.functionName || '(anonymous)'} ${frame.url || ''}:${frame.lineNumber ?? ''}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([frame, samples]) => ({ frame, samples }));
}

async function rendererCpu(args) {
  await withTarget(args, async ({ client, target, runDir }) => {
    const duration = Number(args.duration || 30);
    const label = slug(args.label || target.id);
    const file = path.join(runDir, 'cpu', `${label}.cpuprofile`);
    await client.send('Profiler.enable');
    if (args.interval) {
      await client.send('Profiler.setSamplingInterval', { interval: Number(args.interval) });
    }
    await client.send('Profiler.start');
    await sleep(duration * 1000);
    const result = await client.send('Profiler.stop');
    writeJson(file, result.profile);
    const summary = { targetId: target.id, topFrames: summarizeCpuProfile(result.profile) };
    writeJson(path.join(runDir, 'cpu', `${label}-cpuprofile-summary.json`), summary);
    console.log(JSON.stringify({ runDir, target: target.id, file, summary }, null, 2));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const command = args._[0];
  if (!command) throw new Error('Missing command');
  if (command === 'list-targets') return listTargets(args);
  if (command === 'renderer-memory') return rendererMemory(args);
  if (command === 'renderer-cpu') return rendererCpu(args);
  if (command === 'heap-snapshot') return heapSnapshot(args);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});

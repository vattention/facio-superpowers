#!/usr/bin/env node
// spec-preview-server.mjs · v2.6.0 production
//
// Internal HTTP service serving files from configured git repos by running
// `git show origin/<branch>:<path>` per request. Intended exposure: behind
// Cloudflare Tunnel + Cloudflare Access (飞书 SSO).
//
// Routes:
//   GET /<repo>/<branch>/<path...>  → file content (Content-Type by ext)
//   GET /healthz                    → "ok"
//
// Env config:
//   PORT                  (default 8080)
//   SPEC_PREVIEW_REPOS    "name:abs-path,name:abs-path"  (REQUIRED)
//   FETCH_INTERVAL_MS     (default 30000)
//   CACHE_TTL_MS          (default 5000)

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname } from 'node:path';

const execFileAsync = promisify(execFile);

const PORT = parseInt(process.env.PORT || '8080', 10);
const FETCH_INTERVAL_MS = parseInt(process.env.FETCH_INTERVAL_MS || '30000', 10);
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '5000', 10);
const REPOS_RAW = process.env.SPEC_PREVIEW_REPOS;
if (!REPOS_RAW) {
  console.error('FATAL: SPEC_PREVIEW_REPOS env var required');
  console.error('Example: SPEC_PREVIEW_REPOS="facio-blueprint:/var/lib/specs/facio-blueprint"');
  process.exit(2);
}

const REPOS = new Map(
  REPOS_RAW.split(',').map(entry => {
    const idx = entry.indexOf(':');
    if (idx < 0) throw new Error(`bad SPEC_PREVIEW_REPOS entry: ${entry}`);
    return [entry.slice(0, idx).trim(), entry.slice(idx + 1).trim()];
  })
);

const BRANCH_PREFIXES = new Set(['feat', 'fix', 'chore', 'docs', 'test', 'spec', 'plan', 'refactor']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
};

function log(level, msg, fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }));
}

const cache = new Map();
function cacheGet(k) { const e = cache.get(k); if (!e) return null; if (Date.now() > e.expiresAt) { cache.delete(k); return null; } return e.content; }
function cacheSet(k, content) { cache.set(k, { content, expiresAt: Date.now() + CACHE_TTL_MS }); }

export function safeComponent(s) {
  if (!s || s.length > 200) return false;
  return !/[\x00-\x1f<>|;&$`\\]/.test(s);
}

async function gitFetch(name, dir) {
  try {
    await execFileAsync('git', ['-C', dir, 'fetch', '--all', '--prune', '--quiet'], { timeout: 30000 });
  } catch (err) {
    log('warn', 'git fetch failed', { repo: name, error: err.message });
  }
}

async function refreshAll() {
  await Promise.all([...REPOS].map(([n, d]) => gitFetch(n, d)));
}

async function gitShow(repoDir, branch, filePath) {
  const ref = `origin/${branch}`;
  try {
    await execFileAsync('git', ['-C', repoDir, 'rev-parse', '--verify', ref], { timeout: 5000 });
  } catch {
    return { status: 'branch-not-found' };
  }
  try {
    const { stdout } = await execFileAsync(
      'git', ['-C', repoDir, 'show', `${ref}:${filePath}`],
      { timeout: 10000, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
    );
    return { status: 'ok', content: stdout };
  } catch {
    return { status: 'path-not-found' };
  }
}

export function parseRequest(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 3) return null;
  const repo = parts[0];
  let branch, filePath;
  if (BRANCH_PREFIXES.has(parts[1]) && parts.length >= 4) {
    branch = `${parts[1]}/${parts[2]}`;
    filePath = parts.slice(3).join('/');
  } else {
    branch = parts[1];
    filePath = parts.slice(2).join('/');
  }
  return { repo, branch, filePath };
}

const server = createServer(async (req, res) => {
  const start = Date.now();
  const url = new URL(req.url, 'http://_');

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok\n');
  }

  const parsed = parseRequest(url.pathname);
  if (!parsed) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Usage: /<repo>/<branch>/<path>\n');
  }

  const { repo, branch, filePath } = parsed;
  const repoDir = REPOS.get(repo);
  if (!repoDir) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end(`repo not configured: ${repo}\n`);
  }
  if (!safeComponent(repo) || !safeComponent(branch) || filePath.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('unsafe path component\n');
  }

  const cacheKey = `${repo}|${branch}|${filePath}`;
  let content = cacheGet(cacheKey);
  let cached = true;

  if (content === null) {
    cached = false;
    const r = await gitShow(repoDir, branch, filePath);
    if (r.status === 'branch-not-found') {
      log('info', 'branch not found', { repo, branch, durMs: Date.now() - start });
      res.writeHead(410, { 'Content-Type': 'text/plain' });
      return res.end(`branch '${branch}' not found (may have merged; try main URL)\n`);
    }
    if (r.status === 'path-not-found') {
      log('info', 'path not found', { repo, branch, filePath, durMs: Date.now() - start });
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(`path not in branch: ${filePath}\n`);
    }
    content = r.content;
    cacheSet(cacheKey, content);
  }

  const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`,
  });
  res.end(content);
  log('info', 'served', { repo, branch, filePath, bytes: content.length, cached, durMs: Date.now() - start });
});

const fetchTimer = setInterval(refreshAll, FETCH_INTERVAL_MS);
refreshAll();

server.listen(PORT, () => {
  log('info', 'listening', { port: PORT, repos: [...REPOS.keys()], fetchIntervalMs: FETCH_INTERVAL_MS, cacheTtlMs: CACHE_TTL_MS });
});

function shutdown(sig) {
  log('info', 'shutdown initiated', { signal: sig });
  clearInterval(fetchTimer);
  server.close(() => { log('info', 'shutdown complete'); process.exit(0); });
  setTimeout(() => { log('warn', 'forced exit (timeout)'); process.exit(1); }, 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

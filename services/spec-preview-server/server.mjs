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
//   SPEC_PREVIEW_REPOS    "name:abs-path,name:abs-path"  (REQUIRED at start())
//   FETCH_INTERVAL_MS     (default 30000)
//   CACHE_TTL_MS          (default 5000)
//
// Importing this module is side-effect free: listen()/the fetch timer only run
// when the module is the process entrypoint (isMain) or via createApp().start().

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname } from 'node:path';

const execFileAsync = promisify(execFile);

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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function parseRepos(raw) {
  if (!raw) return new Map();
  return new Map(
    raw.split(',').map(entry => {
      const idx = entry.indexOf(':');
      if (idx < 0) throw new Error(`bad SPEC_PREVIEW_REPOS entry: ${entry}`);
      return [entry.slice(0, idx).trim(), entry.slice(idx + 1).trim()];
    })
  );
}

export function loadConfig(env = process.env) {
  return {
    port: parseInt(env.PORT || '8080', 10),
    fetchIntervalMs: parseInt(env.FETCH_INTERVAL_MS || '30000', 10),
    cacheTtlMs: parseInt(env.CACHE_TTL_MS || '5000', 10),
    repos: parseRepos(env.SPEC_PREVIEW_REPOS),
  };
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export function log(level, msg, fields = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }));
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export function safeComponent(s) {
  if (!s || s.length > 200) return false;
  return !/[\x00-\x1f<>|;&$`\\]/.test(s);
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

// ---------------------------------------------------------------------------
// git helpers
// ---------------------------------------------------------------------------

async function gitFetch(name, dir, logFn = log) {
  try {
    await execFileAsync('git', ['-C', dir, 'fetch', '--all', '--prune', '--quiet'], { timeout: 30000 });
  } catch (err) {
    logFn('warn', 'git fetch failed', { repo: name, error: err.message });
  }
}

export async function gitShow(repoDir, branch, filePath) {
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

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
//
// deps = { config, cacheGet, cacheSet, gitShow, ensureRepo, log }

export async function handleRequest(req, res, deps) {
  const { config, cacheGet, cacheSet, gitShow: gitShowFn, ensureRepo, log: logFn = log } = deps;
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
  // ensureRepo resolves a repo name to an on-disk dir (no-op/identity for now;
  // on-demand clone arrives in a later task). Returns null/undefined if unknown.
  const repoDir = await ensureRepo(repo, branch);
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
    const r = await gitShowFn(repoDir, branch, filePath);
    if (r.status === 'branch-not-found') {
      logFn('info', 'branch not found', { repo, branch, durMs: Date.now() - start });
      res.writeHead(410, { 'Content-Type': 'text/plain' });
      return res.end(`branch '${branch}' not found (may have merged; try main URL)\n`);
    }
    if (r.status === 'path-not-found') {
      logFn('info', 'path not found', { repo, branch, filePath, durMs: Date.now() - start });
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(`path not in branch: ${filePath}\n`);
    }
    content = r.content;
    cacheSet(cacheKey, content);
  }

  const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': `private, max-age=${Math.floor(config.cacheTtlMs / 1000)}`,
  });
  res.end(content);
  logFn('info', 'served', { repo, branch, filePath, bytes: content.length, cached, durMs: Date.now() - start });
}

// ---------------------------------------------------------------------------
// Default dependency assembly
// ---------------------------------------------------------------------------

export function buildDefaultDeps(config) {
  const cache = new Map();
  const cacheGet = (k) => {
    const e = cache.get(k);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { cache.delete(k); return null; }
    return e.content;
  };
  const cacheSet = (k, content) => {
    cache.set(k, { content, expiresAt: Date.now() + config.cacheTtlMs });
  };

  // Placeholder ensureRepo: resolve via the static config.repos map only.
  // On-demand cloning is added in a later task.
  const ensureRepo = async (repo) => config.repos.get(repo) || null;

  return { config, cacheGet, cacheSet, gitShow, ensureRepo, log };
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export function createApp(deps) {
  const { config, log: logFn = log } = deps;
  let fetchTimer = null;

  const server = createServer((req, res) => handleRequest(req, res, deps));

  async function refreshAll() {
    await Promise.all([...config.repos].map(([n, d]) => gitFetch(n, d, logFn)));
  }

  function start() {
    if (config.repos.size === 0) {
      logFn('error', 'SPEC_PREVIEW_REPOS env var required');
      logFn('error', 'Example: SPEC_PREVIEW_REPOS="facio-blueprint:/var/lib/specs/facio-blueprint"');
      process.exit(2);
    }
    fetchTimer = setInterval(refreshAll, config.fetchIntervalMs);
    refreshAll();
    server.listen(config.port, () => {
      logFn('info', 'listening', {
        port: config.port,
        repos: [...config.repos.keys()],
        fetchIntervalMs: config.fetchIntervalMs,
        cacheTtlMs: config.cacheTtlMs,
      });
    });
  }

  function stop(sig) {
    if (sig) logFn('info', 'shutdown initiated', { signal: sig });
    if (fetchTimer) { clearInterval(fetchTimer); fetchTimer = null; }
    server.close(() => { logFn('info', 'shutdown complete'); process.exit(0); });
    setTimeout(() => { logFn('warn', 'forced exit (timeout)'); process.exit(1); }, 10000).unref();
  }

  return { server, start, stop };
}

// ---------------------------------------------------------------------------
// Entrypoint guard — import is pure; side-effects only when run directly.
// ---------------------------------------------------------------------------

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = createApp(buildDefaultDeps(loadConfig()));
  app.start();
  process.on('SIGTERM', () => app.stop('SIGTERM'));
  process.on('SIGINT', () => app.stop('SIGINT'));
}

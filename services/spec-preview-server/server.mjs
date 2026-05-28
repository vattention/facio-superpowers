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
import { extname, join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';

import { gitShow as realGitShow } from './git-show.mjs';
import { ensureRepo as realEnsureRepo } from './provision.mjs';
import { createTokenProvider, isValidRepoName } from './github-app.mjs';
import { renderErrorPage } from './error-page.mjs';

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

// NOTE: full env plumbing + validateRuntimeConfig lands in Task 9. Here we read
// minimal shapes for the org-wide on-demand-clone deps (org / cacheDir /
// defaultBranch / GitHub App creds). The integration tests inject their own deps
// so they do not depend on any of these env vars being set.
function loadAppConfig(env) {
  const appId = env.GITHUB_APP_ID;
  const privateKeyPem = env.GITHUB_APP_PRIVATE_KEY;
  const installationId = env.GITHUB_APP_INSTALLATION_ID;
  if (!appId || !privateKeyPem || !installationId) return null;
  return { appId, privateKeyPem, installationId };
}

export function loadConfig(env = process.env) {
  return {
    port: parseInt(env.PORT || '8080', 10),
    fetchIntervalMs: parseInt(env.FETCH_INTERVAL_MS || '30000', 10),
    cacheTtlMs: parseInt(env.CACHE_TTL_MS || '5000', 10),
    repos: parseRepos(env.SPEC_PREVIEW_REPOS),
    // org-wide on-demand clone (Task 8 wiring; Task 9 validates/expands)
    org: env.SPEC_PREVIEW_ORG || 'vattention',
    cacheDir: env.SPEC_PREVIEW_CACHE_DIR || '/var/lib/specs',
    defaultBranch: env.SPEC_PREVIEW_DEFAULT_BRANCH || 'main',
    app: loadAppConfig(env),
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
// git helpers (production dep implementations live in buildDefaultDeps)
// ---------------------------------------------------------------------------

// git(args) → { code, stdout:Buffer }. Resolves on BOTH success and non-zero
// exit (gitShow/resolveDefaultBranch discriminate on the exit code, never throw).
async function realGit(args) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      encoding: 'buffer',
      maxBuffer: 10 * 1024 * 1024,
    });
    return { code: 0, stdout };
  } catch (err) {
    // Non-zero exit (e.g. unknown ref / missing path) is an expected signal, not
    // a crash. Surface the code; never propagate stderr (it may echo a ref/path).
    return { code: typeof err.code === 'number' ? err.code : 1, stdout: Buffer.alloc(0) };
  }
}

// Atomic clone: clone into a temp sibling, then rename into place. A failed or
// partial clone never leaves a half-written `dest/.git` that existsSync() would
// later treat as a valid cached repo.
//
// SECURITY: `url` embeds the installation token (x-access-token:<token>@...).
// NEVER log `url` or the underlying git error — both can echo the token.
async function realGitClone(url, dest) {
  const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
  try {
    await execFileAsync('git', ['clone', '--quiet', url, tmp], {
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    await rm(tmp, { recursive: true, force: true });
    // Rethrow a sanitized error — drop message/cause so the token-bearing URL
    // never reaches a caller's log. ensureRepo maps this to NOT_IN_SCOPE.
    throw new Error('clone failed');
  }
  try {
    await rename(tmp, dest);
  } catch (err) {
    await rm(tmp, { recursive: true, force: true });
    throw new Error('clone finalize failed');
  }
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
//
// deps = { config, cacheGet, cacheSet, git, gitShow, ensureRepo, log }

function sendErrorPage(res, kind, ctx) {
  const { status, contentType, body } = renderErrorPage(kind, ctx);
  res.writeHead(status, { 'Content-Type': contentType });
  return res.end(body);
}

export async function handleRequest(req, res, deps) {
  const { config, cacheGet, cacheSet, git, gitShow: gitShowFn, ensureRepo, log: logFn = log } = deps;
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

  // SECURITY: validate repo + branch + path BEFORE touching ensureRepo, so an
  // unsafe repo name can never reach the clone URL / on-disk path. (Ordering
  // fix carried from the Task 1 review.) isValidRepoName is the stricter gate
  // for the repo name (it becomes part of the clone URL + cache dir).
  if (!isValidRepoName(repo) || !safeComponent(repo) || !safeComponent(branch) || filePath.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('unsafe path component\n');
  }

  // Resolve repo → on-disk dir (on-demand clone). Map provision error codes to
  // friendly pages; ANY unexpected error → 503 (never 500/crash — M2).
  let repoDir;
  try {
    repoDir = await ensureRepo(repo, branch);
  } catch (err) {
    if (err && (err.code === 'INVALID_NAME' || err.code === 'NOT_IN_SCOPE')) {
      logFn('info', 'repo not in scope', { repo, code: err.code, durMs: Date.now() - start });
      return sendErrorPage(res, 'not-in-scope', { repo });
    }
    // TOKEN_FAILED and anything else unexpected → transient 503 (no token/url logged).
    logFn('warn', 'ensureRepo failed', { repo, code: err && err.code, durMs: Date.now() - start });
    return sendErrorPage(res, 'service-unavailable', {});
  }
  if (!repoDir) {
    // Defensive: a dep that resolves falsy means "not resolvable" → not-in-scope.
    return sendErrorPage(res, 'not-in-scope', { repo });
  }

  const cacheKey = `${repo}|${branch}|${filePath}`;
  const cachedContent = cacheGet(cacheKey);
  if (cachedContent !== null) {
    const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': `private, max-age=${Math.floor(config.cacheTtlMs / 1000)}`,
    });
    res.end(cachedContent);
    logFn('info', 'served', { repo, branch, filePath, bytes: cachedContent.length, cached: true, durMs: Date.now() - start });
    return;
  }

  let r;
  try {
    r = await gitShowFn({ repoDir, branch, filePath, git, defaultFallback: config.defaultBranch });
  } catch (err) {
    // git plumbing blew up unexpectedly → transient 503, never a 500/crash.
    logFn('warn', 'gitShow failed', { repo, branch, filePath, durMs: Date.now() - start });
    return sendErrorPage(res, 'service-unavailable', {});
  }

  if (r.status === 'gone-unmerged') {
    logFn('info', 'gone unmerged', { repo, branch, durMs: Date.now() - start });
    // DO NOT cache: branch may reappear / be re-pushed.
    return sendErrorPage(res, 'gone-unmerged', { repo, branch });
  }
  if (r.status === 'path-not-found') {
    logFn('info', 'path not found', { repo, branch, filePath, durMs: Date.now() - start });
    // DO NOT cache: a transient miss must not pin a 404.
    return sendErrorPage(res, 'path-not-found', { filePath });
  }

  // r.status === 'ok' — cache ONLY successful responses.
  const content = r.content;
  cacheSet(cacheKey, content);
  const mime = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': `private, max-age=${Math.floor(config.cacheTtlMs / 1000)}`,
  });
  res.end(content);
  logFn('info', 'served', { repo, branch, filePath, servedFrom: r.servedFrom, bytes: content.length, cached: false, durMs: Date.now() - start });
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

  const git = realGit;
  const gitClone = realGitClone;

  // GitHub App token provider — only wired when App creds are configured.
  // Without it, getToken() rejects → ensureRepo maps to TOKEN_FAILED → 503
  // (never a crash). Full env validation lands in Task 9.
  let getToken;
  if (config.app) {
    const provider = createTokenProvider({
      appId: config.app.appId,
      privateKeyPem: config.app.privateKeyPem,
      installationId: config.app.installationId,
    });
    getToken = () => provider.getToken();
  } else {
    getToken = async () => { throw new Error('GitHub App credentials not configured'); };
  }

  // Real on-demand clone: org-wide, validated, atomic.
  const ensureRepo = (repo) => realEnsureRepo(repo, {
    cacheDir: config.cacheDir,
    org: config.org,
    getToken,
    gitClone,
    isValidRepoName,
  });

  return { config, cacheGet, cacheSet, git, gitClone, getToken, gitShow: realGitShow, ensureRepo, log };
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

// Enumerate fully-cloned repos in the cache dir (a present `.git` ⇒ the atomic
// rename completed). In-flight clones live in `.tmp-*` siblings with no `.git`
// at the canonical path, so this rule naturally skips them — no extra
// coordination with provision.mjs needed.
function listClonedRepos(cacheDir) {
  let entries;
  try {
    entries = readdirSync(cacheDir, { withFileTypes: true });
  } catch {
    return []; // cache dir not created yet → nothing to fetch
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.includes('.tmp-'))
    .map((e) => join(cacheDir, e.name))
    .filter((dir) => existsSync(join(dir, '.git')));
}

async function gitFetch(dir, logFn = log) {
  try {
    await execFileAsync('git', ['-C', dir, 'fetch', '--all', '--prune', '--quiet'], { timeout: 30000 });
  } catch {
    // Never log the error (could echo a token-bearing remote URL). The dir alone
    // is safe to surface.
    logFn('warn', 'git fetch failed', { dir });
  }
}

export function createApp(deps) {
  const { config, log: logFn = log } = deps;
  let fetchTimer = null;

  const server = createServer((req, res) => handleRequest(req, res, deps));

  // Refresh the DYNAMIC set of cloned repos (not the old static map): fetch every
  // fully-cloned dir under config.cacheDir, pruning deleted branches so merged/
  // closed branch URLs fall back to default / 410 as appropriate.
  async function refreshAll() {
    const dirs = listClonedRepos(config.cacheDir);
    await Promise.all(dirs.map((dir) => gitFetch(dir, logFn)));
  }

  function start() {
    fetchTimer = setInterval(refreshAll, config.fetchIntervalMs);
    refreshAll();
    server.listen(config.port, () => {
      logFn('info', 'listening', {
        port: config.port,
        org: config.org,
        cacheDir: config.cacheDir,
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

#!/usr/bin/env node
// spec-preview-server.mjs · v2.7.0 production
//
// Internal HTTP service serving files from configured git repos by running
// `git show origin/<branch>:<path>` per request. Intended exposure: behind
// Cloudflare Tunnel + Cloudflare Access (飞书 SSO).
//
// Routes:
//   GET /<repo>/<branch>/<path...>  → file content (Content-Type by ext)
//   GET /healthz                    → "ok"
//
// Env config (read by loadConfig; see also validateRuntimeConfig):
//   GITHUB_ORG                   org whose repos are served on demand (default "vattention")
//   GITHUB_APP_ID                GitHub App id                       (REQUIRED at start())
//   GITHUB_APP_INSTALLATION_ID   App installation id                 (REQUIRED at start())
//   GITHUB_APP_PRIVATE_KEY       App private key (inline PEM)         (REQUIRED at start(),
//   GITHUB_APP_PRIVATE_KEY_PATH    OR a path to the PEM file          unless _KEY is set)
//   GITHUB_DEFAULT_BRANCH        fallback branch for durable links   (default "main")
//   CACHE_DIR                    on-disk clone cache root            (default "/var/lib/specs")
//   PORT                         (default 8080)
//   FETCH_INTERVAL_MS            (default 30000)
//   CACHE_TTL_MS                 (default 5000)
//   SPEC_PREVIEW_REPOS           OPTIONAL pre-seed hint "name:path,name" — purely a warm-cache
//                                hint; repos are cloned ON DEMAND regardless. Absent → none.
//
// Legacy aliases (still honoured as fallbacks): SPEC_PREVIEW_ORG,
// SPEC_PREVIEW_CACHE_DIR, SPEC_PREVIEW_DEFAULT_BRANCH.
//
// Importing this module is side-effect free: loadConfig NEVER throws, and
// listen()/the fetch timer only run when the module is the process entrypoint
// (isMain) or via createApp().start(). validateRuntimeConfig (fail-fast on
// missing App creds) runs inside start(), NOT at import time.

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname, join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';

import { gitShow as realGitShow, resolveDefaultBranch as realResolveDefaultBranch } from './git-show.mjs';
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

// SPEC_PREVIEW_REPOS is now an OPTIONAL pre-seed hint (warm-cache), NOT a gate:
// repos are cloned on demand regardless. Parse "name:path,name" into a list of
// { name, path|null }. Entries with no ':' are bare names (path → null). This
// parser is intentionally LENIENT — it NEVER throws (keeps loadConfig pure):
// absent/empty/blank-only input → []. Blank segments are dropped.
function parsePreSeed(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf(':');
      if (idx < 0) return { name: entry, path: null };
      return { name: entry.slice(0, idx).trim(), path: entry.slice(idx + 1).trim() || null };
    });
}

// Read the GitHub App PEM either inline (GITHUB_APP_PRIVATE_KEY) or from a file
// (GITHUB_APP_PRIVATE_KEY_PATH). Reading the path is best-effort: an unreadable
// path leaves privateKeyPem undefined so validateRuntimeConfig surfaces the
// "missing creds" failure at start() — it MUST NOT crash module import.
function loadPrivateKeyPem(env) {
  if (env.GITHUB_APP_PRIVATE_KEY) return env.GITHUB_APP_PRIVATE_KEY;
  if (env.GITHUB_APP_PRIVATE_KEY_PATH) {
    try {
      return readFileSync(env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8');
    } catch {
      // Never log the path/error here; validateRuntimeConfig will report the
      // missing-credential condition cleanly at boot.
      return undefined;
    }
  }
  return undefined;
}

// Assemble config.app in the shape buildDefaultDeps / createTokenProvider expect:
// { appId, installationId, privateKeyPem }. Returns null when ALL three are
// absent (the common "creds not configured" case) so validateRuntimeConfig can
// detect it; returns a partial object when SOME but not all are present so the
// error message can be precise about what's missing.
function loadAppConfig(env) {
  const appId = env.GITHUB_APP_ID;
  const installationId = env.GITHUB_APP_INSTALLATION_ID;
  const privateKeyPem = loadPrivateKeyPem(env);
  if (!appId && !installationId && !privateKeyPem) return null;
  return { appId, installationId, privateKeyPem };
}

// PURE: never throws, never exits, no I/O beyond an optional best-effort PEM
// file read (which swallows its own errors). Safe to call at import / in tests.
export function loadConfig(env = process.env) {
  return {
    port: parseInt(env.PORT || '8080', 10),
    fetchIntervalMs: parseInt(env.FETCH_INTERVAL_MS || '30000', 10),
    cacheTtlMs: parseInt(env.CACHE_TTL_MS || '5000', 10),
    // org-wide on-demand clone target + cache layout
    org: env.GITHUB_ORG || env.SPEC_PREVIEW_ORG || 'vattention',
    cacheDir: env.CACHE_DIR || env.SPEC_PREVIEW_CACHE_DIR || '/var/lib/specs',
    defaultBranch: env.GITHUB_DEFAULT_BRANCH || env.SPEC_PREVIEW_DEFAULT_BRANCH || 'main',
    app: loadAppConfig(env),
    // OPTIONAL pre-seed/warm-cache hint — absent → []; never a gate.
    preSeed: parsePreSeed(env.SPEC_PREVIEW_REPOS),
  };
}

// Fail-fast boot guard. Called from start() (NOT at import) so the service never
// boots into a state where the GitHub App token provider always rejects and every
// request 503s silently. Throws an Error mentioning GITHUB_APP listing the missing
// field(s); returns undefined on success. NEVER logs/echoes the private key.
export function validateRuntimeConfig(config) {
  const app = config.app || {};
  const missing = [];
  if (!app.appId) missing.push('GITHUB_APP_ID');
  if (!app.installationId) missing.push('GITHUB_APP_INSTALLATION_ID');
  if (!app.privateKeyPem) missing.push('GITHUB_APP_PRIVATE_KEY (or GITHUB_APP_PRIVATE_KEY_PATH)');
  if (missing.length > 0) {
    throw new Error(
      `GitHub App credentials missing/incomplete — set: ${missing.join(', ')}. ` +
      'The service requires a GitHub App to clone org repos on demand.'
    );
  }
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

// git(args) → { code, stdout:Buffer }. Resolves on BOTH success and a non-zero
// git EXIT (gitShow/resolveDefaultBranch discriminate on the exit code, never
// throw). A SPAWN failure (binary missing/unexecutable) is NOT a git exit — it
// must propagate so the handler can surface a 503 instead of masquerading as a
// "ref absent" 410 (which would silently hide a broken deploy).
async function realGit(args) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      encoding: 'buffer',
      maxBuffer: 10 * 1024 * 1024,
    });
    return { code: 0, stdout };
  } catch (err) {
    // A real non-zero git exit carries a NUMERIC err.code (e.g. 1 unknown ref,
    // 128 bad object). That is an expected signal — surface it; never propagate
    // stderr (it may echo a ref/path).
    if (typeof err.code === 'number') {
      return { code: err.code, stdout: Buffer.alloc(0) };
    }
    // Otherwise this is a SPAWN failure: err.code is a string ('ENOENT' git not
    // found, 'EACCES' not executable) or absent. Rethrow so handleRequest maps
    // it to a transient 503 rather than a friendly-but-wrong 410.
    throw err;
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
    repoDir = await ensureRepo(repo);
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

  // Memoize the resolved default branch per repoDir. Durable post-merge links
  // (branch gone → served from default) are the steady-state common case, so
  // without this each such request re-spawns `git symbolic-ref`. The default
  // branch of a repo is effectively immutable for the process lifetime, so a
  // per-repoDir cache is safe. A clone-cache prune (deleting a repoDir) is a
  // restart-class event, so we don't bother invalidating on disk changes.
  const defaultBranchMemo = new Map(); // repoDir → resolved default branch name
  const memoizedResolveDefault = async ({ repoDir, git: g, fallback }) => {
    if (defaultBranchMemo.has(repoDir)) return defaultBranchMemo.get(repoDir);
    const def = await realResolveDefaultBranch({ repoDir, git: g, fallback });
    defaultBranchMemo.set(repoDir, def);
    return def;
  };
  const gitShow = (params) => realGitShow({ ...params, resolveDefault: memoizedResolveDefault });

  return { config, cacheGet, cacheSet, git, gitClone, getToken, gitShow, ensureRepo, log };
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
    // Fail-fast at boot: if the GitHub App creds are missing/incomplete, throw
    // here rather than booting into a state where every request 503s silently.
    validateRuntimeConfig(config);
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

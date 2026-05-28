// server.integration.test.mjs — wires the REAL deps (provision.ensureRepo,
// git-show.gitShow, error-page.renderErrorPage) into handleRequest and drives
// requests against a REAL local bare-git-repo fixture (no network, no token).
//
// gitClone is injected to "clone" from a local bare fixture via `git clone
// --local`, ignoring the token-bearing HTTPS URL the real ensureRepo passes it.
// This exercises the full handler flow end-to-end against actual git plumbing.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { handleRequest, buildDefaultDeps, loadConfig } from './server.mjs';
import { ensureRepo } from './provision.mjs';
import { gitShow as realGitShow } from './git-show.mjs';
import { isValidRepoName } from './github-app.mjs';

// --- tiny mock req/res ------------------------------------------------------
function mockReq(url) {
  return { url, method: 'GET' };
}
function mockRes() {
  const res = {
    statusCode: null,
    headers: null,
    chunks: [],
    ended: false,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers || {}; return this; },
    end(chunk) { if (chunk !== undefined) this.chunks.push(chunk); this.ended = true; return this; },
    get body() {
      return this.chunks
        .map((c) => (Buffer.isBuffer(c) ? c.toString('utf8') : String(c)))
        .join('');
    },
    get bodyBuffer() {
      return Buffer.concat(this.chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(String(c)))));
    },
  };
  return res;
}

const G = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });

// --- fixtures ---------------------------------------------------------------
let root;          // tmp root for the whole suite
let originDir;     // bare origin repo for "facio-blueprint"
let cacheDir;      // clone cache dir handed to ensureRepo

// Build a fixture origin with `main` (has docs/spec.html) and `feat/x`
// (has docs/spec.html + a branch-only docs/onlyfeat.html).
before(() => {
  root = mkdtempSync(join(tmpdir(), 'preview-int-'));
  cacheDir = join(root, 'cache');
  mkdirSync(cacheDir, { recursive: true });

  originDir = join(root, 'origin-facio-blueprint.git');
  G(root, 'init', '--bare', '-b', 'main', originDir);

  // working clone to push branches from
  const work = join(root, 'work');
  G(root, 'clone', '--quiet', originDir, work);
  G(work, 'config', 'user.email', 'test@example.com');
  G(work, 'config', 'user.name', 'Test');

  mkdirSync(join(work, 'docs'), { recursive: true });
  writeFileSync(join(work, 'docs', 'spec.html'), '<h1>MAIN spec</h1>');
  G(work, 'add', '.');
  G(work, 'commit', '-q', '-m', 'main: spec');
  G(work, 'push', '-q', 'origin', 'main');

  // feat/x: spec.html overwritten + a branch-only file
  G(work, 'checkout', '-q', '-b', 'feat/x');
  writeFileSync(join(work, 'docs', 'spec.html'), '<h1>FEAT branch spec</h1>');
  writeFileSync(join(work, 'docs', 'onlyfeat.html'), '<h1>only on feat</h1>');
  G(work, 'add', '.');
  G(work, 'commit', '-q', '-m', 'feat: spec + onlyfeat');
  G(work, 'push', '-q', 'origin', 'feat/x');
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

// gitClone that clones from the local bare fixture (by repo name), ignoring the
// token-bearing HTTPS url. Atomic temp-sibling + rename, mirroring prod gitClone.
function localGitClone(fixtureByRepo) {
  return async (_url, dest) => {
    // recover repo name from dest's basename
    const name = dest.split('/').pop();
    const src = fixtureByRepo[name];
    if (!src) throw new Error('unknown fixture');
    const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
    try {
      execFileSync('git', ['clone', '--quiet', '--local', src, tmp], { stdio: 'pipe' });
    } catch (err) {
      rmSync(tmp, { recursive: true, force: true });
      throw err;
    }
    execFileSync('mv', [tmp, dest]);
  };
}

// Build the deps using the REAL ensureRepo / gitShow, an injected gitClone and
// getToken, and an in-memory cache. config minimal — Task 9 formalizes env.
function buildIntegrationDeps({ getToken, gitClone, cacheTtlMs = 5000 } = {}) {
  const config = {
    ...loadConfig({}),
    cacheTtlMs,
    org: 'vattention',
    cacheDir,
    defaultBranch: 'main',
  };
  const base = buildDefaultDeps(config);
  const fixtureByRepo = { 'facio-blueprint': originDir };
  const ensure = (repo) => ensureRepo(repo, {
    cacheDir,
    org: config.org,
    getToken: getToken || (async () => 'fake-token'),
    gitClone: gitClone || localGitClone(fixtureByRepo),
    isValidRepoName,
  });
  return { ...base, config, gitShow: realGitShow, ensureRepo: ensure };
}

// --- scenarios --------------------------------------------------------------

test('integration: branch present → 200 branch content', async () => {
  const deps = buildIntegrationDeps();
  const res = mockRes();
  await handleRequest(mockReq('/facio-blueprint/feat/x/docs/spec.html'), res, deps);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Type'], /text\/html/);
  assert.match(res.body, /FEAT branch spec/);
});

test('integration: delete feat/x on origin + re-fetch → 200 merged (default) content', async () => {
  // AC-2: branch merged & deleted → fall back to default branch copy.
  // fresh cache & cache dir clone (unique repo name to avoid cross-test reuse)
  const localOrigin = join(root, 'origin-merged.git');
  const work = join(root, 'work-merged');
  G(root, 'init', '--bare', '-b', 'main', localOrigin);
  G(root, 'clone', '--quiet', localOrigin, work);
  G(work, 'config', 'user.email', 'test@example.com');
  G(work, 'config', 'user.name', 'Test');
  mkdirSync(join(work, 'docs'), { recursive: true });
  writeFileSync(join(work, 'docs', 'spec.html'), '<h1>MERGED into main</h1>');
  G(work, 'add', '.'); G(work, 'commit', '-q', '-m', 'main'); G(work, 'push', '-q', 'origin', 'main');
  G(work, 'checkout', '-q', '-b', 'feat/x');
  writeFileSync(join(work, 'docs', 'spec.html'), '<h1>FEAT spec</h1>');
  G(work, 'add', '.'); G(work, 'commit', '-q', '-m', 'feat'); G(work, 'push', '-q', 'origin', 'feat/x');

  const fixtureByRepo = { 'repo-merged': localOrigin };
  const deps = (() => {
    // TTL 0 so the post-merge request genuinely re-runs gitShow (a cached ok would
    // mask a broken default-branch fallback). A 200 here therefore PROVES fallback.
    const config = { ...loadConfig({}), org: 'vattention', cacheDir, defaultBranch: 'main', cacheTtlMs: 0 };
    const base = buildDefaultDeps(config);
    const ensure = (repo) => ensureRepo(repo, {
      cacheDir, org: config.org, getToken: async () => 't',
      gitClone: localGitClone(fixtureByRepo), isValidRepoName,
    });
    return { ...base, config, gitShow: realGitShow, ensureRepo: ensure };
  })();

  // first request: feat/x present → branch content
  const r1 = mockRes();
  await handleRequest(mockReq('/repo-merged/feat/x/docs/spec.html'), r1, deps);
  assert.equal(r1.statusCode, 200);
  assert.match(r1.body, /FEAT spec/);

  // merge feat/x into main and delete feat/x on origin
  G(work, 'checkout', '-q', 'main');
  G(work, 'merge', '-q', '--no-ff', 'feat/x', '-m', 'merge feat/x');
  G(work, 'push', '-q', 'origin', 'main');
  G(work, 'push', '-q', 'origin', '--delete', 'feat/x');

  // re-fetch the cached clone so it learns the branch is gone
  const cloneDir = join(cacheDir, 'repo-merged');
  G(cloneDir, 'fetch', '--all', '--prune', '--quiet');

  const r2 = mockRes();
  await handleRequest(mockReq('/repo-merged/feat/x/docs/spec.html'), r2, deps);
  assert.equal(r2.statusCode, 200);
  assert.match(r2.body, /FEAT spec/);  // content was merged verbatim into main
});

test('integration: spec only on feat/x, deleted, not on main → 410 gone-unmerged page', async () => {
  // AC-6: closed-unmerged. onlyfeat.html lives only on feat/x; never on main.
  const localOrigin = join(root, 'origin-unmerged.git');
  const work = join(root, 'work-unmerged');
  G(root, 'init', '--bare', '-b', 'main', localOrigin);
  G(root, 'clone', '--quiet', localOrigin, work);
  G(work, 'config', 'user.email', 'test@example.com');
  G(work, 'config', 'user.name', 'Test');
  mkdirSync(join(work, 'docs'), { recursive: true });
  writeFileSync(join(work, 'docs', 'other.html'), '<h1>main other</h1>');
  G(work, 'add', '.'); G(work, 'commit', '-q', '-m', 'main'); G(work, 'push', '-q', 'origin', 'main');
  G(work, 'checkout', '-q', '-b', 'feat/x');
  writeFileSync(join(work, 'docs', 'onlyfeat.html'), '<h1>only on feat</h1>');
  G(work, 'add', '.'); G(work, 'commit', '-q', '-m', 'feat'); G(work, 'push', '-q', 'origin', 'feat/x');

  const fixtureByRepo = { 'repo-unmerged': localOrigin };
  // TTL 0 so the post-delete request re-runs gitShow instead of serving a stale
  // cached ok. (The cache-only-ok contract is exercised by a dedicated test.)
  const config = { ...loadConfig({}), org: 'vattention', cacheDir, defaultBranch: 'main', cacheTtlMs: 0 };
  const base = buildDefaultDeps(config);
  const ensure = (repo) => ensureRepo(repo, {
    cacheDir, org: config.org, getToken: async () => 't',
    gitClone: localGitClone(fixtureByRepo), isValidRepoName,
  });
  const deps = { ...base, config, gitShow: realGitShow, ensureRepo: ensure };

  // clone first while feat/x present (request onlyfeat → 200)
  const r1 = mockRes();
  await handleRequest(mockReq('/repo-unmerged/feat/x/docs/onlyfeat.html'), r1, deps);
  assert.equal(r1.statusCode, 200);

  // close (delete) feat/x WITHOUT merging
  G(work, 'push', '-q', 'origin', '--delete', 'feat/x');
  const cloneDir = join(cacheDir, 'repo-unmerged');
  G(cloneDir, 'fetch', '--all', '--prune', '--quiet');

  const r2 = mockRes();
  await handleRequest(mockReq('/repo-unmerged/feat/x/docs/onlyfeat.html'), r2, deps);
  assert.equal(r2.statusCode, 410);
  assert.match(res2Type(r2), /text\/html/);
  assert.match(r2.body, /链接已失效|不存在/);  // gone-unmerged friendly page
});
function res2Type(r) { return r.headers['Content-Type'] || r.headers['content-type'] || ''; }

test('integration: unknown repo (gitClone throws) → 404 not-in-scope page', async () => {
  // AC-4: repo not in org / app not installed → clone throws → NOT_IN_SCOPE → 404.
  const fixtureByRepo = {}; // no fixture → localGitClone throws "unknown fixture"
  const config = { ...loadConfig({}), org: 'vattention', cacheDir, defaultBranch: 'main' };
  const base = buildDefaultDeps(config);
  const ensure = (repo) => ensureRepo(repo, {
    cacheDir, org: config.org, getToken: async () => 't',
    gitClone: localGitClone(fixtureByRepo), isValidRepoName,
  });
  const deps = { ...base, config, gitShow: realGitShow, ensureRepo: ensure };

  const res = mockRes();
  await handleRequest(mockReq('/ghost-repo/main/docs/spec.html'), res, deps);
  assert.equal(res.statusCode, 404);
  assert.match(res.headers['Content-Type'], /text\/html/);
  assert.match(res.body, /不在可预览范围|无法预览/);
});

test('integration: getToken throws → 503 service-unavailable page (no crash)', async () => {
  // M2: token mint failure must NOT 500/crash — friendly 503.
  const config = { ...loadConfig({}), org: 'vattention', cacheDir, defaultBranch: 'main' };
  const base = buildDefaultDeps(config);
  const ensure = (repo) => ensureRepo(repo, {
    cacheDir, org: config.org,
    getToken: async () => { throw new Error('401 bad creds'); },
    gitClone: async () => { throw new Error('should not reach clone'); },
    isValidRepoName,
  });
  const deps = { ...base, config, gitShow: realGitShow, ensureRepo: ensure };

  const res = mockRes();
  await handleRequest(mockReq('/needs-token/main/docs/spec.html'), res, deps);
  assert.equal(res.statusCode, 503);
  assert.match(res.headers['Content-Type'], /text\/html/);
  assert.match(res.body, /服务暂时|不可用/);
});

test('integration: /healthz still plain ok', async () => {
  const deps = buildIntegrationDeps();
  const res = mockRes();
  await handleRequest(mockReq('/healthz'), res, deps);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Type'], /text\/plain/);
  assert.equal(res.body, 'ok\n');
});

test('integration: path not found on present branch → 404 path-not-found page (not cached)', async () => {
  const deps = buildIntegrationDeps();
  const res = mockRes();
  await handleRequest(mockReq('/facio-blueprint/feat/x/docs/nope.html'), res, deps);
  assert.equal(res.statusCode, 404);
  assert.match(res.headers['Content-Type'], /text\/html/);
  assert.match(res.body, /文件未找到/);
});

test('integration: unsafe repo name rejected BEFORE clone (validate-before-ensureRepo)', async () => {
  // Security: an unsafe repo name must never reach gitClone / the clone URL.
  let cloneCalled = false;
  const config = { ...loadConfig({}), org: 'vattention', cacheDir, defaultBranch: 'main' };
  const base = buildDefaultDeps(config);
  const ensure = (repo) => ensureRepo(repo, {
    cacheDir, org: config.org, getToken: async () => 't',
    gitClone: async () => { cloneCalled = true; throw new Error('should not clone'); },
    isValidRepoName,
  });
  const deps = { ...base, config, gitShow: realGitShow, ensureRepo: ensure };

  // ".." in repo position is blocked by parseRequest/validation; use a shell-metachar repo
  const res = mockRes();
  await handleRequest(mockReq('/bad;rm/main/docs/spec.html'), res, deps);
  assert.notEqual(res.statusCode, 200);
  assert.equal(cloneCalled, false, 'gitClone must not be reached for an unsafe repo name');
});

test('integration: filePath containing .. rejected before serving', async () => {
  const deps = buildIntegrationDeps();
  const res = mockRes();
  await handleRequest(mockReq('/facio-blueprint/main/docs/../../../etc/passwd'), res, deps);
  assert.notEqual(res.statusCode, 200);
});

// --- cache-only-ok contract -------------------------------------------------
test('integration: ok response is cached; 404/410 are NOT cached', async () => {
  // Spy on gitShow to count invocations per cache key while keeping real logic.
  const calls = [];
  const wrapped = async (args) => { calls.push(args.filePath); return realGitShow(args); };

  const config = { ...loadConfig({}), org: 'vattention', cacheDir, defaultBranch: 'main', cacheTtlMs: 60000 };
  const base = buildDefaultDeps(config);
  const fixtureByRepo = { 'facio-blueprint': originDir };
  const ensure = (repo) => ensureRepo(repo, {
    cacheDir, org: config.org, getToken: async () => 't',
    gitClone: localGitClone(fixtureByRepo), isValidRepoName,
  });
  const deps = { ...base, config, gitShow: wrapped, ensureRepo: ensure };

  // ok path: 2 requests → gitShow runs ONCE (second served from cache)
  await handleRequest(mockReq('/facio-blueprint/feat/x/docs/spec.html'), mockRes(), deps);
  await handleRequest(mockReq('/facio-blueprint/feat/x/docs/spec.html'), mockRes(), deps);
  const okCalls = calls.filter((p) => p === 'docs/spec.html').length;
  assert.equal(okCalls, 1, 'ok response must be cached (gitShow runs once across 2 requests)');

  // 404 path: 2 requests → gitShow runs TWICE (never cached)
  await handleRequest(mockReq('/facio-blueprint/feat/x/docs/missing.html'), mockRes(), deps);
  await handleRequest(mockReq('/facio-blueprint/feat/x/docs/missing.html'), mockRes(), deps);
  const missCalls = calls.filter((p) => p === 'docs/missing.html').length;
  assert.equal(missCalls, 2, '404 must NOT be cached (gitShow re-runs each request)');
});

// --- Task 8 critical correctness: atomic clone leaves nothing on failure -----
test('integration: failed clone leaves NO dest dir behind; retry succeeds', async () => {
  // Use the REAL buildDefaultDeps gitClone (atomic temp+rename) directly.
  const config = { ...loadConfig({}), org: 'vattention', cacheDir: join(root, 'cache2'), defaultBranch: 'main' };
  mkdirSync(config.cacheDir, { recursive: true });
  const { gitClone } = buildDefaultDeps(config); // real atomic clone via execFile('git', ['clone', ...])

  const dest = join(config.cacheDir, 'retry-repo');
  // 1) failing clone: bogus url → git clone fails → atomic clone must clean up
  await assert.rejects(() => gitClone('file:///nonexistent/definitely-not-a-repo.git', dest));
  assert.equal(existsSync(dest), false, 'failed clone must leave NO dest dir');
  // no leftover temp siblings either
  const leftovers = readdirSync(config.cacheDir).filter((f) => f.startsWith('retry-repo.tmp-'));
  assert.deepEqual(leftovers, [], 'no leftover .tmp-* siblings');

  // 2) retry with a valid local source → succeeds
  await gitClone(originDir, dest); // url ignored-ish: real gitClone clones from given url; use a real local path
  assert.equal(existsSync(join(dest, '.git')), true, 'retry clone must succeed and produce a .git');
});

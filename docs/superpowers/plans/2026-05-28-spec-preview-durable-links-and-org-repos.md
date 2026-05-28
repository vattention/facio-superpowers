# Spec-Preview Durable Links + Org-wide Zero-config Repos — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make spec-preview links durable after branch deletion (fall back to the default branch) and previewable for any `vattention` org repo with zero per-repo onboarding (GitHub App + on-demand clone).

**Architecture:** Both fixes are server-side in `services/spec-preview-server/`. (1) A new `github-app.mjs` mints short-lived installation tokens (RS256 JWT via `node:crypto`, zero npm deps) used to clone any org repo on first request. (2) `gitShow` gains a default-branch fallback so a URL whose feature branch was deleted resolves to the merged content. The request handler is refactored out of module-load so it is unit-testable; human-facing error states render friendly HTML.

**Tech Stack:** Node ≥18 (built-in `http`, `crypto`, `https`/`fetch`, `child_process`), `node:test`, git CLI. No new npm dependencies.

**Source spec:** `docs/superpowers/specs/2026-05-28-spec-preview-durable-links-and-org-repos.md` (ratified).

**Reference — current code:**
- `services/spec-preview-server/server.mjs` — single-file server; `gitShow` at :81-97, `parseRequest` :99-112, handler :114-168, `refreshAll`/static `REPOS` :35-79.
- `services/spec-preview-server/server.test.mjs` — `node:test`; notes server listens at import (force-exit workaround).
- `services/spec-preview-server/deploy/install.sh` — per-repo deploy-key clone + writes `SPEC_PREVIEW_REPOS`.
- `services/spec-preview-server/systemd/spec-preview-server.service` — `EnvironmentFile=-/etc/spec-preview-server.env`, `ReadWritePaths=/var/lib/specs`.
- `services/spec-preview-server/README.md` — deploy/ops docs.
- `skills/spec-ratifier/SKILL.md` — Step 3.5A preview URL + failure-mode table (:303-311).

**Run tests with:** `npm run test:server` (= `node --test services/spec-preview-server/*.test.mjs`).

**Conventions:** DRY, YAGNI, TDD (test first, watch it fail, minimal impl, watch it pass, commit). Frequent small commits. Never log the installation token or the cloneUrl-with-token.

---

## Task 1: Refactor server.mjs for testability (export handler factory, guard listen)

**Why first:** new logic (provisioning, fallback, error pages) must be unit-testable without binding a port or running the background fetch. The existing test file already flags this as the needed fix.

**Files:**
- Modify: `services/spec-preview-server/server.mjs`
- Modify: `services/spec-preview-server/server.test.mjs`

**Step 1: Write the failing test** — importing server.mjs must NOT start listening.

Add to `server.test.mjs`:
```js
test('module import does not bind a port (createApp factory exported)', async () => {
  const mod = await import('./server.mjs');
  assert.equal(typeof mod.createApp, 'function');
  assert.equal(typeof mod.handleRequest, 'function');
});
```

**Step 2: Run to verify it fails** — `npm run test:server` → FAIL (`createApp` undefined).

**Step 3: Minimal refactor**
- Wrap config-from-env reads in a `loadConfig(env = process.env)` function returning a plain object `{ port, fetchIntervalMs, cacheTtlMs, repos, ... }`.
- Move the request handler body into `export async function handleRequest(req, res, deps)` where `deps = { config, cacheGet, cacheSet, gitShow, ensureRepo, log }`.
- Add `export function createApp(deps)` returning `{ server, start, stop }` (creates `http.createServer`, owns the fetch timer; `start()` calls `listen`, `stop()` clears timer + closes).
- Guard the listen/side-effects behind a main check so import is pure:
```js
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = createApp(buildDefaultDeps(loadConfig()));
  app.start();
  process.on('SIGTERM', () => app.stop('SIGTERM'));
  process.on('SIGINT', () => app.stop('SIGINT'));
}
```
- Keep `parseRequest`, `safeComponent` exported (existing tests rely on them).
- Remove the `SPEC_PREVIEW_REPOS` required-at-import `process.exit(2)`; move that validation into `loadConfig`/`start` (so import is safe). Pre-seed repos become optional (Task 9).

**Step 4: Run tests** — `npm run test:server` → all PASS (existing 9 + new). The `after()` force-exit workaround in the test can stay or be dropped once import no longer binds.

**Step 5: Commit**
```bash
git add services/spec-preview-server/server.mjs services/spec-preview-server/server.test.mjs
git commit -m "refactor(preview-server): extract handleRequest/createApp factory; pure import"
```

---

## Task 2: GitHub App JWT builder (RS256 via node:crypto)

**Files:**
- Create: `services/spec-preview-server/github-app.mjs`
- Create: `services/spec-preview-server/github-app.test.mjs`

**Step 1: Write the failing test**
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey, createVerify } from 'node:crypto';
import { buildAppJwt } from './github-app.mjs';

test('buildAppJwt: claims + verifiable RS256 signature', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' });
  const now = 1_700_000_000;
  const jwt = buildAppJwt({ appId: '123456', privateKeyPem: pem, now });
  const [h, p, sig] = jwt.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url'));
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  assert.equal(header.alg, 'RS256');
  assert.equal(payload.iss, '123456');
  assert.equal(payload.iat, now - 60);      // clock-skew backdate
  assert.equal(payload.exp, now + 540);     // exp-iat = 600s, GitHub's hard max (must NOT exceed)
  const v = createVerify('RSA-SHA256');
  v.update(`${h}.${p}`);
  assert.equal(v.verify(createPublicKey(publicKey), Buffer.from(sig, 'base64url')), true);
});
```

**Step 2: Run to verify it fails** — `npm run test:server` → FAIL (no module).

**Step 3: Minimal implementation**
```js
import { createSign } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function buildAppJwt({ appId, privateKeyPem, now = Math.floor(Date.now() / 1000) }) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  // iat backdated 60s for clock skew; exp = iat + 600 (GitHub rejects exp-iat > 600s)
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(privateKeyPem).toString('base64url');
  return `${header}.${payload}.${sig}`;
}
```

**Step 4: Run tests** → PASS.

**Step 5: Commit**
```bash
git add services/spec-preview-server/github-app.mjs services/spec-preview-server/github-app.test.mjs
git commit -m "feat(preview-server): GitHub App JWT builder (RS256, zero-dep)"
```

---

## Task 3: Installation-token provider with caching

**Files:**
- Modify: `services/spec-preview-server/github-app.mjs`
- Modify: `services/spec-preview-server/github-app.test.mjs`

**Step 1: Write the failing tests** — inject a fake `fetchImpl` + `now` clock.
```js
test('createTokenProvider: mints then caches until near expiry', async () => {
  let calls = 0;
  let clock = 1000;
  const fetchImpl = async () => { calls++; return {
    ok: true, status: 201,
    json: async () => ({ token: `tok-${calls}`, expires_at: new Date((clock + 3600) * 1000).toISOString() }),
  };};
  const provider = createTokenProvider({
    appId: '1', privateKeyPem: PEM, installationId: '99',
    fetchImpl, now: () => clock,
  });
  assert.equal(await provider.getToken(), 'tok-1');
  clock += 60;                                  // still well before expiry
  assert.equal(await provider.getToken(), 'tok-1');   // cached, no 2nd call
  assert.equal(calls, 1);
  clock += 3600;                                // past expiry (minus safety window)
  assert.equal(await provider.getToken(), 'tok-2');   // refreshed
  assert.equal(calls, 2);
});

test('createTokenProvider: surfaces API failure', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, text: async () => 'bad creds' });
  const provider = createTokenProvider({ appId: '1', privateKeyPem: PEM, installationId: '99', fetchImpl });
  await assert.rejects(() => provider.getToken(), /401/);
});
```
(Define `PEM` once at top of test file via `generateKeyPairSync`.)

**Step 2: Run** → FAIL.

**Step 3: Implementation** (uses global `fetch` by default; refresh ~5 min before expiry):
```js
export function createTokenProvider({ appId, privateKeyPem, installationId, fetchImpl = fetch, now = () => Math.floor(Date.now() / 1000) }) {
  let cached = null; // { token, expSec }
  let inflight = null;
  const SAFETY = 300;
  async function mint() {
    const jwt = buildAppJwt({ appId, privateKeyPem, now: now() });
    const res = await fetchImpl(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'User-Agent': 'spec-preview-server' },
    });
    if (!res.ok) throw new Error(`installation token mint failed: ${res.status}`);
    const body = await res.json();
    cached = { token: body.token, expSec: Math.floor(new Date(body.expires_at).getTime() / 1000) };
    return cached.token;
  }
  return { async getToken() {
    if (cached && now() < cached.expSec - SAFETY) return cached.token;
    if (!inflight) inflight = mint().finally(() => { inflight = null; });
    return inflight;
  }};
}
```

**Step 4: Run** → PASS. **Step 5: Commit**
```bash
git commit -am "feat(preview-server): installation-token provider with TTL caching"
```

---

## Task 4: cloneUrl builder + org-repo name validation

**Files:** Modify `services/spec-preview-server/github-app.mjs` + its test.

**Step 1: Failing tests**
```js
test('buildCloneUrl: token-injected https url', () => {
  assert.equal(
    buildCloneUrl({ org: 'vattention', repo: 'facio-blueprint', token: 'tok' }),
    'https://x-access-token:tok@github.com/vattention/facio-blueprint.git',
  );
});
test('isValidRepoName: rejects injection / path chars', () => {
  assert.equal(isValidRepoName('facio-blueprint'), true);
  assert.equal(isValidRepoName('repo.name_2'), true);
  assert.equal(isValidRepoName('../etc'), false);
  assert.equal(isValidRepoName('a/b'), false);
  assert.equal(isValidRepoName(''), false);
  assert.equal(isValidRepoName('x'.repeat(101)), false);
});
```

**Step 2: Run** → FAIL.

**Step 3: Implementation**
```js
export function buildCloneUrl({ org, repo, token }) {
  return `https://x-access-token:${token}@github.com/${org}/${repo}.git`;
}
export function isValidRepoName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(name) && name !== '.' && name !== '..';
}
```

**Step 4: Run** → PASS. **Step 5: Commit**
```bash
git commit -am "feat(preview-server): cloneUrl builder + repo-name validation"
```

---

## Task 5: ensureRepo — on-demand clone with in-flight dedupe

**Files:**
- Create: `services/spec-preview-server/provision.mjs`
- Create: `services/spec-preview-server/provision.test.mjs`

**Step 1: Failing tests** (inject a fake `gitClone` + fake `getToken`; use a tmp cache dir):
```js
test('ensureRepo: clones once, caches, dedupes concurrent calls', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'prov-'));
  let clones = 0;
  const gitClone = async (url, dest) => { clones++; mkdirSync(join(dest, '.git'), { recursive: true }); };
  const ctx = { cacheDir, org: 'vattention', getToken: async () => 'tok', gitClone, isValidRepoName: () => true };
  const [a, b] = await Promise.all([ensureRepo('repo1', ctx), ensureRepo('repo1', ctx)]);
  assert.equal(a, join(cacheDir, 'repo1'));
  assert.equal(b, a);
  assert.equal(clones, 1);                       // deduped
  await ensureRepo('repo1', ctx);
  assert.equal(clones, 1);                        // already on disk → no re-clone
});

test('ensureRepo: invalid name rejected before any clone', async () => {
  const ctx = { cacheDir: '/tmp', org: 'o', getToken: async () => 't', gitClone: async () => { throw new Error('should not clone'); }, isValidRepoName: () => false };
  await assert.rejects(() => ensureRepo('../evil', ctx), /invalid repo name/);
});

test('ensureRepo: clone failure → NotInScope', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'prov-'));
  const gitClone = async () => { throw new Error('repo not found'); };
  const ctx = { cacheDir, org: 'o', getToken: async () => 't', gitClone, isValidRepoName: () => true };
  await assert.rejects(() => ensureRepo('ghost', ctx), (e) => e.code === 'NOT_IN_SCOPE');
});

test('ensureRepo: token-mint failure → TOKEN_FAILED (not NOT_IN_SCOPE)', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'prov-'));
  const ctx = {
    cacheDir, org: 'o',
    getToken: async () => { throw new Error('401 bad creds'); },
    gitClone: async () => { throw new Error('should not reach clone'); },
    isValidRepoName: () => true,
  };
  await assert.rejects(() => ensureRepo('repo1', ctx), (e) => e.code === 'TOKEN_FAILED');
});
```

**Step 2: Run** → FAIL.

**Step 3: Implementation**
```js
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const inflight = new Map();

export async function ensureRepo(name, ctx) {
  if (!ctx.isValidRepoName(name)) { const e = new Error(`invalid repo name: ${name}`); e.code = 'INVALID_NAME'; throw e; }
  const dest = join(ctx.cacheDir, name);
  if (existsSync(join(dest, '.git'))) return dest;
  if (inflight.has(dest)) return inflight.get(dest);
  const p = (async () => {
    let token;
    try { token = await ctx.getToken(); }
    catch { const e = new Error('installation token unavailable'); e.code = 'TOKEN_FAILED'; throw e; }
    try {
      // ctx.gitClone MUST be atomic (clone to a temp sibling, then rename to `dest`) so a
      // failed/partial clone never leaves a half-written `dest/.git` that existsSync() would
      // later treat as a valid cached repo (S3). Atomicity lives in the dep (Task 8 wiring).
      await ctx.gitClone(buildCloneUrl({ org: ctx.org, repo: name, token }), dest);
    } catch (err) {
      // Clone failed: most likely non-org / App-not-installed / repo missing → not in scope.
      // Do NOT attach `err` as cause — git error text can echo the token-bearing URL.
      const e = new Error(`repo not in scope: ${name}`); e.code = 'NOT_IN_SCOPE'; throw e;
    }
    return dest;
  })().finally(() => inflight.delete(dest));
  inflight.set(dest, p);
  return p;
}
```
> `TOKEN_FAILED` (token mint failed) is distinct from `NOT_IN_SCOPE` (clone rejected): the handler maps the former to a friendly **503** (spec §3 degradation) and the latter to **404** (AC-4). See Task 8.
> Note: real `gitClone` (deps wiring, Task 8) must NOT log the URL (token). Use `execFile('git', ['clone', '--quiet', url, dest])`, never echo `url`, and never log `err`/`err.cause` from a failed clone.
> Known limitation (SHOULD CONSIDER, deferred): a transient clone failure (network blip / GitHub 5xx) is also labelled `NOT_IN_SCOPE` → a misleading 404. Acceptable for v1 (self-corrects on retry; no negative cache); refine by matching git stderr (auth/404 → NOT_IN_SCOPE, else TOKEN_FAILED/transient → 503) if it proves noisy.

**Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add services/spec-preview-server/provision.mjs services/spec-preview-server/provision.test.mjs
git commit -m "feat(preview-server): ensureRepo on-demand clone w/ in-flight dedupe"
```

---

## Task 6: Default-branch detection + gitShow fallback

**Files:**
- Create: `services/spec-preview-server/git-show.mjs` (move/extend logic out of server.mjs)
- Create: `services/spec-preview-server/git-show.test.mjs`

**Step 1: Failing tests** — inject a fake `git(args)` runner returning `{ code, stdout }`.
```js
function fakeGit(refs, files) {
  return async (args) => {
    if (args[0] === 'symbolic-ref') return { code: 0, stdout: 'refs/remotes/origin/main\n' };
    if (args[0] === 'rev-parse') return { code: refs.has(args[2]) ? 0 : 1, stdout: '' };
    if (args[0] === 'show') { const key = args[1]; return key in files ? { code: 0, stdout: files[key] } : { code: 1, stdout: '' }; }
    return { code: 1, stdout: '' };
  };
}

test('gitShow: branch present → served from branch', async () => {
  const git = fakeGit(new Set(['origin/feat/x']), { 'origin/feat/x:spec.html': 'BRANCH' });
  const r = await gitShow({ repoDir: '/r', branch: 'feat/x', filePath: 'spec.html', git });
  assert.deepEqual({ status: r.status, servedFrom: r.servedFrom, content: r.content }, { status: 'ok', servedFrom: 'branch', content: 'BRANCH' });
});

test('gitShow: branch gone but on default → served from default (merged)', async () => {
  const git = fakeGit(new Set(['origin/main']), { 'origin/main:spec.html': 'MERGED' });
  const r = await gitShow({ repoDir: '/r', branch: 'feat/x', filePath: 'spec.html', git });
  assert.equal(r.status, 'ok'); assert.equal(r.servedFrom, 'default'); assert.equal(r.content, 'MERGED');
});

test('gitShow: branch gone + not on default → gone-unmerged', async () => {
  const git = fakeGit(new Set(['origin/main']), {});
  const r = await gitShow({ repoDir: '/r', branch: 'feat/x', filePath: 'spec.html', git });
  assert.equal(r.status, 'gone-unmerged');
});

test('gitShow: branch present, file missing → path-not-found', async () => {
  const git = fakeGit(new Set(['origin/feat/x', 'origin/main']), {});
  const r = await gitShow({ repoDir: '/r', branch: 'feat/x', filePath: 'nope.html', git });
  assert.equal(r.status, 'path-not-found');
});

// M1 regression: a LIVE branch missing the file must 404, NOT silently serve the default-branch copy.
test('gitShow: branch present + file missing on branch but present on default → path-not-found', async () => {
  const git = fakeGit(new Set(['origin/feat/x', 'origin/main']), { 'origin/main:spec.html': 'MERGED' });
  const r = await gitShow({ repoDir: '/r', branch: 'feat/x', filePath: 'spec.html', git });
  assert.equal(r.status, 'path-not-found');   // must NOT return 'MERGED'
});

// M3 regression: prod content is a Buffer; discriminator is the exit code, not typeof.
test('gitShow: Buffer content served unchanged', async () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
  const git = async (args) => {
    if (args[0] === 'rev-parse') return { code: args[2] === 'origin/feat/x' ? 0 : 1, stdout: Buffer.alloc(0) };
    if (args[0] === 'show') return { code: 0, stdout: buf };
    return { code: 1, stdout: Buffer.alloc(0) };
  };
  const r = await gitShow({ repoDir: '/r', branch: 'feat/x', filePath: 'img.png', git });
  assert.equal(r.status, 'ok');
  assert.ok(Buffer.isBuffer(r.content));
  assert.deepEqual(r.content, buf);
});
```

**Step 2: Run** → FAIL.

**Step 3: Implementation**
```js
// git(args) → { code, stdout }. stdout is a Buffer in prod (encoding:'buffer') / string in tests.
// Text callers MUST .toString(); binary file content is passed through untouched.
export async function resolveDefaultBranch({ repoDir, git, fallback = 'main' }) {
  const r = await git(['-C', repoDir, 'symbolic-ref', 'refs/remotes/origin/HEAD']);
  if (r.code === 0) { const m = r.stdout.toString().trim().match(/origin\/(.+)$/); if (m) return m[1]; }
  return fallback;
}

export async function gitShow({ repoDir, branch, filePath, git, defaultFallback = 'main' }) {
  // refExists / found derive from git EXIT CODES — never from typeof content.
  // (prod content is a Buffer; a typeof-string check would misclassify EVERY file.)
  const tryRef = async (ref) => {
    const rp = await git(['-C', repoDir, 'rev-parse', '--verify', ref]);
    if (rp.code !== 0) return { refExists: false, found: false };
    const sh = await git(['-C', repoDir, 'show', `${ref}:${filePath}`]);
    return { refExists: true, found: sh.code === 0, content: sh.stdout };
  };
  const onBranch = await tryRef(`origin/${branch}`);
  if (onBranch.refExists) {
    // Branch still present (review phase): serve its file, or 404 —
    // NEVER silently fall back to default while the branch is live.
    return onBranch.found
      ? { status: 'ok', servedFrom: 'branch', content: onBranch.content }
      : { status: 'path-not-found' };
  }
  // Branch ref is gone (merged+deleted, or closed-unmerged) → fall back to default branch.
  const def = await resolveDefaultBranch({ repoDir, git, fallback: defaultFallback });
  const onDefault = await tryRef(`origin/${def}`);
  if (onDefault.found) return { status: 'ok', servedFrom: 'default', content: onDefault.content };
  return { status: 'gone-unmerged' };
}
```
> Real `git` runner (Task 8) = `execFile('git', args, { encoding: 'buffer', maxBuffer: 10MB })`, mapping non-zero exit to `{ code, stdout: Buffer.alloc(0) }`. Because the discriminator is the exit code (`found`), Buffer content flows through unchanged — binary files (png/svg) work and the `typeof`-string trap is gone. Text callers (`resolveDefaultBranch`) call `.toString()`.

**Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add services/spec-preview-server/git-show.mjs services/spec-preview-server/git-show.test.mjs
git commit -m "feat(preview-server): gitShow default-branch fallback + state machine"
```

---

## Task 7: Friendly error/degradation HTML pages

**Files:**
- Create: `services/spec-preview-server/error-page.mjs`
- Create: `services/spec-preview-server/error-page.test.mjs`

**Step 1: Failing tests**
```js
test('renderErrorPage: gone-unmerged → 410 friendly html', () => {
  const { status, contentType, body } = renderErrorPage('gone-unmerged', { repo: 'r', branch: 'feat/x' });
  assert.equal(status, 410);
  assert.match(contentType, /text\/html/);
  assert.match(body, /已合并并删除|不存在/);     // friendly Chinese copy
  assert.doesNotMatch(body, /<script/i);          // static, no JS
});
test('renderErrorPage: not-in-scope → 404', () => {
  assert.equal(renderErrorPage('not-in-scope', { repo: 'ghost' }).status, 404);
});
test('renderErrorPage: path-not-found → 404, no internal leak', () => {
  const { status, body } = renderErrorPage('path-not-found', { filePath: 'a/b.html' });
  assert.equal(status, 404);
  assert.doesNotMatch(body, /\/var\/lib\/specs/);  // no server paths
});
// M2: token-mint / transient failure must degrade to a friendly 503 (spec §3), not a 500/crash.
test('renderErrorPage: service-unavailable → 503 friendly html', () => {
  const { status, contentType, body } = renderErrorPage('service-unavailable', {});
  assert.equal(status, 503);
  assert.match(contentType, /text\/html/);
  assert.doesNotMatch(body, /<script/i);
  assert.match(body, /稍后重试|暂时无法/);   // friendly transient copy
});
```

**Step 2: Run** → FAIL.

**Step 3: Implementation** — a single small template with inline styles; four kinds → statuses: `gone-unmerged`→410, `not-in-scope`→404, `path-not-found`→404, `service-unavailable`→503. Each returns `{ status, contentType: 'text/html; charset=utf-8', body }`. Keep copy aligned with §2 of the spec (suggest next step: 向作者索取最新链接 / 查看 PR; for 503: 服务暂时无法访问该仓库，请稍后重试). No `<script>`, no server-internal paths.

**Step 4: Run** → PASS. **Step 5: Commit**
```bash
git add services/spec-preview-server/error-page.mjs services/spec-preview-server/error-page.test.mjs
git commit -m "feat(preview-server): friendly HTML error/degradation pages"
```

---

## Task 8: Wire into handleRequest + dynamic refreshAll (integration)

**Files:**
- Modify: `services/spec-preview-server/server.mjs`
- Create: `services/spec-preview-server/server.integration.test.mjs`

**Step 1: Write the failing integration test** — build a real local bare repo fixture; inject a `gitClone` that "clones" by `git clone --local` from the fixture (no network, no token).
```js
// setup: create origin.git bare repo with spec.html on `feat/x` and on `main`;
// point ctx.gitClone at `git clone --local <fixture> <dest>`; getToken returns 'x'.
test('integration: branch present → 200 branch content', /* ... */);
test('integration: delete feat/x on origin + re-fetch → 200 merged (default) content', /* ... */);
test('integration: spec only on feat/x, deleted, not on main → 410 gone-unmerged page', /* ... */);
test('integration: unknown repo (gitClone throws) → 404 not-in-scope page', /* ... */);
test('integration: getToken throws → 503 service-unavailable page (no crash)', /* ... */);
test('integration: /healthz still plain ok', /* ... */);
```
Drive requests through `handleRequest(req, res, deps)` using `node:http` against `createApp(deps).server` on an ephemeral port, or call `handleRequest` with mock req/res objects.

**Step 2: Run** → FAIL.

**Step 3: Implementation** — assemble real deps in `buildDefaultDeps(config)`:
- `git(args)` = `execFile('git', args, {encoding:'buffer', maxBuffer:10MB})` → `{code, stdout}` (stdout=Buffer; non-zero exit → `{code, stdout: Buffer.alloc(0)}`).
- `gitClone(url, dest)` = clone to `dest + '.tmp-' + pid` via `execFile('git', ['clone','--quiet',url,tmp])`, then `fs.rename(tmp, dest)` on success (atomic; partial clones never become a "valid" cache dir). On failure, `rm -rf` the tmp. Never log `url` or the error.
- `getToken` from `createTokenProvider(config.app)`.
- handler flow: parseRequest → safeComponent guards → `ensureRepo(repo)` → cache check → `gitShow(...)`. Error mapping via one try/catch + a status→errorPage table:
  - `INVALID_NAME` / `NOT_IN_SCOPE` → `renderErrorPage('not-in-scope')` (404)
  - `TOKEN_FAILED` / **any other unexpected error** → `renderErrorPage('service-unavailable')` (503) — a catch-all so token-mint or git failures never 500/crash (M2)
  - gitShow `ok` → 200 (log `servedFrom`); `gone-unmerged` → 410 page; `path-not-found` → 404 page.
- **Only cache `ok` responses.** Never cache `gone-unmerged` / `path-not-found` / 503 (a transient miss must not pin an error). Cache key `repo|branch|filePath`, short TTL (`CACHE_TTL_MS`). Note: an `ok` response cached during review persists up to TTL after merge → AC-2's "merged latest" has a bounded staleness window of `CACHE_TTL_MS` (5s default); acceptable.
- `refreshAll`: enumerate `config.cacheDir` subdirs that contain `.git` (dynamic set) and `git fetch --all --prune` each; skip dirs currently in the clone `inflight` set (avoid fetch racing a half-written clone); ignore the old static map.

**Step 4: Run** → `npm run test:server` all PASS (unit + integration).

**Step 5: Commit**
```bash
git add services/spec-preview-server/server.mjs services/spec-preview-server/server.integration.test.mjs
git commit -m "feat(preview-server): org-wide on-demand clone + default-branch fallback wired in"
```

---

## Task 9: Config/env plumbing (GITHUB_* + optional pre-seed)

**Files:** Modify `services/spec-preview-server/server.mjs` (`loadConfig`), `services/spec-preview-server/server.test.mjs`.

**Step 1: Failing test** for `loadConfig`:
```js
test('loadConfig: reads GitHub App + org + defaults', () => {
  const c = loadConfig({ GITHUB_ORG: 'vattention', GITHUB_APP_ID: '1', GITHUB_APP_INSTALLATION_ID: '2', GITHUB_APP_PRIVATE_KEY: 'PEM' });
  assert.equal(c.org, 'vattention');
  assert.equal(c.defaultBranch, 'main');        // default
  assert.equal(c.cacheDir, '/var/lib/specs');   // default
  assert.equal(c.app.appId, '1');
});
test('loadConfig: SPEC_PREVIEW_REPOS optional (pre-seed allowlist)', () => {
  const c = loadConfig({ GITHUB_ORG: 'o', GITHUB_APP_ID: '1', GITHUB_APP_INSTALLATION_ID: '2', GITHUB_APP_PRIVATE_KEY: 'PEM' });
  assert.deepEqual(c.preSeed, []);              // absent → empty, not fatal
});
// S5: booting without App creds must fail loudly at start, not silently 503 every request.
test('validateRuntimeConfig: missing App creds → throws', () => {
  assert.throws(() => validateRuntimeConfig(loadConfig({})), /GITHUB_APP/);
});
```

**Step 2–4:** Implement env reads: `GITHUB_ORG` (default `vattention`), `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM string) OR `GITHUB_APP_PRIVATE_KEY_PATH` (read file), `GITHUB_DEFAULT_BRANCH` (default `main`), `CACHE_DIR` (default `/var/lib/specs`). `SPEC_PREVIEW_REPOS` → optional `preSeed` clone list. Add `validateRuntimeConfig(config)` (throws if `appId`/`installationId`/private key absent); `start()` calls it and fails fatally with a clear message. `loadConfig`/import stay pure (no throw at import). Run → PASS.

**Step 5: Commit**
```bash
git commit -am "feat(preview-server): GitHub App config + optional repo pre-seed"
```

---

## Task 10: Deploy — install.sh + systemd unit (GitHub App creds)

**Files:** Modify `services/spec-preview-server/deploy/install.sh`, `services/spec-preview-server/systemd/spec-preview-server.service`.

**Steps (no unit test; verify by `bash -n` + review):**
- `install.sh`: drop the per-repo deploy-key + mandatory `SPEC_PREVIEW_REPOS` arg. New usage installs App creds:
  ```bash
  sudo bash install.sh --org vattention --app-id <id> --installation-id <iid> --private-key <src.pem> [--preseed name,name]
  ```
  Copy the PEM to **`/etc/spec-preview-server.key`** (owner `specs`, `chmod 600`) — deliberately OUTSIDE `/var/lib/specs` (the world-cloneable RW cache). Write `/etc/spec-preview-server.env` with `GITHUB_ORG`, `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY_PATH=/etc/spec-preview-server.key`, optional `SPEC_PREVIEW_REPOS`. Prefer the **path** form over inline `GITHUB_APP_PRIVATE_KEY` (env is readable via `/proc/<pid>/environ`). Install the new `*.mjs` files (server + github-app + provision + git-show + error-page) to `/opt/spec-preview-server/`. Keep `specs` user; idempotent.
- systemd unit: rely on `EnvironmentFile=-/etc/spec-preview-server.env` (no hardcoded org); keep `ReadWritePaths=/var/lib/specs`; add `ReadOnlyPaths=/etc/spec-preview-server.key` (compatible with `ProtectSystem=strict`).
- Verify: `bash -n deploy/install.sh`.

**Commit**
```bash
git add services/spec-preview-server/deploy/install.sh services/spec-preview-server/systemd/spec-preview-server.service
git commit -m "chore(preview-server): install via GitHub App creds; drop per-repo deploy keys"
```

---

## Task 11: README rewrite

**Files:** Modify `services/spec-preview-server/README.md`.

- Architecture diagram: add token-mint + on-demand clone; fallback-to-default arrow.
- Deploy: GitHub App creation (org install, `contents:read`) instead of per-repo deploy keys; new `install.sh` usage.
- Operations: dynamic repo cache; manual fetch note.
- Troubleshooting table: 410 row → now "served from default branch after merge; only gone-unmerged if PR never merged"; add "404 repo not in scope (non-org / App not installed)".
- Remove the obsolete "Adding a new repo" manual-onboarding section (zero-config now).

**Commit**
```bash
git commit -am "docs(preview-server): README for GitHub App + durable links"
```

---

## Task 12: spec-ratifier doc updates

**Files:** Modify `skills/spec-ratifier/SKILL.md`.

- Step 3.5A Note (:311): clarify post-merge links resolve via default-branch fallback (no longer 410).
- Failure-mode table (:303-311): update the 502/404 rows; remove the implicit "repo must be onboarded" assumption; note any `vattention` repo works zero-config.
- (No behavior change to URL construction — repo/branch format unchanged.)

**Commit**
```bash
git commit -am "docs(spec-ratifier): preview links durable + zero-config repos"
```

---

## Task 13: RELEASE-NOTES + version bump

**Files:** Modify `RELEASE-NOTES.md`, `package.json` (via `npm version minor`).

- Add a RELEASE-NOTES entry summarizing: durable preview links (default-branch fallback) + org-wide zero-config repos (GitHub App), zero new npm deps.
- `npm run version:minor` (bumps + commits per repo convention) — confirm message style matches recent `chore: bump version to x.y.z`.

**Commit** — handled by `npm version`; verify with `git log --oneline -2`.

---

## Final verification (before marking complete)

- `npm run test:server` → all PASS (unit + integration).
- `npm run test:generator` → still PASS (untouched).
- `bash -n services/spec-preview-server/deploy/install.sh` → OK.
- `grep -rn "x-access-token\|getToken\|cloneUrl" services/spec-preview-server` → confirm token never passed to `log()` / `console`.
- AC-7 guard: confirm no new code path opens a second listener/port or serves outside the `/<repo>/<branch>/<path>` prefix (auth is enforced at Cloudflare on that host; a second port would bypass it).
- Push to PR #23; PR now carries spec + implementation.

## Out of scope / deferred (per spec §4)

- LRU/eviction for the clone cache (start unbounded; observe disk).
- GitHub App creation/installation on `vattention` org — **ops prerequisite**, blocks problem-1 e2e (not unit/integration which use local fixtures). Owner TBD.
- Whether to fully remove `SPEC_PREVIEW_REPOS` (kept as optional pre-seed for now).

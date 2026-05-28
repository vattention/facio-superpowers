// server.test.mjs — unit tests for parseRequest + safeComponent + factory purity.
//
// Importing server.mjs is now side-effect free: the listen() / fetch timer are
// guarded behind an isMain check, and the request handler is extracted into an
// exported handleRequest / createApp factory. No port is bound at import time.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { parseRequest, safeComponent, createApp, handleRequest, loadConfig, validateRuntimeConfig } = await import('./server.mjs');

test('module import does not bind a port (createApp factory exported)', async () => {
  const mod = await import('./server.mjs');
  assert.equal(typeof mod.createApp, 'function');
  assert.equal(typeof mod.handleRequest, 'function');
});

// ---------------------------------------------------------------------------
// Config / env plumbing (Task 9)
// ---------------------------------------------------------------------------

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

test('loadConfig: import stays pure — never throws even with no env', () => {
  assert.doesNotThrow(() => loadConfig({}));
  assert.equal(loadConfig({}).app, null);
});

test('loadConfig: SPEC_PREVIEW_REPOS parses name:path and bare-name entries', () => {
  const c = loadConfig({ SPEC_PREVIEW_REPOS: 'a:/path/a, b, c:/path/c' });
  assert.deepEqual(c.preSeed, [
    { name: 'a', path: '/path/a' },
    { name: 'b', path: null },
    { name: 'c', path: '/path/c' },
  ]);
});

test('validateRuntimeConfig: complete App creds → no throw, returns undefined', () => {
  const c = loadConfig({ GITHUB_APP_ID: '1', GITHUB_APP_INSTALLATION_ID: '2', GITHUB_APP_PRIVATE_KEY: 'PEM' });
  let ret;
  assert.doesNotThrow(() => { ret = validateRuntimeConfig(c); });
  assert.equal(ret, undefined);
});

test('parseRequest: simple 3-segment URL', () => {
  assert.deepEqual(
    parseRequest('/facio-blueprint/main/docs/spec.html'),
    { repo: 'facio-blueprint', branch: 'main', filePath: 'docs/spec.html' },
  );
});

test('parseRequest: feat/x branch (2-segment)', () => {
  assert.deepEqual(
    parseRequest('/facio-blueprint/feat/my-feature/docs/spec.html'),
    { repo: 'facio-blueprint', branch: 'feat/my-feature', filePath: 'docs/spec.html' },
  );
});

test('parseRequest: fix/x branch', () => {
  assert.deepEqual(
    parseRequest('/repo/fix/bug-1234/file.html'),
    { repo: 'repo', branch: 'fix/bug-1234', filePath: 'file.html' },
  );
});

test('parseRequest: deep nested path', () => {
  assert.deepEqual(
    parseRequest('/repo/main/a/b/c/d/e.html'),
    { repo: 'repo', branch: 'main', filePath: 'a/b/c/d/e.html' },
  );
});

test('parseRequest: too few segments → null', () => {
  assert.equal(parseRequest('/'), null);
  assert.equal(parseRequest('/repo'), null);
  assert.equal(parseRequest('/repo/branch'), null);
});

test('parseRequest: feat prefix with only 3 segments → 1-segment branch', () => {
  assert.deepEqual(
    parseRequest('/repo/feat/file.html'),
    { repo: 'repo', branch: 'feat', filePath: 'file.html' },
  );
});

test('safeComponent: alphanumeric + dashes ok', () => {
  assert.equal(safeComponent('foo-bar-123'), true);
  assert.equal(safeComponent('main'), true);
  assert.equal(safeComponent('feat'), true);
});

test('safeComponent: rejects shell metachars', () => {
  assert.equal(safeComponent('foo;rm -rf /'), false);
  assert.equal(safeComponent('foo|bar'), false);
  assert.equal(safeComponent('foo&bar'), false);
  assert.equal(safeComponent('foo`bar`'), false);
});

test('safeComponent: rejects empty + too long', () => {
  assert.equal(safeComponent(''), false);
  assert.equal(safeComponent('x'.repeat(201)), false);
});

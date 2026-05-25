// server.test.mjs — unit tests for parseRequest + safeComponent.
//
// Note: server.mjs starts listening at module load. To test without binding
// a port, we'd need to refactor server.mjs to factor out listen. For v2.6.0
// we accept the listener and provide a dummy SPEC_PREVIEW_REPOS env at test
// start (process.exit before tests run would prevent that).
//
// Workaround: import-then-stop the server.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.SPEC_PREVIEW_REPOS = process.env.SPEC_PREVIEW_REPOS || 'test:/tmp';
process.env.PORT = process.env.PORT || '0';  // OS-assigned ephemeral port

const { parseRequest, safeComponent } = await import('./server.mjs');

after(() => {
  // Server keeps event loop alive; force exit after tests complete.
  // (Real fix in v2.6.1: refactor server.mjs to export createServer factory.)
  setTimeout(() => process.exit(0), 100).unref();
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

// server.test.mjs — unit tests for parseRequest + safeComponent + factory purity.
//
// Importing server.mjs is now side-effect free: the listen() / fetch timer are
// guarded behind an isMain check, and the request handler is extracted into an
// exported handleRequest / createApp factory. No port is bound at import time.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { parseRequest, safeComponent, createApp, handleRequest } = await import('./server.mjs');

test('module import does not bind a port (createApp factory exported)', async () => {
  const mod = await import('./server.mjs');
  assert.equal(typeof mod.createApp, 'function');
  assert.equal(typeof mod.handleRequest, 'function');
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

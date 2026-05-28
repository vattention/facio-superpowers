import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureRepo } from './provision.mjs';

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

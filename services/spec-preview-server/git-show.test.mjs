import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gitShow, resolveDefaultBranch } from './git-show.mjs';

function fakeGit(refs, files) {
  return async (args) => {
    if (args[0] === '-C') args = args.slice(2);
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
    if (args[0] === '-C') args = args.slice(2);
    if (args[0] === 'rev-parse') return { code: args[2] === 'origin/feat/x' ? 0 : 1, stdout: Buffer.alloc(0) };
    if (args[0] === 'show') return { code: 0, stdout: buf };
    return { code: 1, stdout: Buffer.alloc(0) };
  };
  const r = await gitShow({ repoDir: '/r', branch: 'feat/x', filePath: 'img.png', git });
  assert.equal(r.status, 'ok');
  assert.ok(Buffer.isBuffer(r.content));
  assert.deepEqual(r.content, buf);
});

// Fix B: gitShow accepts an injectable resolveDefault (server memoizes it). When
// the branch is gone, gitShow must call the injected resolver instead of always
// re-spawning symbolic-ref via the default resolveDefaultBranch.
test('gitShow: branch gone → uses injected resolveDefault (not the built-in)', async () => {
  let injectedCalls = 0;
  let symbolicRefSpawns = 0;
  const git = async (args) => {
    if (args[0] === '-C') args = args.slice(2);
    if (args[0] === 'symbolic-ref') { symbolicRefSpawns++; return { code: 0, stdout: 'refs/remotes/origin/main\n' }; }
    if (args[0] === 'rev-parse') return { code: args[2] === 'origin/main' ? 0 : 1, stdout: '' };
    if (args[0] === 'show') return { code: 0, stdout: 'MERGED' };
    return { code: 1, stdout: '' };
  };
  const resolveDefault = async ({ fallback }) => { injectedCalls++; return 'main'; };
  const r = await gitShow({ repoDir: '/r', branch: 'feat/x', filePath: 'spec.html', git, resolveDefault });
  assert.equal(r.status, 'ok');
  assert.equal(r.servedFrom, 'default');
  assert.equal(injectedCalls, 1, 'injected resolveDefault must be used');
  assert.equal(symbolicRefSpawns, 0, 'built-in symbolic-ref must NOT be spawned when resolveDefault injected');
});

test('resolveDefaultBranch: parses symbolic-ref', async () => {
  const git = fakeGit(new Set(), {});
  const def = await resolveDefaultBranch({ repoDir: '/r', git });
  assert.equal(def, 'main');
});

test('resolveDefaultBranch: falls back when symbolic-ref fails', async () => {
  const git = async () => ({ code: 1, stdout: '' });
  const def = await resolveDefaultBranch({ repoDir: '/r', git, fallback: 'trunk' });
  assert.equal(def, 'trunk');
});

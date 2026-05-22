// scripts-role-lookup.test.mjs — unit tests for role lookup helper
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lookupByGithubLogin, loadRoleBindings } from './scripts-role-lookup.mjs';

function withTempYaml(content, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'role-lookup-'));
  const file = path.join(dir, 'role-bindings.yaml');
  writeFileSync(file, content, 'utf8');
  try { return fn(file); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('lookupByGithubLogin: hit returns id + name', () => {
  withTempYaml(`users:
  - id: ou_abc123
    name: 张三
    github_login: zhangsan
    function: frontend-dev
`, (file) => {
    const result = lookupByGithubLogin(file, 'zhangsan');
    assert.equal(result.id, 'ou_abc123');
    assert.equal(result.name, '张三');
  });
});

test('lookupByGithubLogin: miss throws with helpful message', () => {
  withTempYaml(`users:
  - id: ou_abc123
    name: 张三
    github_login: zhangsan
`, (file) => {
    assert.throws(
      () => lookupByGithubLogin(file, 'unknown'),
      /GH login 'unknown' not found.*github_login: unknown/s,
    );
  });
});

test('lookupByGithubLogin: empty users[] throws', () => {
  withTempYaml(`users: []\n`, (file) => {
    assert.throws(
      () => lookupByGithubLogin(file, 'anyone'),
      /role-bindings\.yaml has empty users\[\]/,
    );
  });
});

test('lookupByGithubLogin: missing file throws clear error', () => {
  assert.throws(
    () => lookupByGithubLogin('/nonexistent/path.yaml', 'x'),
    /role-bindings\.yaml not found/,
  );
});

test('lookupByGithubLogin: user without github_login skipped silently', () => {
  withTempYaml(`users:
  - id: ou_legacy
    name: 老用户
    function: frontend-dev
  - id: ou_new
    name: 新用户
    github_login: newuser
`, (file) => {
    const result = lookupByGithubLogin(file, 'newuser');
    assert.equal(result.id, 'ou_new');
  });
});

test('CLI mode: prints "id\\tname" on hit, exit 0', async () => {
  withTempYaml(`users:
  - id: ou_xyz
    name: Test
    github_login: testlogin
`, async (file) => {
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync('node', [
      new URL('./scripts-role-lookup.mjs', import.meta.url).pathname,
      file,
      'testlogin',
    ], { encoding: 'utf8' });
    assert.equal(out.trim(), 'ou_xyz\tTest');
  });
});

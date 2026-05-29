import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test('spec-author resolves spec paths from the host repo before defaulting', async () => {
  const skill = await readFile(join(repoRoot, 'skills/spec-author/SKILL.md'), 'utf8');

  assert.match(skill, /SPEC_DIR/);
  assert.match(skill, /AGENTS\.md/);
  assert.match(skill, /docs\/README\.md/);
  assert.match(skill, /FACIO_SPEC_DIR/);
  assert.match(skill, /fallback.*docs\/superpowers\/specs/is);
});

test('spec-ratifier accepts a caller-provided spec path or directory', async () => {
  const skill = await readFile(join(repoRoot, 'skills/spec-ratifier/SKILL.md'), 'utf8');

  assert.match(skill, /SPEC_PATH/);
  assert.match(skill, /SPEC_DIR/);
  assert.match(skill, /FACIO_SPEC_DIR/);
});

test('promote_context_to_spec defers spec path selection to spec-author', async () => {
  const skill = await readFile(join(repoRoot, 'skills/promote_context_to_spec/SKILL.md'), 'utf8');

  assert.match(skill, /SPEC_DIR/);
  assert.doesNotMatch(skill, /Target repo has Harness scaffold \(cwd has `docs\/superpowers\/specs\/` dir\)/);
  assert.doesNotMatch(skill, /\*\*Spec stub path\*\*: `docs\/superpowers\/specs/);
});

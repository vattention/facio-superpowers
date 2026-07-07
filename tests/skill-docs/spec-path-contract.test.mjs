import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

test('spec-author is not installed as a discoverable skill', async () => {
  await assert.rejects(
    access(join(repoRoot, 'skills/spec-author/SKILL.md')),
    /ENOENT/,
  );
});

test('spec-ratifier accepts a caller-provided spec path or directory', async () => {
  const skill = await readFile(join(repoRoot, 'skills/spec-ratifier/SKILL.md'), 'utf8');

  assert.match(skill, /SPEC_PATH/);
  assert.match(skill, /SPEC_DIR/);
  assert.match(skill, /FACIO_SPEC_DIR/);
});

test('active skill docs do not invoke spec-author', async () => {
  const skillsDir = join(repoRoot, 'skills');
  const skillNames = await readdir(skillsDir);
  const offenders = [];
  for (const skillName of skillNames) {
    if (skillName === 'spec-author') continue;
    let skill = '';
    try {
      skill = await readFile(join(skillsDir, skillName, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    if (/Skill\(spec-author\)|Next:\s*Skill\(spec-author\)/i.test(skill)) {
      offenders.push(skillName);
    }
  }

  assert.deepEqual(offenders, []);
});

test('promote_context_to_spec no longer depends on spec-author', async () => {
  const skill = await readFile(join(repoRoot, 'skills/promote_context_to_spec/SKILL.md'), 'utf8');

  assert.doesNotMatch(skill, /spec-author/i);
  assert.doesNotMatch(skill, /Target repo has Harness scaffold \(cwd has `docs\/superpowers\/specs\/` dir\)/);
  assert.doesNotMatch(skill, /\*\*Spec stub path\*\*: `docs\/superpowers\/specs/);
});

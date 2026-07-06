// Smoke test for the SHIPPED bundle (templates/scripts-generate-spec-html.mjs).
// Runs it exactly as a consumer repo would — via the CLI — on a representative
// spec, then asserts the structural invariants that matter downstream. Source-level
// unit tests live in src/generate-spec-html/*.test.mjs; this guards the built artifact.
// (Replaces the old full-HTML golden test, which pinned the obsolete v1 output.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'scripts-generate-spec-html.mjs');

const SPEC = `---
tier: Normal
status: draft
owners:
  pm: "@pm"
  designer: "@d"
  engineer: "@e"
---

# Bundle Smoke Spec

## §1 产品视角

### 验收标准

- [ ] AC-1: x
- [ ] AC-2: y

## §4 Cross-viewpoint Open Issues

- [ ] issue one
- [ ] issue two

## §5 L1 Impact

### ADDED Requirements

- None

### MODIFIED Requirements

- 无

### REMOVED Requirements

- None

## §6 Pipeline Tier

**决策**：Normal
`;

test('shipped bundle: renders a spec with dashboard, balanced sections, collapsed empty §5', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bundle-smoke-'));
  const md = path.join(dir, 'spec.md');
  const html = path.join(dir, 'spec.html');
  writeFileSync(md, SPEC, 'utf8');
  try {
    execFileSync('node', [BUNDLE, md], { stdio: 'pipe' });
    const out = readFileSync(html, 'utf8');
    const count = (re) => (out.match(re) || []).length;

    // Self-contained artifact
    assert.match(out, /<!doctype html>/i);
    assert.ok(out.length > 400000, `expected inlined mermaid runtime; got ${out.length}`);

    // Dashboard with computed metrics
    assert.match(out, /class="dashboard"/);
    assert.match(out, /<span class="k">AC<\/span> 2/);
    assert.match(out, /<span class="k">L1<\/span> \+0 ~0 −0/);
    assert.match(out, /<span class="k">Open Issues<\/span> 2/);
    assert.match(out, /owner<\/span> PM · 设计 · 研发/);

    // Empty §5 collapses to one-line verdict, content folded (not lost)
    assert.match(out, /class="section empty" data-tag="§5"/);
    assert.match(out, /class="section empty-body"/);

    // Structural invariants (count all wrappers, incl. the empty-section fold)
    assert.equal(count(/<h1[ >]/g), 1, 'exactly one <h1>');
    assert.equal(count(/<section\b/g), count(/<\/section>/g), 'sections balanced');
    assert.equal(count(/<details\b/g), count(/<\/details>/g), 'details balanced');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

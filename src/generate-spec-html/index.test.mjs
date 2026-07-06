import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderSpec } from './index.mjs';

const FIXTURE = `---
change_id: test-fixture
tier: Normal
status: ratified
owners:
  pm: "@alice"
---

# Fixture Spec

## §1 产品视角（owner: PM）

### 验收标准

- [ ] **AC-1**: testable behaviour
- [ ] **AC-2**: another

## §3 研发视角（owner: 研发）

### 复杂模块拆解

1. **First module**
   - sub item
     \`\`\`json
     { "nested": "code" }
     \`\`\`
   - next

### 技术架构

\`\`\`mermaid
sequenceDiagram
    A->>B: hello
\`\`\`

## §4 Open Issues

- [ ] foo

## §5 L1 Impact

### ADDED Requirements

- The system MUST do X
- And Y

### MODIFIED Requirements

- "old" → "new"

### REMOVED Requirements

- Old req

## §6 Pipeline Tier

**决策**：Normal

## §7 Doc Impact

Some docs.

## §K Knowledge References

None.
`;

test('integration: full fixture renders without error and contains all key elements', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gen-int-'));
  const fixturePath = path.join(dir, 'fixture.md');
  writeFileSync(fixturePath, FIXTURE, 'utf8');
  try {
    const html = await renderSpec(fixturePath);
    assert.ok(html.length > 500000, `expected >500KB (mermaid runtime inlined); got ${html.length}`);

    assert.match(html, /<title>Fixture Spec<\/title>/);
    assert.match(html, /<h1>Fixture Spec<\/h1>/);
    assert.match(html, /class="dashboard"/, 'expected summary dashboard');
    assert.match(html, /class="chip"[^>]*>ratified/, 'expected ratified status chip');
    assert.match(html, /<span class="k">L1<\/span> \+2 ~1 −1/, 'expected L1 diff counts');
    assert.match(html, /<span class="k">AC<\/span> 2/, 'expected AC count');
    assert.match(html, /class="ac-card"/, 'expected AC card wrapper');
    assert.match(html, /AC-1/);
    assert.match(html, /shiki/, 'expected shiki syntax highlight');
    assert.match(html, /"nested"/, 'expected JSON content present');
    assert.match(html, /<pre class="mermaid">/, 'expected mermaid block');
    assert.match(html, /A->>B: hello/);
    assert.match(html, /mermaid.initialize/, 'expected mermaid runtime init');
    assert.match(html, /diff-added/);
    assert.match(html, /diff-modified/);
    assert.match(html, /diff-removed/);
    assert.match(html, /<details/, 'expected §4/§7 collapsible wrappers');
    assert.match(html, /sha256:/);

    // Structural invariants (regression: §5+ after §4 used to leak </summary>
    // and sections were never closed, nesting the whole doc).
    const count = (re) => (html.match(re) || []).length;
    assert.equal(count(/<section class="section"/g), count(/<\/section>/g), 'sections balanced');
    assert.equal(count(/<details class="section"/g), count(/<\/details>/g), 'details balanced');
    assert.equal(count(/<h2 /g), count(/<\/h2>/g), 'h2 open/close balanced');
    // Title appears once as a body <h1> (the shell); body's "# Fixture Spec" is stripped.
    assert.equal(count(/<h1[ >]/g), 1, 'exactly one <h1> (no duplicated title)');
    // Fixture §5 HAS real content, so it must NOT collapse.
    assert.doesNotMatch(html, /class="section empty"/, 'non-empty §5 must not collapse');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// §5 with every subsection "None" (incl. verbose forms) collapses to a one-line verdict.
const EMPTY_L1 = `---
tier: Normal
status: draft
---

# Empty L1 Spec

## §1 产品视角

### 验收标准

- [ ] AC-1: x

## §5 L1 Impact

### Affected capabilities

- 暂无独立 capability spec 对应；当前按 None 处理。

### ADDED Requirements

- None（本变更为内部机制扩展，未新增对外 L1 requirement）

### MODIFIED Requirements

- None

### REMOVED Requirements

- 无

## §6 Pipeline Tier

**决策**：Normal
`;

test('all-None §5 collapses to a one-line verdict (content folded, not lost)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gen-empty-'));
  const p = path.join(dir, 'empty.md');
  writeFileSync(p, EMPTY_L1, 'utf8');
  try {
    const html = await renderSpec(p);
    assert.match(html, /class="section empty" data-tag="§5"/, '§5 should collapse');
    assert.match(html, /class="empty-verdict">✓ 无影响/, 'verdict shown');
    // Content is folded away, not deleted — the explanation is still present.
    assert.match(html, /class="section empty-body"/, 'folded body present');
    assert.match(html, /本变更为内部机制扩展/, 'original rationale preserved in fold');
    // Dashboard reflects zero L1 impact.
    assert.match(html, /class="chip good"><span class="k">L1<\/span> \+0 ~0 −0/, 'L1 shows zero (green)');
    // §6 after the collapsed §5 still renders normally (state didn't leak).
    assert.match(html, /data-tag="§6"><h2/, '§6 renders as normal section after collapse');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

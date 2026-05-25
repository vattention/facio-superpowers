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
    assert.match(html, /class="badge"[^>]*>ratified/, 'expected ratified status badge');
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
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

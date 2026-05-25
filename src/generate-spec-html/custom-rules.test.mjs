import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createParser } from './parser.mjs';

// Use full parser (with custom-rules installed) so heading state propagates
// through anchor plugin / etc. Pure markdown-it without anchor would behave differently.

test('§5 ADDED list items → .diff-added', async () => {
  const md = await createParser();
  const html = md.render('## §5 L1 Impact\n\n### ADDED Requirements\n\n- The system MUST do X\n- And Y');
  assert.match(html, /class="diff-added"/);
  assert.match(html, /The system MUST do X/);
});

test('§5 MODIFIED → .diff-modified', async () => {
  const md = await createParser();
  const html = md.render('## §5 L1 Impact\n\n### MODIFIED Requirements\n\n- "old" → "new"');
  assert.match(html, /class="diff-modified"/);
});

test('§5 REMOVED → .diff-removed', async () => {
  const md = await createParser();
  const html = md.render('## §5 L1 Impact\n\n### REMOVED Requirements\n\n- Old req');
  assert.match(html, /class="diff-removed"/);
});

test('AC checklist items get .ac-card wrapper', async () => {
  const md = await createParser();
  const html = md.render('## §1 产品视角\n\n### 验收标准\n\n- [ ] **AC-1**: user can do X\n- [ ] **AC-2**: ...');
  assert.match(html, /class="ac-card"/);
  assert.match(html, /AC-1/);
});

test('§4 wraps in <details>', async () => {
  const md = await createParser();
  const html = md.render('## §4 Cross-viewpoint Open Issues\n\n- foo');
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
});

test('§7 wraps in <details>', async () => {
  const md = await createParser();
  const html = md.render('## §7 Doc Impact\n\nSome content');
  assert.match(html, /<details/);
});

test('§1 does NOT wrap in <details> (not collapsible)', async () => {
  const md = await createParser();
  const html = md.render('## §1 产品视角\n\ncontent');
  assert.doesNotMatch(html, /<details/);
});

test('§ tag prefix gets visual badge', async () => {
  const md = await createParser();
  const html = md.render('## §1 产品视角');
  assert.match(html, /class="tag"/);
  assert.match(html, /§1/);
});

// v2.6.1: empty "none" markers in §5 should NOT get colored diff box
test('§5 ADDED with just "无" → .diff-none (muted, not green box)', async () => {
  const md = await createParser();
  const html = md.render('## §5 L1 Impact\n\n### ADDED Requirements\n\n- 无');
  assert.match(html, /class="diff-none"/);
  assert.doesNotMatch(html, /class="diff-added">\s*无\s*<\/li>/);
});

test('§5 REMOVED with "None" → .diff-none', async () => {
  const md = await createParser();
  const html = md.render('## §5 L1 Impact\n\n### REMOVED Requirements\n\n- None');
  assert.match(html, /class="diff-none"/);
});

test('§5 MODIFIED with real content → still gets .diff-modified', async () => {
  const md = await createParser();
  const html = md.render('## §5 L1 Impact\n\n### MODIFIED Requirements\n\n- "old" → "new"');
  assert.match(html, /class="diff-modified"/);
  assert.doesNotMatch(html, /class="diff-none"/);
});

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

// Regression: a non-collapsible section AFTER a collapsible one must still close
// its <h2> with </h2>, not leak </summary> from the collapsible section's state.
// (Previously st.inCollapsible was set by §4 and never reset, corrupting §5+.)
test('non-collapsible §5 after collapsible §4 closes h2 correctly', async () => {
  const md = await createParser();
  const html = md.render('## §4 Open Issues\n\n- foo\n\n## §5 L1 Impact\n\ncontent');
  // §5 opens a <section>/<h2>, so it must NOT emit a stray </summary> for its heading.
  const section5 = html.slice(html.indexOf('data-tag="§5"'));
  assert.match(section5, /<h2[^>]*>[\s\S]*?<\/h2>/, '§5 heading should close with </h2>');
  assert.doesNotMatch(section5.slice(0, section5.indexOf('</h2>')), /<\/summary>/,
    '§5 heading must not close with </summary>');
});

// Regression: every opened section/details wrapper is closed (balanced tags).
// Mirrors renderSpec()'s trailing-close step to close the last section.
test('all section wrappers are balanced (opens === closes)', async () => {
  const md = await createParser();
  const env = {};
  let html = md.render(
    '## §1 产品视角\n\na\n\n## §4 Open Issues\n\n- b\n\n## §5 L1 Impact\n\nc',
    env,
  );
  if (env._customRules?.openSection) html += env._customRules.openSection;
  const count = (re) => (html.match(re) || []).length;
  assert.equal(count(/<section class="section"/g), count(/<\/section>/g), 'section open/close balanced');
  assert.equal(count(/<details class="section"/g), count(/<\/details>/g), 'details open/close balanced');
});

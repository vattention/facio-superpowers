import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createParser } from './parser.mjs';

test('parser: heading → <h1>', async () => {
  const p = await createParser();
  const html = p.render('# Hello');
  assert.match(html, /<h1[^>]*>Hello<\/h1>/);
});

test('parser: nested code block in list (the v1 regression case)', async () => {
  const p = await createParser();
  const md = `1. outer item
   - inner bullet
     \`\`\`json
     { "a": 1 }
     \`\`\`
   - next bullet`;
  const html = p.render(md);
  // shiki tokenizes JSON across <span> elements, so check for shiki wrapper
  // and the JSON key/value tokens individually
  assert.match(html, /<pre[^>]*class="[^"]*shiki/, 'expected shiki wrapper');
  assert.match(html, /"a"/, 'expected JSON key');
});

test('parser: task list checkboxes', async () => {
  const p = await createParser();
  const html = p.render('- [ ] todo\n- [x] done');
  assert.match(html, /type="checkbox"/);
  assert.match(html, /checked/);
});

test('parser: multi-line blockquote preserves text', async () => {
  const p = await createParser();
  const html = p.render('> line one\n> line two');
  assert.match(html, /line one/);
  assert.match(html, /line two/);
});

test('parser: header anchor for deep linking', async () => {
  const p = await createParser();
  const html = p.render('## §1 产品视角');
  assert.match(html, /<(h2|summary)[^>]*id="[^"]+"/);
});

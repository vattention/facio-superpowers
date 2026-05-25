import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { installMermaidRule, getMermaidRuntimeScript } from './mermaid.mjs';

test('mermaid: fence lang=mermaid → <pre class="mermaid">', () => {
  const md = new MarkdownIt();
  installMermaidRule(md);
  const html = md.render('```mermaid\nsequenceDiagram\n  A->>B: hi\n```');
  assert.match(html, /<pre class="mermaid">/);
  assert.match(html, /sequenceDiagram/);
});

test('mermaid: raw source preserved (no HTML escape inside mermaid block)', () => {
  const md = new MarkdownIt();
  installMermaidRule(md);
  const html = md.render('```mermaid\nflowchart TB\n  A-->|label|B\n```');
  assert.match(html, /A-->\|label\|B/);
});

test('mermaid: other lang NOT intercepted', () => {
  const md = new MarkdownIt();
  installMermaidRule(md);
  const html = md.render('```json\n{"a":1}\n```');
  assert.doesNotMatch(html, /<pre class="mermaid">/);
});

test('mermaid: runtime script is large UMD string', () => {
  const script = getMermaidRuntimeScript();
  assert.equal(typeof script, 'string');
  assert.ok(script.length > 400000, `expected >400KB UMD; got ${script.length}`);
  assert.match(script, /mermaid/i);
});

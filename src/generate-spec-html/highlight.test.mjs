import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHighlight } from './highlight.mjs';

test('highlight: returns a function', async () => {
  const fn = await createHighlight();
  assert.equal(typeof fn, 'function');
});

test('highlight: bash code → shiki spans', async () => {
  const fn = await createHighlight();
  const html = fn('echo "hello"', 'bash');
  assert.match(html, /<pre[^>]*class="[^"]*shiki/);
  assert.match(html, /style="color:#/);
});

test('highlight: json code', async () => {
  const fn = await createHighlight();
  const html = fn('{"a": 1}', 'json');
  assert.match(html, /<pre[^>]*class="[^"]*shiki/);
  assert.match(html, /"a"/);
});

test('highlight: unknown lang → plaintext fallback (no throw)', async () => {
  const fn = await createHighlight();
  const html = fn('some text', 'unknownlang');
  assert.match(html, /<pre/);
  assert.match(html, /some text/);
});

test('highlight: mermaid lang → empty (handled by mermaid rule)', async () => {
  const fn = await createHighlight();
  const html = fn('sequenceDiagram', 'mermaid');
  assert.equal(html, '');
});

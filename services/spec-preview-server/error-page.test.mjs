import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderErrorPage } from './error-page.mjs';

test('renderErrorPage: gone-unmerged → 410 friendly html', () => {
  const { status, contentType, body } = renderErrorPage('gone-unmerged', { repo: 'r', branch: 'feat/x' });
  assert.equal(status, 410);
  assert.match(contentType, /text\/html/);
  assert.match(body, /已合并并删除|不存在/);     // friendly Chinese copy
  assert.doesNotMatch(body, /<script/i);          // static, no JS
});

test('renderErrorPage: not-in-scope → 404', () => {
  assert.equal(renderErrorPage('not-in-scope', { repo: 'ghost' }).status, 404);
});

test('renderErrorPage: path-not-found → 404, no internal leak', () => {
  const { status, body } = renderErrorPage('path-not-found', { filePath: 'a/b.html' });
  assert.equal(status, 404);
  assert.doesNotMatch(body, /\/var\/lib\/specs/);  // no server paths
});

// M2: token-mint / transient failure must degrade to a friendly 503 (spec §3), not a 500/crash.
test('renderErrorPage: service-unavailable → 503 friendly html', () => {
  const { status, contentType, body } = renderErrorPage('service-unavailable', {});
  assert.equal(status, 503);
  assert.match(contentType, /text\/html/);
  assert.doesNotMatch(body, /<script/i);
  assert.match(body, /稍后重试|暂时无法/);   // friendly transient copy
});

// Security boundary: request-derived values are HTML-escaped (reflected-XSS guard).
// The angle brackets are the active ingredient — once escaped, the leftover text
// `onerror=alert(1)` is inert plain text, so we assert on the brackets, not the
// substring `onerror=` (which legitimately survives as escaped text).
test('renderErrorPage: crafted filePath is HTML-escaped (no reflected XSS)', () => {
  const { body } = renderErrorPage('path-not-found', { filePath: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(body, /<img/i);              // raw opening tag must NOT appear
  assert.match(body, /&lt;img src=x onerror=alert\(1\)&gt;/); // fully escaped, inert
});

test('renderErrorPage: crafted repo/branch are HTML-escaped', () => {
  const { body } = renderErrorPage('gone-unmerged', { repo: 'a"<b>', branch: 'feat/"x' });
  assert.doesNotMatch(body, /<b>/);
  assert.match(body, /&lt;b&gt;/);
  assert.match(body, /&quot;/);
});

test('renderErrorPage: unknown kind → generic 500', () => {
  const { status, contentType, body } = renderErrorPage('totally-unknown', {});
  assert.equal(status, 500);
  assert.match(contentType, /text\/html/);
  assert.doesNotMatch(body, /<script/i);
});

test('renderErrorPage: contentType is html charset utf-8 for every kind', () => {
  for (const kind of ['gone-unmerged', 'not-in-scope', 'path-not-found', 'service-unavailable', 'whatever']) {
    assert.equal(renderErrorPage(kind, {}).contentType, 'text/html; charset=utf-8');
  }
});

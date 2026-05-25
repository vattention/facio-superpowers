// highlight.mjs — shiki integration with cached highlighter.
// markdown-it expects `highlight(code, lang)` returning HTML or empty string.
// Returning '' lets markdown-it fall back to default fence rendering,
// which mermaid.mjs uses for lang=mermaid.

import { createHighlighter } from 'shiki';

const LANGS = [
  'bash', 'shell', 'sh',
  'json', 'yaml', 'toml',
  'javascript', 'typescript', 'tsx',
  'markdown', 'md',
  'html', 'css',
  'python', 'go', 'rust',
  'sql', 'diff', 'plaintext',
];
const THEME = 'light-plus';

let highlighterPromise = null;
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: [THEME], langs: LANGS });
  }
  return highlighterPromise;
}

export async function createHighlight() {
  const hl = await getHighlighter();
  return function highlight(code, lang) {
    if (lang === 'mermaid') return '';
    const resolvedLang = LANGS.includes(lang) ? lang : 'plaintext';
    const displayLang = lang || 'text';
    try {
      const inner = hl.codeToHtml(code, { lang: resolvedLang, theme: THEME });
      // v2.6.1: wrap with .code-block so CSS can render a lang chip via data-lang
      return `<div class="code-block" data-lang="${escapeAttr(displayLang)}">${inner}</div>`;
    } catch {
      const escaped = code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      return `<div class="code-block" data-lang="${escapeAttr(displayLang)}"><pre><code>${escaped}</code></pre></div>`;
    }
  };
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

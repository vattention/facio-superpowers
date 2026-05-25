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
    try {
      return hl.codeToHtml(code, { lang: resolvedLang, theme: THEME });
    } catch {
      const escaped = code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      return `<pre><code>${escaped}</code></pre>`;
    }
  };
}

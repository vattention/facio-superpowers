// mermaid.mjs — fence rule for lang=mermaid + UMD asset accessor.
//
// Render-time: emit <pre class="mermaid">{raw source}</pre>.
// Template assembly: inject getMermaidRuntimeScript() as <script>.
// Browser-time: mermaid.initialize({startOnLoad:true}) scans + renders SVG.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In dev (src/generate-spec-html/mermaid.mjs):  ../../vendor/mermaid.min.js
// In bundled (templates/scripts-generate-spec-html.mjs): ./vendor-mermaid.min.js
const CANDIDATES = [
  path.join(__dirname, '..', '..', 'vendor', 'mermaid.min.js'),
  path.join(__dirname, 'vendor-mermaid.min.js'),
];

let cachedRuntime = null;
export function getMermaidRuntimeScript() {
  if (cachedRuntime === null) {
    const found = CANDIDATES.find(p => existsSync(p));
    if (!found) throw new Error(`mermaid UMD not found in candidates: ${CANDIDATES.join(', ')}`);
    cachedRuntime = readFileSync(found, 'utf8');
  }
  return cachedRuntime;
}

export function installMermaidRule(md) {
  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const info = (token.info || '').trim();
    if (info === 'mermaid') {
      return `<pre class="mermaid">\n${token.content}</pre>\n`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };
}

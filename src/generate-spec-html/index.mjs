// generate-spec-html v2 — entry point.
// Note: shebang line is added at bundle time by scripts/build-generator.mjs (banner.js).
// Renders L2 spec.md → self-contained HTML with markdown-it + shiki + mermaid.
//
// CLI: node generate-spec-html.mjs <spec.md path>
// Programmatic: import { renderSpec } from './index.mjs'

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createParser } from './parser.mjs';
import { wrapHtml } from './template.mjs';

export async function renderSpec(specMdAbsPath) {
  const raw = readFileSync(specMdAbsPath, 'utf8');
  const { frontmatter, body } = stripFrontmatter(raw);
  const parser = await createParser();
  const renderedBody = parser.render(body);
  const sha = createHash('sha256').update(raw).digest('hex');
  return wrapHtml({
    title: extractTitle(body) ?? path.basename(specMdAbsPath, '.md'),
    body: renderedBody,
    frontmatter,
    sourceFilename: path.basename(specMdAbsPath),
    sha,
  });
}

function stripFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw };
  return { frontmatter: parseYamlFrontmatter(m[1]), body: m[2] };
}

function parseYamlFrontmatter(yaml) {
  const out = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function extractTitle(body) {
  const m = body.match(/^#\s+(.+?)$/m);
  return m ? m[1].trim() : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , specPath] = process.argv;
  if (!specPath) {
    console.error('Usage: generate-spec-html.mjs <spec.md path>');
    process.exit(1);
  }
  const abs = path.resolve(specPath);
  const outPath = abs.replace(/\.md$/, '.html');
  renderSpec(abs)
    .then(html => {
      writeFileSync(outPath, html, 'utf8');
      const sha = createHash('sha256').update(readFileSync(abs)).digest('hex');
      console.log(`✓ wrote ${outPath}`);
      console.log(`  sha256(${path.basename(abs)}) = ${sha}`);
    })
    .catch(err => { console.error(err); process.exit(1); });
}

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
import { computeMetrics } from './metrics.mjs';

export async function renderSpec(specMdAbsPath) {
  const raw = readFileSync(specMdAbsPath, 'utf8');
  const { frontmatter, frontmatterText, body } = stripFrontmatter(raw);
  const title = extractTitle(body) ?? path.basename(specMdAbsPath, '.md');
  const metrics = computeMetrics(body, frontmatterText);
  const parser = await createParser();
  const env = {};
  // The shell (wrapHtml) already renders the title as <h1> with status badges,
  // so drop the body's leading "# Title" to avoid a duplicated heading.
  let renderedBody = parser.render(stripLeadingH1(body), env);
  // Sections are derived from h2 headings, so the last one is never closed by a
  // following section — close its trailing wrapper here. See custom-rules.mjs.
  const trailingClose = env._customRules?.openSection;
  if (trailingClose) renderedBody += trailingClose;
  const sha = createHash('sha256').update(raw).digest('hex');
  return wrapHtml({
    title,
    body: renderedBody,
    frontmatter,
    metrics,
    sourceFilename: path.basename(specMdAbsPath),
    sha,
  });
}

function stripFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, frontmatterText: '', body: raw };
  return { frontmatter: parseYamlFrontmatter(m[1]), frontmatterText: m[1], body: m[2] };
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

// Remove a single leading top-level "# Title" (the shell renders it separately).
// Only strips a level-1 heading that is the first non-blank line, leaving any
// later "#" content and all h2+ sections untouched.
function stripLeadingH1(body) {
  return body.replace(/^\s*#\s+.+?(?:\r?\n|$)/, '');
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

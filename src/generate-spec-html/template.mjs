// template.mjs — HTML shell with inlined CSS + mermaid runtime + status footer.
import { getMermaidRuntimeScript } from './mermaid.mjs';

const STATUS_COLOR = {
  draft: '#94a3b8', ratified: '#10b981', implementing: '#f59e0b',
  merged: '#6366f1', archived: '#78716c', rejected: '#ef4444',
};

const CSS = `
:root { --bg:#fafaf9; --fg:#1c1917; --muted:#78716c; --border:#e7e5e4; --code-bg:#f5f5f4; }
body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 920px; margin: 2rem auto; padding: 0 1.5rem; background: var(--bg); color: var(--fg); }
h1 { font-size: 2rem; margin-bottom: .25rem; }
.meta { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1.5rem; }
.badge { display: inline-block; padding: .2rem .6rem; border-radius: 9999px; font-size: .85rem; color: white; font-weight: 600; }
.section, details.section { margin: 2rem 0; padding: 1rem 1.25rem; background: white; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.section h2, details.section summary { font-size: 1.4rem; padding-left: .75rem; cursor: pointer; }
details.section summary { list-style: none; }
details.section[open] summary { margin-bottom: .75rem; }
.tag { color: white; font-size: .8em; padding: .15em .5em; border-radius: 4px; margin-right: .5em; }
h3 { font-size: 1.1rem; margin-top: 1.25rem; color: var(--muted); }
blockquote { border-left: 4px solid #d6d3d1; padding-left: 1rem; color: var(--muted); margin: 1rem 0; }
pre { background: var(--code-bg); padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: .9em; }
pre.shiki { padding: 1rem; border-radius: 6px; }
pre.mermaid { background: white; padding: 1rem; border-radius: 6px; border: 1px solid var(--border); text-align: center; max-width: 720px; margin: 1rem auto; }
code { background: var(--code-bg); padding: .1em .3em; border-radius: 3px; font-size: .9em; }
pre code { background: transparent; padding: 0; }
ul { padding-left: 1.5rem; }
li.ac-card { display: block; padding: .5rem .75rem; margin: .25rem 0; background: #f0f9ff; border-left: 3px solid #0284c7; border-radius: 4px; list-style: none; }
li.ac-card::before { content: "☐ "; color: #0369a1; font-weight: 600; }
li.diff-added { padding: .25rem .75rem; margin: .15rem 0; background: #ecfdf5; border-left: 3px solid #10b981; list-style: none; }
li.diff-modified { padding: .25rem .75rem; margin: .15rem 0; background: #fef9c3; border-left: 3px solid #ca8a04; list-style: none; }
li.diff-removed { padding: .25rem .75rem; margin: .15rem 0; background: #fee2e2; border-left: 3px solid #ef4444; list-style: none; text-decoration: line-through; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid var(--border); padding: .5em .75em; text-align: left; }
th { background: var(--code-bg); }
.footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--muted); font-size: .85rem; }
`;

export function wrapHtml({ title, body, frontmatter, sourceFilename, sha }) {
  const status = frontmatter.status || 'draft';
  const tier = frontmatter.tier || '';
  const statusColor = STATUS_COLOR[status] || '#94a3b8';
  const mermaidRuntime = getMermaidRuntimeScript();

  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">
  <span class="badge" style="background:${statusColor}">${escapeHtml(status)}</span>
  ${tier ? `<span class="badge" style="background:#475569">${escapeHtml(tier)}</span>` : ''}
</div>
${body}
<div class="footer">
  Generated from <code>${escapeHtml(sourceFilename)}</code> · sha256: <code>${sha}</code> · status: <strong style="color:${statusColor}">${escapeHtml(status)}</strong>
</div>
<script>${mermaidRuntime}</script>
<script>
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });
  }
</script>
</body>
</html>
`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

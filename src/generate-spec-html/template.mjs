// template.mjs — HTML shell with inlined CSS + mermaid runtime + status footer.
import { getMermaidRuntimeScript } from './mermaid.mjs';

const STATUS_COLOR = {
  draft: '#94a3b8', ratified: '#10b981', implementing: '#f59e0b',
  merged: '#6366f1', archived: '#78716c', rejected: '#ef4444',
};

const CSS = `
:root { --bg:#fafaf9; --fg:#1c1917; --muted:#78716c; --border:#e7e5e4; --code-bg:#f5f5f4; }
* { box-sizing: border-box; }
body { font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 900px; margin: 1.5rem auto; padding: 0 1.5rem 4rem; background: var(--bg); color: var(--fg); }
h1 { font-size: 1.7rem; margin-bottom: .5rem; }
.meta { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: .75rem; }
.badge { display: inline-block; padding: .2rem .6rem; border-radius: 9999px; font-size: .85rem; color: white; font-weight: 600; }

/* === Summary dashboard — at-a-glance chips === */
.dashboard { display: flex; flex-wrap: wrap; gap: .4rem; align-items: stretch; margin: 0 0 1.75rem; padding: .55rem .7rem; background: #fff; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,.04); font-size: .82rem; }
.dashboard .chip { display: inline-flex; align-items: center; gap: .35em; padding: .2rem .6rem; border-radius: 9999px; font-weight: 600; white-space: nowrap; }
.dashboard .chip .k { color: var(--muted); font-weight: 500; }
.dashboard .chip.plain { background: var(--code-bg); color: var(--fg); }
.dashboard .chip.good { background: #ecfdf5; color: #047857; }
.dashboard .chip.warn { background: #fffbeb; color: #b45309; }
.dashboard .dash-sep { width: 1px; background: var(--border); margin: .1rem .1rem; }

.section, details.section { margin: 1.1rem 0; padding: .85rem 1.1rem; background: white; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.section h2, details.section summary { font-size: 1.2rem; padding-left: .75rem; cursor: pointer; }
details.section summary { list-style: none; }
details.section[open] summary { margin-bottom: .6rem; }
.tag { color: white; font-size: .78em; padding: .16em .5em; border-radius: 4px; margin-right: .5em; font-weight: 700; }
h3 { font-size: 1rem; margin-top: 1rem; color: var(--muted); }

/* === Empty section collapsed to a one-line verdict === */
.section.empty { display: flex; align-items: center; gap: .55rem; padding: .6rem 1.1rem; }
.section.empty .tag { margin-right: 0; }
.section.empty .empty-title { font-weight: 600; font-size: 1.05rem; }
.section.empty .empty-verdict { margin-left: auto; display: inline-flex; align-items: center; gap: .35em; color: #047857; background: #ecfdf5; padding: .18rem .65rem; border-radius: 9999px; font-size: .8rem; font-weight: 600; }
details.section.empty-body { margin-top: -.7rem; border: 1px dashed var(--border); box-shadow: none; background: #fcfcfb; }
details.section.empty-body > summary { font-size: .8rem; color: var(--muted); padding-left: .25rem; }
details.section.empty-body .section-body { font-size: .9em; }

/* === §4 open issues → amber warning rows === */
details.section[data-tag="§4"] .section-body ul { padding-left: 0; }
details.section[data-tag="§4"] .section-body > ul > li { list-style: none; padding: .35rem .7rem; margin: .3rem 0; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; }
blockquote { border-left: 4px solid #d6d3d1; padding-left: 1rem; color: var(--muted); margin: 1rem 0; }
a { color: #0369a1; text-decoration: none; }
a:hover { text-decoration: underline; }

/* === Code blocks with language chip === */
.code-block { position: relative; margin: 1rem 0; }
.code-block::before {
  content: attr(data-lang);
  position: absolute;
  top: .35rem;
  right: .5rem;
  font-size: .7rem;
  color: var(--muted);
  background: rgba(255,255,255,0.85);
  padding: .1em .5em;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: .05em;
  font-family: -apple-system, sans-serif;
  font-weight: 500;
  z-index: 1;
  pointer-events: none;
}
.code-block pre, .code-block pre.shiki {
  margin: 0;
  padding: 1.1rem 1rem 1rem 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-size: .9em;
}
pre { background: var(--code-bg); padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: .9em; }
pre.mermaid { background: white; padding: 1rem; border-radius: 6px; border: 1px solid var(--border); text-align: center; max-width: 720px; margin: 1rem auto; }
code { background: var(--code-bg); padding: .1em .3em; border-radius: 3px; font-size: .9em; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
pre code { background: transparent; padding: 0; }

ul, ol { padding-left: 1.5rem; }

/* === AC checklist cards === */
li.ac-card { display: block; padding: .5rem .75rem; margin: .25rem 0; background: #f0f9ff; border-left: 3px solid #0284c7; border-radius: 4px; list-style: none; }
li.ac-card::before { content: "☐ "; color: #0369a1; font-weight: 600; }
li.ac-card code { background: rgba(255,255,255,0.7); }

/* === §5 diff coloring === */
li.diff-added, li.diff-modified, li.diff-removed { padding: .25rem .75rem; margin: .15rem 0; list-style: none; }
li.diff-added { background: #ecfdf5; border-left: 3px solid #10b981; }
li.diff-modified { background: #fef9c3; border-left: 3px solid #ca8a04; }
li.diff-removed { background: #fee2e2; border-left: 3px solid #ef4444; text-decoration: line-through; }
li.diff-added code, li.diff-modified code, li.diff-removed code { background: rgba(255,255,255,0.6); }
/* v2.6.1: muted bullet for "none" markers in §5 — no colored box */
li.diff-none { color: var(--muted); font-style: italic; padding: .25rem 0; list-style: none; }
li.diff-none::before { content: "— "; color: var(--muted); }

/* === Tables === */
table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .92em; }
th, td { border: 1px solid var(--border); padding: .5em .75em; text-align: left; vertical-align: top; }
th { background: var(--code-bg); font-weight: 600; }

/* === Footer === */
.footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--muted); font-size: .85rem; }

/* === TOC sidebar (desktop ≥1280px) === */
.toc {
  position: fixed;
  top: 2rem;
  left: max(1rem, calc((100vw - 920px) / 2 - 240px));
  width: 220px;
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
  font-size: .85rem;
  padding: .75rem .25rem;
  border-right: 1px solid var(--border);
  display: none;
}
@media (min-width: 1280px) { .toc { display: block; } }
.toc-title { font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; font-size: .7rem; margin-bottom: .5rem; padding-left: .25rem; }
.toc ul { list-style: none; padding-left: 0; margin: 0; }
.toc li { margin: .15rem 0; }
.toc a { display: block; padding: .15rem .5rem; color: var(--muted); border-left: 2px solid transparent; line-height: 1.3; }
.toc a:hover { color: var(--fg); border-left-color: #d6d3d1; text-decoration: none; }
.toc a.toc-h3 { padding-left: 1.25rem; font-size: .8rem; }
.toc a.active { color: var(--fg); border-left-color: #0ea5e9; font-weight: 500; }
`;

// Client-side TOC + scroll-spy. Auto-discovers h2/h3 with id attribute.
const TOC_SCRIPT = `
(function buildToc() {
  if (window.innerWidth < 1280) return;
  const headings = document.querySelectorAll('h2[id], summary[id], h3[id], .empty-title[id]');
  if (headings.length < 3) return;
  const nav = document.createElement('nav');
  nav.className = 'toc';
  nav.innerHTML = '<div class="toc-title">On this page</div><ul></ul>';
  const ul = nav.querySelector('ul');
  headings.forEach(h => {
    // Skip sub-headings folded inside a collapsed empty section — that's the noise
    // we removed from the body; don't reintroduce it in the nav.
    if (h.closest('.empty-body')) return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent.replace(/^§[1-9K]\\s+/, '').trim();
    if (h.tagName === 'H3') a.className = 'toc-h3';
    a.dataset.target = h.id;
    li.appendChild(a);
    ul.appendChild(li);
  });
  document.body.appendChild(nav);
  // Simple scroll-spy
  const links = nav.querySelectorAll('a');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.toggle('active', l.dataset.target === e.target.id));
      }
    });
  }, { rootMargin: '-30% 0px -65% 0px' });
  headings.forEach(h => io.observe(h));
})();
`;

export function wrapHtml({ title, body, frontmatter, metrics, sourceFilename, sha }) {
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
${renderDashboard({ status, statusColor, tier, metrics })}
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
<script>${TOC_SCRIPT}</script>
</body>
</html>
`;
}

// Render the at-a-glance summary strip. Falls back gracefully if metrics absent.
function renderDashboard({ status, statusColor, tier, metrics }) {
  const m = metrics || {};
  const l1 = m.l1 || { added: 0, modified: 0, removed: 0 };
  const l1Total = (l1.added || 0) + (l1.modified || 0) + (l1.removed || 0);
  const chips = [];
  chips.push(`<span class="chip" style="background:${statusColor};color:#fff">${escapeHtml(status)}</span>`);
  if (tier) chips.push(`<span class="chip plain">${escapeHtml(tier)} Tier</span>`);
  chips.push('<span class="dash-sep"></span>');
  if (typeof m.ac === 'number') chips.push(`<span class="chip plain"><span class="k">AC</span> ${m.ac}</span>`);
  chips.push(`<span class="chip ${l1Total === 0 ? 'good' : 'plain'}"><span class="k">L1</span> +${l1.added || 0} ~${l1.modified || 0} −${l1.removed || 0}</span>`);
  if (m.openIssues) chips.push(`<span class="chip warn"><span class="k">Open Issues</span> ${m.openIssues}</span>`);
  else chips.push(`<span class="chip good"><span class="k">Open Issues</span> 0</span>`);
  if (typeof m.docs === 'number') chips.push(`<span class="chip plain"><span class="k">Docs</span> ${m.docs}</span>`);
  if (m.owners && m.owners.length) {
    chips.push('<span class="dash-sep"></span>');
    chips.push(`<span class="chip plain"><span class="k">owner</span> ${m.owners.map(escapeHtml).join(' · ')}</span>`);
  }
  return `<div class="dashboard">${chips.join('')}</div>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

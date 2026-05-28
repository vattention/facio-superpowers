// error-page.mjs — friendly, self-contained HTML for human-facing failure states.
//
// Audience: non-developer 飞书 reviewers viewing a spec in a browser (behind
// Cloudflare Access). Instead of plain-text "410 ..." responses, render a small
// static page with a clear next step.
//
// Pure function, no I/O, ZERO npm deps. Wiring into the handler is Task 8.
//
//   renderErrorPage(kind, ctx) → { status, contentType, body }
//
// Security: every request-derived value (repo / branch / filePath) is
// HTML-escaped before interpolation to prevent reflected XSS. No <script>,
// no inline event handlers, and never any server-internal absolute paths.

const CONTENT_TYPE = 'text/html; charset=utf-8';

// HTML-escape for text/attribute context. Order matters: & first.
function esc(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// kind → { status, title, headline, body-lines builder }.
// `detail` is optional escaped HTML shown in a muted block (e.g. the file path).
const KINDS = {
  'gone-unmerged': (ctx) => ({
    status: 410,
    title: '链接已失效',
    headline: '该链接对应的分支已不存在',
    lines: [
      '这份 spec 对应的分支可能已合并并删除，所以预览链接已失效。',
      '请向作者索取最新的预览链接，或直接到对应的 PR 中查看。',
    ],
    detail: ctx.repo || ctx.branch
      ? `仓库：${esc(ctx.repo)}${ctx.branch ? `　分支：${esc(ctx.branch)}` : ''}`
      : '',
  }),
  'not-in-scope': (ctx) => ({
    status: 404,
    title: '无法预览',
    headline: '该仓库不在可预览范围',
    lines: [
      '该仓库不在当前可预览的范围内，可能尚未授权预览服务访问。',
      '如确需预览，请联系作者或管理员开启该仓库的预览权限。',
    ],
    detail: ctx.repo ? `仓库：${esc(ctx.repo)}` : '',
  }),
  'path-not-found': (ctx) => ({
    status: 404,
    title: '文件未找到',
    headline: '文件未找到',
    lines: [
      '在该分支中没有找到这个文件，可能文件名有变化或尚未提交。',
      '请向作者确认正确的预览链接。',
    ],
    detail: ctx.filePath ? `文件：${esc(ctx.filePath)}` : '',
  }),
  'service-unavailable': () => ({
    status: 503,
    title: '服务暂时不可用',
    headline: '服务暂时无法访问该仓库',
    lines: [
      '预览服务暂时无法访问该仓库，这通常是临时问题。',
      '请稍后重试；如果持续无法访问，请联系管理员。',
    ],
    detail: '',
  }),
};

function generic() {
  return {
    status: 500,
    title: '出错了',
    headline: '页面无法显示',
    lines: [
      '预览服务遇到了一个意外问题，无法显示这个页面。',
      '请稍后重试，或联系作者获取最新的预览链接。',
    ],
    detail: '',
  };
}

function page({ title, headline, lines, detail }) {
  const paragraphs = lines.map((l) => `    <p>${esc(l)}</p>`).join('\n');
  // `detail` is already escaped by the kind builder (it embeds escaped values).
  const detailBlock = detail ? `\n    <div class="detail">${detail}</div>` : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${esc(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0; min-height: 100vh; display: flex;
      align-items: center; justify-content: center;
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      background: #f6f7f9; color: #1f2329; line-height: 1.6;
    }
    .card {
      max-width: 28rem; margin: 1.5rem; padding: 2rem 2.25rem;
      background: #fff; border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06);
    }
    h1 { margin: 0 0 .75rem; font-size: 1.25rem; }
    p { margin: .5rem 0; color: #4e5969; }
    .detail {
      margin-top: 1rem; padding: .625rem .75rem;
      background: #f2f3f5; border-radius: 8px;
      font-size: .8125rem; color: #86909c; word-break: break-all;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #17171a; color: #e5e6eb; }
      .card { background: #1f1f23; box-shadow: none; border: 1px solid #2a2a30; }
      p { color: #a6a9b0; }
      .detail { background: #2a2a30; color: #8a8f99; }
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>${esc(headline)}</h1>
${paragraphs}${detailBlock}
  </main>
</body>
</html>
`;
}

export function renderErrorPage(kind, ctx = {}) {
  const build = KINDS[kind] || generic;
  const spec = build(ctx);
  return { status: spec.status, contentType: CONTENT_TYPE, body: page(spec) };
}

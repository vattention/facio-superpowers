// custom-rules.mjs — L2 spec-aware renderer customizations.
// Preserves v1 generator's visual conventions:
//   § tag prefix in heading gets visual badge
//   §4/§7 sections wrap in <details>/<summary> for folding
//   §5 ADDED/MODIFIED/REMOVED bullets get colored diff classes
//   AC checklist items get .ac-card wrapper

const SECTION_COLORS = {
  '§1': '#0ea5e9', '§2': '#a855f7', '§3': '#10b981',
  '§4': '#f59e0b', '§5': '#ef4444', '§6': '#6366f1',
  '§7': '#78716c', '§K': '#14b8a6',
};

const COLLAPSIBLE_SECTIONS = new Set(['§4', '§7']);

export function installCustomRules(md) {
  // Per-render state (using env namespace to support concurrent renders)
  function getState(env) {
    if (!env._customRules) env._customRules = { section: null, h3: null, inCollapsible: false };
    return env._customRules;
  }

  const defaultRender = (tokens, idx, options, env, self) => self.renderToken(tokens, idx, options);

  // heading_open: detect § tag, open collapsible vs normal wrapper
  md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
    const st = getState(env);
    const token = tokens[idx];
    const next = tokens[idx + 1];
    const text = (next?.content || '').trim();
    const sectionMatch = text.match(/^(§[1-9K])\s+(.*)$/);

    if (token.tag === 'h2' && sectionMatch) {
      const tag = sectionMatch[1];
      const rest = sectionMatch[2];
      st.section = tag;
      st.h3 = null;
      const color = SECTION_COLORS[tag] || '#475569';

      // Strip default text rendering; we emit the badge + rest manually
      if (next) {
        next.children = [{
          type: 'html_inline',
          content: `<span class="tag" style="background:${color}">${tag}</span> ${escapeHtml(rest)}`,
          level: next.level,
        }];
      }

      // Preserve any attrs added by upstream plugins (e.g. anchor plugin sets id)
      const idAttr = token.attrGet('id');
      const idStr = idAttr ? ` id="${escapeHtml(idAttr)}"` : '';

      if (COLLAPSIBLE_SECTIONS.has(tag)) {
        st.inCollapsible = true;
        return `<details class="section" data-tag="${tag}" open><summary${idStr} style="border-left:6px solid ${color}">`;
      }
      return `<section class="section" data-tag="${tag}"><h2${idStr} style="border-left:6px solid ${color}">`;
    }

    if (token.tag === 'h3') {
      st.h3 = text;
    }

    return defaultRender(tokens, idx, options, env, self);
  };

  md.renderer.rules.heading_close = function (tokens, idx, options, env, self) {
    const st = getState(env);
    const token = tokens[idx];
    if (token.tag === 'h2' && st.section) {
      if (st.inCollapsible) {
        return `</summary><div class="section-body">`;
      }
      return `</h2>`;
    }
    return defaultRender(tokens, idx, options, env, self);
  };

  // list_item_open: apply diff classes in §5; AC card classes anywhere
  md.renderer.rules.list_item_open = function (tokens, idx, options, env, self) {
    const st = getState(env);
    const inlineTok = tokens.slice(idx + 1, idx + 5).find(t => t.type === 'inline');
    const inlineContent = inlineTok?.content || '';

    if (st.section === '§5' && st.h3) {
      // v2.6.1: suppress colored diff box when content is just a "none" marker —
      // avoids the "empty colored box looks like real content" UX trap.
      if (isNoneMarker(inlineContent)) {
        return `<li class="diff-none">`;
      }
      let cls = 'diff-neutral';
      if (/ADDED/i.test(st.h3)) cls = 'diff-added';
      else if (/MODIFIED/i.test(st.h3)) cls = 'diff-modified';
      else if (/REMOVED/i.test(st.h3)) cls = 'diff-removed';
      return `<li class="${cls}">`;
    }
    if (/\*\*AC-\d+\*\*/.test(inlineContent)) {
      return `<li class="ac-card">`;
    }
    return defaultRender(tokens, idx, options, env, self);
  };
}

// Detect "no content" markers used in spec sections that are otherwise empty.
// Covers Chinese / English / N/A short forms.
function isNoneMarker(text) {
  const normalized = (text || '').trim().replace(/[（）()]/g, '');
  return /^(无|空|none|n\/a|na)\.?$/i.test(normalized);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

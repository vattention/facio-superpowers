// custom-rules.mjs — L2 spec-aware renderer customizations.
// Preserves v1 generator's visual conventions:
//   § tag prefix in heading gets visual badge
//   §4/§7 sections wrap in <details>/<summary> for folding
//   §5 ADDED/MODIFIED/REMOVED bullets get colored diff classes
//   AC checklist items get .ac-card wrapper
// v2.7: a §-section whose entire body is "no change" collapses to a one-line
//   verdict (its content is kept, folded away) — kills the "screen of None" noise.

const SECTION_COLORS = {
  '§1': '#0ea5e9', '§2': '#a855f7', '§3': '#10b981',
  '§4': '#f59e0b', '§5': '#ef4444', '§6': '#6366f1',
  '§7': '#78716c', '§K': '#14b8a6',
};

const COLLAPSIBLE_SECTIONS = new Set(['§4', '§7']);
// Sections eligible for whole-section "empty → one line" collapse. §5 (L1 Impact)
// is the frequent offender: when a change has no capability/requirement impact it
// renders five sub-headings each saying "None".
const EMPTY_COLLAPSIBLE_SECTIONS = new Set(['§5']);

export function installCustomRules(md) {
  // Pre-scan pass: flag any EMPTY_COLLAPSIBLE section whose non-heading content is
  // entirely "no change". Sets token.meta.emptySection so heading_open can render
  // the compact verdict form. Runs after inline parsing so token.content is filled.
  md.core.ruler.push('flag_empty_sections', function flagEmptySections(state) {
    const t = state.tokens;
    for (let i = 0; i < t.length; i++) {
      if (t[i].type !== 'heading_open' || t[i].tag !== 'h2') continue;
      const inline = t[i + 1];
      const tag = (inline?.content || '').trim().match(/^(§[1-9K])\s/)?.[1];
      if (!tag || !EMPTY_COLLAPSIBLE_SECTIONS.has(tag)) continue;

      let sawContent = false;
      let hasRealContent = false;
      for (let j = i + 3; j < t.length; j++) {
        if (t[j].type === 'heading_open' && t[j].tag === 'h2') break; // next section
        // Only weigh inline text that is body content, not a sub-heading (h3) title.
        if (t[j].type === 'inline' && t[j - 1]?.type !== 'heading_open') {
          sawContent = true;
          if (!isEffectivelyNone(t[j].content)) { hasRealContent = true; break; }
        }
      }
      if (sawContent && !hasRealContent) {
        t[i].meta = { ...(t[i].meta || {}), emptySection: true };
      }
    }
  });

  // Per-render state (using env namespace to support concurrent renders).
  // openSection: the closing markup owed for the currently-open § wrapper,
  //   or null when no section is open. This is what lets each new section
  //   close the previous one, and lets renderSpec() close the trailing one.
  function getState(env) {
    if (!env._customRules) env._customRules = { section: null, h3: null, openSection: null, emptyHeading: false };
    return env._customRules;
  }

  const defaultRender = (tokens, idx, options, env, self) => self.renderToken(tokens, idx, options);

  // heading_open: detect § tag, open collapsible vs normal wrapper.
  // Sections are derived from h2 headings (markdown-it emits no section tokens),
  // so each new section must first close the previous one, and the last open
  // section is closed by renderSpec() using env._customRules.openSection.
  md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
    const st = getState(env);
    const token = tokens[idx];
    const next = tokens[idx + 1];
    const text = (next?.content || '').trim();
    const sectionMatch = text.match(/^(§[1-9K])\s+(.*)$/);

    if (token.tag === 'h2' && sectionMatch) {
      const tag = sectionMatch[1];
      const rest = sectionMatch[2];
      const collapsible = COLLAPSIBLE_SECTIONS.has(tag);
      const color = SECTION_COLORS[tag] || '#475569';

      // Close the previous § wrapper (if any) before opening this one.
      const closePrev = st.openSection || '';

      st.section = tag;
      st.h3 = null;
      st.emptyHeading = false;

      // Preserve any attrs added by upstream plugins (e.g. anchor plugin sets id)
      const idAttr = token.attrGet('id');
      const idStr = idAttr ? ` id="${escapeHtml(idAttr)}"` : '';

      // Empty section → compact one-line verdict + its content folded into a <details>.
      // We emit the summary text ourselves, so blank the inline heading token and
      // swallow its heading_close (handled below via emptyHeading).
      if (token.meta?.emptySection) {
        st.openSection = '</div></details>';
        st.emptyHeading = true;
        if (next) next.children = [];
        return `${closePrev}<div class="section empty" data-tag="${tag}">` +
          `<span class="tag" style="background:${color}">${tag}</span>` +
          `<span class="empty-title"${idStr}>${escapeHtml(rest)}</span>` +
          `<span class="empty-verdict">✓ 无影响</span></div>` +
          `<details class="section empty-body" data-tag="${tag}"><summary>展开细节</summary><div class="section-body">`;
      }

      // heading_close reads this to pick the matching close tag, and it stays
      // set so the next section — or renderSpec() at the end — closes us.
      st.openSection = collapsible ? '</div></details>' : '</section>';

      // Strip default text rendering; we emit the badge + rest manually
      if (next) {
        next.children = [{
          type: 'html_inline',
          content: `<span class="tag" style="background:${color}">${tag}</span> ${escapeHtml(rest)}`,
          level: next.level,
        }];
      }

      if (collapsible) {
        return `${closePrev}<details class="section" data-tag="${tag}" open><summary${idStr} style="border-left:6px solid ${color}">`;
      }
      return `${closePrev}<section class="section" data-tag="${tag}"><h2${idStr} style="border-left:6px solid ${color}">`;
    }

    if (token.tag === 'h3') {
      st.h3 = text;
    }

    return defaultRender(tokens, idx, options, env, self);
  };

  md.renderer.rules.heading_close = function (tokens, idx, options, env, self) {
    const st = getState(env);
    const token = tokens[idx];
    // Only the section-defining h2 (the one that just set openSection) gets the
    // special close; a collapsible section swaps </h2> for </summary> + body div.
    if (token.tag === 'h2' && st.section) {
      if (st.emptyHeading) { st.emptyHeading = false; return ''; } // already rendered inline
      if (st.openSection === '</div></details>') {
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
    if (/\*\*AC-\d+\*\*/.test(inlineContent) || /(?:^|\s)AC-\d+/.test(inlineContent)) {
      return `<li class="ac-card">`;
    }
    return defaultRender(tokens, idx, options, env, self);
  };
}

// Detect "no content" markers used in spec sections that are otherwise empty.
// Covers Chinese / English / N/A short forms.
export function isNoneMarker(text) {
  const normalized = (text || '').trim().replace(/[（）()]/g, '');
  return /^(无|空|none|n\/a|na)\.?$/i.test(normalized);
}

// Broader "this item represents no real change" test, used only for whole-section
// collapse. Catches verbose none forms: "None（解释…）", "暂无… 当前按 None 处理".
// Deliberately conservative: a section only collapses when EVERY item passes, so a
// single real change keeps the section expanded.
export function isEffectivelyNone(text) {
  const t = (text || '').trim();
  if (!t) return true;
  if (isNoneMarker(t)) return true;
  // Leading none-token immediately followed by a bracket / dash / colon (an aside).
  if (/^(none|无|暂无|n\/a)\s*[（(：:—–\-]/i.test(t)) return true;
  // Trailing verdict phrasing: "…当前按 None 处理".
  if (/按\s*none\s*处理/i.test(t)) return true;
  return false;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

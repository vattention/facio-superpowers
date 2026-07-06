// metrics.mjs — compute at-a-glance dashboard numbers from a spec's markdown.
// Pure text analysis (no markdown-it), so it stays cheap and independently testable.
import { isEffectivelyNone } from './custom-rules.mjs';

// Split body into a { '§1': text, '§5': text, ... } map keyed by section tag.
function splitSections(body) {
  const out = {};
  const re = /^##\s+(§[1-9K])\b.*$/gm;
  const marks = [];
  let m;
  while ((m = re.exec(body))) marks.push({ tag: m[1], start: m.index, bodyStart: re.lastIndex });
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].start : body.length;
    out[marks[i].tag] = body.slice(marks[i].bodyStart, end);
  }
  return out;
}

// Text of a single "### Name" subsection within a section body.
function subsection(sectionText, name) {
  const re = new RegExp(`^###\\s+${name}\\b.*$`, 'm');
  const m = re.exec(sectionText || '');
  if (!m) return '';
  const start = m.index + m[0].length;
  const nextH3 = /^###\s+/m.exec(sectionText.slice(start));
  return nextH3 ? sectionText.slice(start, start + nextH3.index) : sectionText.slice(start);
}

const listItems = (text) => (text || '').match(/^[ \t]*[-*]\s+.+$/gm) || [];
const itemText = (li) => li.replace(/^[ \t]*[-*]\s+/, '').replace(/^\[.\]\s*/, '').trim();
const realItems = (text) => listItems(text).filter((li) => !isEffectivelyNone(itemText(li)));

// frontmatter is the raw YAML block text (nested keys aren't flattened by the
// generator's simple parser, so we scan it directly for owner roles).
export function computeMetrics(body, frontmatterText = '') {
  const sec = splitSections(body);

  const s5 = sec['§5'] || '';
  const l1 = {
    added: realItems(subsection(s5, 'ADDED Requirements')).length
         + realItems(subsection(s5, 'ADDED Scenarios')).length,
    modified: realItems(subsection(s5, 'MODIFIED Requirements')).length,
    removed: realItems(subsection(s5, 'REMOVED Requirements')).length,
  };

  const ac = new Set((sec['§1'] || '').match(/AC-\d+/g) || []).size;
  const openIssues = listItems(sec['§4'] || '').length;
  const docs = listItems(subsection(sec['§7'] || '', '受影响文档')).length;

  const owners = [];
  if (/^\s*pm:/m.test(frontmatterText)) owners.push('PM');
  if (/^\s*designer:/m.test(frontmatterText)) owners.push('设计');
  if (/^\s*engineer:/m.test(frontmatterText)) owners.push('研发');

  return { ac, l1, openIssues, docs, owners };
}

// parser.mjs — markdown-it instance + plugin wiring.
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItTaskLists from 'markdown-it-task-lists';
import { createHighlight } from './highlight.mjs';
import { installMermaidRule } from './mermaid.mjs';
import { installCustomRules } from './custom-rules.mjs';

export async function createParser() {
  const highlight = await createHighlight();
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    breaks: false,
    highlight,
  });

  md.use(markdownItAnchor, {
    permalink: false,
    slugify: (s) => s.toLowerCase().replace(/[^\w一-鿿]+/g, '-').replace(/(^-|-$)/g, ''),
  });
  md.use(markdownItAttrs);
  md.use(markdownItTaskLists, { enabled: true, label: true });

  installMermaidRule(md);
  installCustomRules(md);

  return md;
}

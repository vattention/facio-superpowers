#!/usr/bin/env node
// build-generator.mjs — bundle src/generate-spec-html/ → templates/scripts-generate-spec-html.mjs
//
// Uses esbuild to inline all node_modules deps (markdown-it + plugins + shiki)
// into a single ES module that consumer projects can run with zero npm install.
//
// Vendored mermaid UMD is copied alongside as templates/vendor-mermaid.min.js
// (resolved at runtime by mermaid.mjs's CANDIDATES lookup).

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { statSync, copyFileSync, chmodSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ENTRY = path.join(ROOT, 'src/generate-spec-html/index.mjs');
const OUT = path.join(ROOT, 'templates/scripts-generate-spec-html.mjs');
const VENDOR_SRC = path.join(ROOT, 'vendor/mermaid.min.js');
const VENDOR_DST = path.join(ROOT, 'templates/vendor-mermaid.min.js');

console.log(`Bundling ${path.relative(ROOT, ENTRY)} → ${path.relative(ROOT, OUT)}`);

await build({
  entryPoints: [ENTRY],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: OUT,
  minify: false,
  sourcemap: false,
  banner: { js: '#!/usr/bin/env node' },
  // shiki ships WASM grammars + JSON themes; treat as external file deps via esbuild loader
  loader: { '.json': 'json' },
});

chmodSync(OUT, 0o755);

copyFileSync(VENDOR_SRC, VENDOR_DST);

const bundleSize = statSync(OUT).size;
const vendorSize = statSync(VENDOR_DST).size;
console.log(`✓ wrote ${path.relative(ROOT, OUT)} (${(bundleSize / 1024 / 1024).toFixed(2)} MB)`);
console.log(`✓ copied ${path.relative(ROOT, VENDOR_DST)} (${(vendorSize / 1024 / 1024).toFixed(2)} MB)`);

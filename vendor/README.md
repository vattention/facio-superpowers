# Vendored Assets

Third-party files vendored here are bundled into shipped artifacts
(currently: `templates/scripts-generate-spec-html.mjs` via `npm run build:generator`).

We vendor rather than depend at consumer install time so that
`facio-superpowers init --harness` keeps zero npm dependencies in
consumer projects.

## Files

| File | Source | Version | License | Why vendored |
|------|--------|---------|---------|--------------|
| `mermaid.min.js` | https://cdn.jsdelivr.net/npm/mermaid@11.3.0/dist/mermaid.min.js | 11.3.0 | MIT | Embedded in spec.html for runtime sequence/flow diagram render; consumer must work offline (no CDN) |

## Upgrade procedure

1. Update version in the table above
2. `curl -L -o <file> <new URL>`
3. Run `npm run test:generator` to verify no regressions
4. Run `npm run build:generator` and inspect bundle size growth
5. Commit with conventional message: `chore(vendor): bump <pkg> to <version>`

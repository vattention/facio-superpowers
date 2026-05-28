import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildCloneUrl } from './github-app.mjs';

const inflight = new Map();

export async function ensureRepo(name, ctx) {
  if (!ctx.isValidRepoName(name)) { const e = new Error(`invalid repo name: ${name}`); e.code = 'INVALID_NAME'; throw e; }
  const dest = join(ctx.cacheDir, name);
  if (existsSync(join(dest, '.git'))) return dest;
  if (inflight.has(dest)) return inflight.get(dest);
  const p = (async () => {
    let token;
    try { token = await ctx.getToken(); }
    catch { const e = new Error('installation token unavailable'); e.code = 'TOKEN_FAILED'; throw e; }
    try {
      // ctx.gitClone MUST be atomic (clone to a temp sibling, then rename to `dest`) so a
      // failed/partial clone never leaves a half-written `dest/.git` that existsSync() would
      // later treat as a valid cached repo. Atomicity lives in the dep (Task 8 wiring).
      await ctx.gitClone(buildCloneUrl({ org: ctx.org, repo: name, token }), dest);
    } catch (err) {
      // Clone failed: most likely non-org / App-not-installed / repo missing → not in scope.
      // Do NOT attach `err` as cause — git error text can echo the token-bearing URL.
      const e = new Error(`repo not in scope: ${name}`); e.code = 'NOT_IN_SCOPE'; throw e;
    }
    return dest;
  })().finally(() => inflight.delete(dest));
  inflight.set(dest, p);
  return p;
}

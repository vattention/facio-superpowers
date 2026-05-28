// git(args) → { code, stdout }. stdout is a Buffer in prod (encoding:'buffer') / string in tests.
// Text callers MUST .toString(); binary file content is passed through untouched.
export async function resolveDefaultBranch({ repoDir, git, fallback = 'main' }) {
  const r = await git(['-C', repoDir, 'symbolic-ref', 'refs/remotes/origin/HEAD']);
  if (r.code === 0) { const m = r.stdout.toString().trim().match(/origin\/(.+)$/); if (m) return m[1]; }
  return fallback;
}

export async function gitShow({ repoDir, branch, filePath, git, defaultFallback = 'main', resolveDefault = resolveDefaultBranch }) {
  // refExists / found derive from git EXIT CODES — never from typeof content.
  // (prod content is a Buffer; a typeof-string check would misclassify EVERY file.)
  const tryRef = async (ref) => {
    const rp = await git(['-C', repoDir, 'rev-parse', '--verify', ref]);
    if (rp.code !== 0) return { refExists: false, found: false };
    const sh = await git(['-C', repoDir, 'show', `${ref}:${filePath}`]);
    return { refExists: true, found: sh.code === 0, content: sh.stdout };
  };
  const onBranch = await tryRef(`origin/${branch}`);
  if (onBranch.refExists) {
    // Branch still present (review phase): serve its file, or 404 —
    // NEVER silently fall back to default while the branch is live.
    return onBranch.found
      ? { status: 'ok', servedFrom: 'branch', content: onBranch.content }
      : { status: 'path-not-found' };
  }
  // Branch ref is gone (merged+deleted, or closed-unmerged) → fall back to default branch.
  // resolveDefault is injectable (server memoizes it per repoDir); defaults to the real one.
  const def = await resolveDefault({ repoDir, git, fallback: defaultFallback });
  const onDefault = await tryRef(`origin/${def}`);
  if (onDefault.found) return { status: 'ok', servedFrom: 'default', content: onDefault.content };
  return { status: 'gone-unmerged' };
}

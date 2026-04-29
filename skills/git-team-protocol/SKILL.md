---
name: git-team-protocol
description: Use when any git operation involves team collaboration — shared branches, merge conflicts, pulling remote changes, reviewing teammate commits, resolving silent overwrites, force-push safety, or establishing team Git rules. Also triggered by "同事改了", "代码被覆盖", "分支冲突", "merge", "pull下来有问题".
---

# Git Team Protocol

## Overview

Git's three-way merge **cannot detect semantic overwrites** — if teammate A pulls your deletion commit then pushes an old file copy, Git sees a "new addition" and accepts it silently. The only defence is process + CI, not Git mechanics.

## Branch Model

```
main / dev          ← protected, PR-only, no direct push
feat/<you>/<topic>  ← your personal short-lived branch (≤3 days)
feat/<shared>       ← team integration branch, also protected
```

**Hard rules:**
- Protected branches: zero direct push, zero force push
- One branch = one topic = one PR
- Open a branch → finish → merge → delete. Never let it live > 3 days

## Daily Workflow

```bash
# Start
git checkout main && git pull --rebase
git checkout -b feat/<you>/<topic>

# Before push — self-check (all 4 required)
yarn tsc --noEmit                        # 1. types must pass
git fetch origin
git diff origin/main...HEAD --name-only  # 2. review scope
git log origin/main..HEAD --oneline      # 3. confirm commit count sane
git rebase origin/main                   # 4. stay linear
yarn tsc --noEmit                        # 5. re-check after rebase

git push -u origin feat/<you>/<topic>
gh pr create --base main
```

## Regression Detector (run before every push)

Catches "my PR silently un-does someone else's recent change":

```bash
# Files recently added to main that my branch removes
git diff origin/main...HEAD --diff-filter=D --name-only

# Lines recently deleted from main that my branch re-adds
git log --oneline -10 origin/main | awk '{print $1}' | xargs -I{} \
  git diff {}^..{} --unified=0 | grep '^-' | grep -Fxf - \
  <(git diff origin/main...HEAD | grep '^+') | head -20
```

If either command returns output: **stop and investigate before pushing.**

Simpler alias to add locally:

```bash
git config --global alias.regcheck \
  "!git fetch origin && git diff origin/main...HEAD --diff-filter=D --name-only && echo '---deleted-check done'"
```

## File-Sync Commit Detection

A file-sync commit signature (warn author, request explanation before merging):

| Signal | Threshold |
|--------|-----------|
| Files changed in one commit | > 15 |
| Message contains `Sync`, `Update from local`, `Batch` | any |
| Author machine name in email (`MacBook`, `DESKTOP-`) | any |
| Diff deletes lines added by a recent merged PR | any |

Review checklist for these PRs:
- Does the diff delete anything merged in the last 5 commits on main?
- Does the diff re-add any import/file that was explicitly removed?
- Run `yarn tsc --noEmit` — does it pass?

## Conflict Handling Protocol

| Conflict type | Rule |
|---|---|
| Non-overlapping edits | Both changes survive — verify manually after rebase |
| You deleted, they re-added | Confirm intent with author before resolving |
| Both edited same function | Align on requirement, keep both behaviours if needed |
| They deleted, you rely on it | Create followup task, don't silently restore |

**Never:** accept-all-ours or accept-all-theirs without reading the diff.

## High-Risk Deletion Protocol

For deleting business logic / public APIs / shared utils — add a tombstone comment before the actual removal PR:

```ts
// DEPRECATED 2026-04-22 @yourname — removing in next PR, do not rely on this
```

This forces Git to see a **line change** in any branch that still has the old line, triggering a real conflict instead of a silent overwrite.

## Branch Protection Settings (GitHub)

Required for `main` and all `feat/*` integration branches:

- ☑ Require PR before merging (approvals ≥ 1)
- ☑ Dismiss stale approvals on new commits
- ☑ Require status checks: `ci/tsc`, `ci/lint`
- ☑ Require branches up to date before merge
- ☑ Require linear history
- ☑ Do not allow bypassing (including admins)

## Minimal CI Gate

```yaml
# .github/workflows/ci.yml
on:
  pull_request:
    branches: [main, 'feat/**']
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: yarn }
      - run: yarn install --immutable
      - run: yarn tsc --noEmit
      - run: yarn lint
```

## Red Lines (immediate revert if violated)

1. Direct push to protected branch
2. File-sync / whole-directory overwrite commit
3. `git push --force` on shared branch
4. Merge without passing CI
5. Resolving conflict with accept-all without reading diff
6. PR open > 3 days without merging or closing

## One-Line Rules to Memorise

> fetch + rebase before push · small commits · delete = tombstone first · all shared branches need PR · CI must pass

---
name: spec-ratifier
description: L2 spec 评审调度 — 按 spec §6 Tier 分发到 PM / 设计 / 研发 (+ 跨产品契约 owner) 评审；收齐 approval 后转 status draft→ratified；重生成 spec.html；触发 Flow MCP notify_spec_event。Triggers when user invokes spec-ratifier explicitly, or spec-author Step 15 hints chain after self-review all-PASS.
---

# Spec Ratifier（3 owner 评审 + status transition）

**Announce at start:** "I'm using the spec-ratifier skill to dispatch ratification review."

spec-ratifier 把 spec-author 起草完毕（status=draft，self-review all-PASS）的 L2 spec 通过 **GitHub PR + Reviews API** 推送给 3 owner 评审：active mode 开 PR 并通过 Lark card 通知 reviewer；resume mode 收齐 PR approvals 后转 status 到 ratified（PR 不 merge，等后续 implementation commits 一起 merge）。

## When to use this skill

spec-ratifier has **two modes** (auto-detected on entry — see Step 0):

- **Active mode** — no PR exists yet for the current branch:
  - spec-author Step 15 hints chain（self-review all-PASS 后）
  - 用户手动说 "ratify spec X" / "把 spec 推给评审"
  - Pushes branch, opens a draft PR, dispatches `review_requested` Lark broadcast, then exits
- **Resume mode** — PR already exists and reviewers have approved on the PR:
  - 用户回来说 "approvals collected, finalize" / "resume spec-ratifier"
  - Reads PR Reviews API, writes approvals.md, flips status draft → ratified, single commit + push (no merge)

## When NOT to use

- status ≠ draft（已 ratified/implementing/etc）→ 不重复 ratify
- self-review 没跑 / 有 FAIL → 先回 spec-author Step 15 修
- 用户想"先讨论一下" → 回 spec-author Step 1 wrap brainstorming
- 当前在 main 分支 → 先切到 feature 分支再 ratify
- 未安装 gh CLI / 未 `gh auth login` → 先安装认证再回来

<HARD-GATE>
spec-ratifier has two modes — auto-detect on entry:

**Active mode** — pre-PR state. Requires:
  1. spec.md frontmatter status: draft
  2. .harness/changes/<change_id>/self-review.md exists with `result: pass`
     and spec_sha matches sha256(spec.md)
  3. FACIO_LARK_WEBHOOK_URL set (via .harness/config.env or shell)
  4. `gh --version` available AND `gh auth status` passes (NEW in v2.4.0)
  5. current branch != main
  6. NO open PR for this branch (else use resume mode)

**Resume mode** — post-dispatch state. Requires:
  1. spec.md frontmatter status: draft (still — flip happens in this mode)
  2. open PR for current branch (gh pr view returns URL)
  3. self-review.md still valid (sha unchanged)
  4. gh CLI auth OK

If neither mode applies, refuse to proceed:
  - missing self-review.md / stale sha → "Re-run spec-author Step 15"
  - missing webhook → ".harness/README.md → Lark webhook 配置"
  - missing gh CLI → "Install gh: macOS `brew install gh`, Linux/Windows see docs; then `gh auth login`"
  - on main → "Refusing to operate on main; create a feature branch first"

You MUST NOT modify spec.md body — only frontmatter `status` field, via
`scripts/spec-status.mjs`.

Resume mode sequence (after collecting 3 PR approvals):
  1. write approvals.md from PR Reviews API data
  2. spec-status.mjs draft → ratified
  3. regen spec.html
  4. single commit (spec.md + spec.html + approvals.md) + push to PR branch
  5. notify_spec_event(ratified, broadcast=false) AFTER commit
     (broadcast=false because ratified is internal milestone per design §5.2)
  6. Do NOT merge the PR — implementation commits will be appended later;
     PR merges once spec + impl + tests are all ready
</HARD-GATE>

## Checklist

You MUST create a TodoWrite task for each step:

**Mode detection (do first, decides which branch below)**

1. **Step 0** — Detect mode: gh pr view → resume if PR open, else active

**Active mode (no PR yet)**

2. **Step 1A** — Pre-check active: status=draft + self-review valid + webhook configured + gh installed + branch != main
3. **Step 2A** — Read tier from §6, derive owner set
4. **Step 3A** — git push -u origin <branch>
5. **Step 4A** — gh pr create --draft + label="spec-review" + PR body template
6. **Step 5A** — Build review_requested lark_card payload
7. **Step 6A** — notify_spec_event(review_requested, pr_url=..., lark_card=...)
8. **Step 7A** — Exit with "PR opened, come back after 3 approvals"

**Resume mode (PR exists)**

2. **Step 1R** — Pre-check resume: PR open + self-review still valid (sha)
3. **Step 2R** — gh pr view --json reviews → confirm 3 owner approvals collected
4. **Step 3R** — Validate review commit_id maps to current spec.md sha
5. **Step 4R** — Write approvals.md from API data (role / approver / spec_sha / timestamp / github_review_id)
6. **Step 5R** — spec-status.mjs write spec.md ratified
7. **Step 6R** — generate-spec-html.mjs spec.md
8. **Step 7R** — Single commit (spec.md + spec.html + approvals.md) + git push
9. **Step 8R** — notify_spec_event(ratified, broadcast=false) — audit only
10. **Step 9R** — Exit hint: Flow Skill HARD-GATE chains to writing-plans

**Important: Resume mode does NOT merge the PR.** Implementation commits will be appended to the same PR by writing-plans / executing-plans; the whole PR (spec + impl) merges as one unit later.

## Step 0 · Mode Detection

```bash
# Run from product repo root
SPEC=docs/superpowers/specs/<slug>.md
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = "main" ] && { echo "✗ refusing to operate on main"; exit 1; }

# gh CLI present?
command -v gh >/dev/null 2>&1 || {
  cat <<'EOF'
✗ gh CLI not installed (required for spec-ratifier active/resume mode)

Install:
  • macOS:   brew install gh
  • Linux:   https://github.com/cli/cli/blob/trunk/docs/install_linux.md
  • Windows: scoop install gh   (or choco install gh)

Then run: gh auth login
EOF
  exit 1
}
gh auth status >/dev/null 2>&1 || { echo "✗ gh not authenticated — run: gh auth login"; exit 1; }

# Mode = resume if PR exists, else active
PR_URL=$(gh pr view --json url -q .url 2>/dev/null || true)
if [ -n "$PR_URL" ]; then
  MODE=resume
else
  MODE=active
fi
echo "→ mode: $MODE"
```

## Step 1 · Pre-check (common + mode-specific)

```bash
# Common pre-check (both modes)
test -f "$SPEC" || { echo "✗ spec not found"; exit 1; }
STATUS=$(grep -E '^status:' "$SPEC" | head -1 | awk '{print $2}')
[ "$STATUS" = "draft" ] || { echo "✗ status=$STATUS, expected draft"; exit 1; }

CHANGE_ID=$(grep -E '^change_id:' "$SPEC" | head -1 | awk '{print $2}')
REVIEW=".harness/changes/$CHANGE_ID/self-review.md"
test -f "$REVIEW" || { echo "✗ self-review.md missing — run spec-author Step 15"; exit 1; }
grep -q '^result: pass' "$REVIEW" || { echo "✗ self-review.result != pass"; exit 1; }
REVIEW_SHA=$(grep -E '^spec_sha:' "$REVIEW" | awk '{print $2}')
CURRENT_SHA=$(shasum -a 256 "$SPEC" | awk '{print $1}')
[ "$REVIEW_SHA" = "$CURRENT_SHA" ] || \
  { echo "✗ self-review stale — re-run Step 15"; exit 1; }

# Auto-source committed harness env defaults
[ -f .harness/config.env ] && set -a && . .harness/config.env && set +a
if [ -z "$FACIO_LARK_WEBHOOK_URL" ]; then
  echo "✗ FACIO_LARK_WEBHOOK_URL not set — see .harness/README.md → Lark webhook 配置"
  exit 1
fi

echo "✓ common pre-check passed (mode=$MODE)"
```

All-`✓` is the only valid entry condition for the chosen mode below.

## Step 2 · Derive Owner Set from Tier (both modes)

读 spec §6 决策（grep `^**决策**：` 或 frontmatter `tier:`）：

| Tier | Owner set |
|------|----------|
| Micro | 单 owner（若 author = engineer → PM / designer 自动 approve）|
| Normal | 3 owner 全 approve（PM + designer + engineer，frontmatter `owners.{pm,designer,engineer}`）|
| Large | 3 owner + 跨产品契约 owner（若 §5 涉及 `blueprint/contracts/`，则从 `blueprint/contracts/CODEOWNERS` 取） |

## Step 3A · Active Mode: Push branch + Open Draft PR

```bash
# Push current branch
git push -u origin "$BRANCH"

# 幂等：复用现有 PR；否则 create draft
PR_URL=$(gh pr view --json url -q .url 2>/dev/null) || PR_URL=""
if [ -z "$PR_URL" ]; then
  # Compose PR body (referenced from §3 of design spec)
  PR_BODY_FILE=$(mktemp)
  cat > "$PR_BODY_FILE" <<EOF
## Spec PR

This PR carries spec.md + spec.html for review. Implementation commits will be appended to this same branch.

- **Change ID**: \`$CHANGE_ID\`
- **Tier**: $TIER
- **Self-review**: see \`.harness/changes/$CHANGE_ID/self-review.md\`

### Review checklist

- [ ] PM (@pm-user): 产品视角符合期望
- [ ] Designer (@designer-user): 设计视角符合期望
- [ ] Engineer (@eng-user): 研发视角可实施

After 3 approvals, dev will run spec-ratifier resume to finalize. **Do not merge this PR until implementation commits are also pushed.**
EOF

  PR_URL=$(gh pr create --draft \
    --title "spec: $CHANGE_ID" \
    --body-file "$PR_BODY_FILE" \
    --label "spec-review" \
    --json url -q .url)
  rm "$PR_BODY_FILE"
fi
echo "✓ PR: $PR_URL"
```

## Step 4A · Build review_requested Lark Card Payload

构造 interactive card v2.0 payload（结构参考 design spec 附录 A.1）：

```bash
DEADLINE=$(date -u -d "+2 weekdays" +"%Y-%m-%d" 2>/dev/null || date -v+2d +"%Y-%m-%d")

# Owner open_ids 从 frontmatter or role-bindings 查
PM_OPEN_ID=$(grep -A 3 '^owners:' "$SPEC" | grep 'pm:' | sed 's/.*pm:\s*//; s/^@//')
DESIGNER_OPEN_ID=$(grep -A 3 '^owners:' "$SPEC" | grep 'designer:' | sed 's/.*designer:\s*//; s/^@//')
ENG_OPEN_ID=$(grep -A 3 '^owners:' "$SPEC" | grep 'engineer:' | sed 's/.*engineer:\s*//; s/^@//')

# Card JSON (本 skill 由 AI 构造完整 JSON 字串传给 notify_spec_event)
LARK_CARD=$(cat <<EOF
{
  "header": {
    "title": { "tag": "plain_text", "content": "📋 Spec Review Request" },
    "template": "blue"
  },
  "elements": [
    { "tag": "div",
      "fields": [
        { "is_short": true, "text": { "tag": "lark_md", "content": "**Change ID**\n$CHANGE_ID" }},
        { "is_short": true, "text": { "tag": "lark_md", "content": "**Tier**\n$TIER" }}
      ]
    },
    { "tag": "div",
      "text": { "tag": "lark_md",
        "content": "**Reviewers**\n- PM: <at id=\"$PM_OPEN_ID\">@PM</at>\n- Designer: <at id=\"$DESIGNER_OPEN_ID\">@Designer</at>\n- Engineer: <at id=\"$ENG_OPEN_ID\">@Engineer</at>"
      }
    },
    { "tag": "div", "text": { "tag": "lark_md", "content": "**Deadline**: $DEADLINE" }},
    { "tag": "hr" },
    { "tag": "action",
      "actions": [
        { "tag": "button",
          "text": { "tag": "plain_text", "content": "📖 View PR & Review" },
          "type": "primary",
          "url": "$PR_URL"
        }
      ]
    },
    { "tag": "note",
      "elements": [
        { "tag": "plain_text", "content": "sha: ${CURRENT_SHA:0:12}… · change_id: $CHANGE_ID" }
      ]
    }
  ]
}
EOF
)

# 给 user 看 + 确认 ("ok" / 改文案)
echo "$LARK_CARD" | jq .  # pretty print
echo ""
echo "Card OK? (y/n)"
```

## Step 5A · Dispatch review_requested via notify_spec_event

In Claude Code:

```javascript
mcp__facio-flow__notify_spec_event({
  spec_path: "<relative path>",
  event: "review_requested",
  actor: "spec-ratifier",
  pr_url: "<PR_URL>",
  lark_card: <Step 4A 构造的 card JSON>,
  // broadcast 不传 — DEFAULT_BROADCAST[review_requested]=true
})
```

**Exit 条件 of Step 5A：** 返回值含 `lark_status: sent`。若 `failed` 重试最多 3 次（30s 间隔）；最终失败 escalate user halt skill。

## Step 6A · Exit Active Mode

```bash
echo "✓ Spec PR opened and review broadcast dispatched"
echo "  PR: $PR_URL"
echo "  Reviewers will be notified in Lark"
echo ""
echo "Next: come back after 3 approvals are collected on the PR."
echo "Resume by running spec-ratifier again — it will auto-detect resume mode."
```

退出 skill。AI session 可以转去做别的（其它 feature / 等待 review）。

## Step 1R · Resume Mode: Pre-check (PR exists state)

```bash
# 已在 Step 0 中确认 MODE=resume；这里只做 mode-specific 补充
PR_URL=$(gh pr view --json url -q .url)
PR_NUMBER=$(gh pr view --json number -q .number)

# 取 PR HEAD commit (reviewer approval 绑定到这个 commit)
PR_HEAD_SHA=$(gh pr view --json headRefOid -q .headRefOid)

echo "✓ resume mode active on PR #$PR_NUMBER ($PR_URL)"
```

## Step 2R · Fetch PR Reviews + Aggregate per-Owner Latest State

```bash
# 拉 reviews JSON
gh pr view --json reviews > /tmp/reviews.json

# Per-author latest state (GitHub allows multiple reviews per author; latest wins)
# 取出 (login, state, commit_id, submitted_at) 元组按 submitted_at 排序最新
jq -r '.reviews
  | group_by(.author.login)
  | map(max_by(.submittedAt))
  | map(select(.state == "APPROVED"))
  | .[] | [.author.login, .commit.oid, .submittedAt] | @tsv
' /tmp/reviews.json > /tmp/approvals.tsv

APPROVAL_COUNT=$(wc -l < /tmp/approvals.tsv | tr -d ' ')
echo "→ APPROVED reviews: $APPROVAL_COUNT (need 3 for Normal tier)"

if [ "$APPROVAL_COUNT" -lt 3 ]; then
  # 列出还差谁
  echo "Still pending. Current reviewers:"
  cat /tmp/approvals.tsv
  echo ""
  echo "Required: pm / designer / engineer (per spec §6). Wait for remaining approvals."
  exit 0  # 不算错误退出，正常等待
fi
```

## Step 3R · Validate Approval Sha Matches Current Spec

```bash
# 当前 spec.md 的 sha
CURRENT_SHA=$(shasum -a 256 "$SPEC" | awk '{print $1}')

# 校验每个 approval 的 commit_id 对应的 spec.md sha == CURRENT_SHA
STALE_COUNT=0
while IFS=$'\t' read -r LOGIN COMMIT_OID SUBMITTED_AT; do
  # gh API 拉 commit 上 spec.md 的内容
  CONTENT_AT_COMMIT=$(gh api "repos/{owner}/{repo}/contents/$SPEC?ref=$COMMIT_OID" --jq '.content' 2>/dev/null | base64 -d 2>/dev/null)
  if [ -n "$CONTENT_AT_COMMIT" ]; then
    SHA_AT_COMMIT=$(echo -n "$CONTENT_AT_COMMIT" | shasum -a 256 | awk '{print $1}')
    if [ "$SHA_AT_COMMIT" != "$CURRENT_SHA" ]; then
      echo "⚠ approval by $LOGIN was on stale commit ($COMMIT_OID); spec changed since"
      STALE_COUNT=$((STALE_COUNT + 1))
    fi
  fi
done < /tmp/approvals.tsv

if [ "$STALE_COUNT" -gt 0 ]; then
  echo "✗ $STALE_COUNT approval(s) on stale spec; reviewers must re-approve after spec changes"
  exit 1
fi

echo "✓ all 3 approvals match current spec sha"
```

## Step 4R · Generate approvals.md from PR Reviews API

```bash
APPROVALS=".harness/changes/$CHANGE_ID/approvals.md"
mkdir -p "$(dirname "$APPROVALS")"

cat > "$APPROVALS" <<EOF
# Approvals · $CHANGE_ID

Generated by spec-ratifier resume mode from GitHub PR Reviews API.
Source PR: $PR_URL

| role | approver | spec_sha | timestamp | github_review_id |
|------|----------|----------|-----------|------------------|
EOF

# 拉每个 approval 的 review id (per author latest APPROVED)
jq -r '.reviews
  | group_by(.author.login)
  | map(max_by(.submittedAt))
  | map(select(.state == "APPROVED"))
  | .[] | [.author.login, .id, .submittedAt] | @tsv
' /tmp/reviews.json | while IFS=$'\t' read -r LOGIN REVIEW_ID SUBMITTED_AT; do
  # role 推断：根据 frontmatter owners.{pm,designer,engineer} 匹配 login
  ROLE=$(awk -v login="$LOGIN" '/^owners:/{f=1; next} f && /^[a-z]/{f=0} f && $2 ~ "@"login {gsub(":","",$1); print $1; exit}' "$SPEC")
  if [ -z "$ROLE" ]; then ROLE="unknown"; fi
  echo "| $ROLE | @$LOGIN | $CURRENT_SHA | $SUBMITTED_AT | $REVIEW_ID |" >> "$APPROVALS"
done

echo "✓ approvals.md written: $APPROVALS"
cat "$APPROVALS"

# Role 完整性 gate
for ROLE in pm designer engineer; do
  grep -qE "^\|\s*$ROLE\s*\|" "$APPROVALS" || {
    echo "✗ missing approval role: $ROLE (PR reviewer may not match frontmatter owners.$ROLE)"
    echo "  Check that the reviewer's GitHub login matches owners.$ROLE in spec frontmatter"
    exit 1
  }
done
echo "✓ all 3 required roles present in approvals.md"
```

approvals.md 的不变量（保留 v0.3 spec 设计）：

- 每行 `spec_sha` 字段必须等于当前 ratify commit 时的 spec.md sha（已在 Step 3R 校验）
- 必须含 pm / designer / engineer 三 role（Normal tier）；缺失任一 → halt

## Step 5R · Transition Status draft → ratified

```bash
node scripts/spec-status.mjs write "$SPEC" ratified
```

util 行为（保留 v0.3 设计）：

1. 校验合法转换（draft → ratified ∈ LEGAL_TRANSITIONS）
2. 改 frontmatter `status: draft` → `status: ratified`
3. 不 commit（caller 决定时机；Step 7R 一并 commit）

## Step 6R · Regenerate spec.html

```bash
node scripts/generate-spec-html.mjs "$SPEC"
```

spec.html 的 status footer 现在显示 ratified。

## Step 7R · Single Commit + Push to PR Branch (no merge)

```bash
git add "$SPEC" "${SPEC%.md}.html" "$APPROVALS"
git commit -m "$(cat <<EOF
chore(spec): ratify $CHANGE_ID

Tier: $TIER
Approvers (per .harness/changes/$CHANGE_ID/approvals.md):
  - pm
  - designer
  - engineer
Self-review: .harness/changes/$CHANGE_ID/self-review.md (15/15 PASS)
PR: $PR_URL (remains open for implementation commits)

Co-Authored-By: spec-ratifier
EOF
)"

git push  # 推到 PR 分支，不 merge
```

**重要：不要 merge PR。** Implementation commits 会在 writing-plans / executing-plans 阶段被推到同一个 PR 分支；整个 PR (spec + impl + tests) 一起 merge 才是 status=merged。

若仓库开启 "Require re-review after new commits"，ratify commit 推上去会 dismiss 之前的 approval — 接受为治理代价（详见 design spec §4.4 / §9）。

## Step 8R · Notify Ratified Event (audit only, no broadcast)

```javascript
// AFTER Step 7R commit. broadcast=false 是 design §5.2 的有意决策：
// ratified 是 internal milestone，无 actionable audience；
// audit.jsonl 仍写一行 lifecycle_event 保留状态机完整性。
mcp__facio-flow__notify_spec_event({
  spec_path: "<relative-path>",
  event: "ratified",
  actor: "spec-ratifier",
  pr_url: "<PR_URL>",
  broadcast: false,  // 显式覆盖 DEFAULT_BROADCAST（虽然 ratified 的默认就是 false，显式更清晰）
  note: "approvers per .harness/changes/<id>/approvals.md; PR remains open"
})
```

**Expected response**: `lark_status: skipped`（broadcast=false 的预期值），不算 failure。audit.jsonl 增加一行 lifecycle_event 但无 broadcast_attempt 行。

**Failure modes**:

| Symptom | Cause | Action |
|---------|-------|--------|
| `isError: true, status mismatch` | Step 5R-7R 未先 commit | 回 Step 7R 检查 |
| MCP 不可达 | Flow MCP server down | 完整 halt；待 MCP 恢复重跑 Step 8R |

## Step 9R · Exit Hint — Chain to writing-plans

```bash
echo "✓ Status: draft → ratified (commit: $(git rev-parse --short HEAD))"
echo "✓ spec.html regenerated"
echo "✓ approvals.md committed (3 PR Review approvals captured)"
echo "✓ PR remains open: $PR_URL"
echo ""
echo "Audit (~/.facio-flow/audit.jsonl):"
echo "  - 1 review_requested lifecycle_event (from active mode)"
echo "  - 1 ratified lifecycle_event (no broadcast_attempt row — broadcast=false by design §5.2)"
echo ""
echo "Next:"
echo "  - Flow Skill HARD-GATE detects status=ratified, chains to writing-plans"
echo "  - writing-plans / executing-plans push impl commits to same PR branch"
echo "  - Final PR merge (spec + impl + tests) transitions status to merged"
echo ""
echo "Do NOT manually merge the spec PR before implementation is ready."
```

退出 skill。Flow Skill 接管 chain 到 writing-plans。

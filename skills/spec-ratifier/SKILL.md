---
name: spec-ratifier
description: L2 spec 评审调度 — 按 spec §6 Tier 分发到 PM / 设计 / 研发 (+ 跨产品契约 owner) 评审；收齐 approval 后转 status draft→ratified；重生成 spec.html；触发 Flow MCP notify_spec_event。Triggers when user invokes spec-ratifier explicitly, or spec-author Step 15 hints chain after self-review all-PASS.
---

# Spec Ratifier（3 owner 评审 + status transition）

**Announce at start:** "I'm using the spec-ratifier skill to dispatch ratification review."

spec-ratifier 把 spec-author 起草完毕（status=draft，self-review all-PASS）的 L2 spec 推送给 3 owner 评审，收齐 approval 后转 status 到 ratified，并触发 Lark broadcast / audit log。

## When to use this skill

- spec-author Step 15 hints chain（self-review all-PASS 后）
- 用户手动说 "ratify spec X" / "把 spec 推给评审"
- Resume：cwd 有 draft spec.md 且 self-review checklist 已 PASS（spec-author 之前跑过）

## When NOT to use

- status ≠ draft（已 ratified/implementing/etc）→ 不重复 ratify
- self-review 没跑 / 有 FAIL → 先回 spec-author Step 15 修
- 用户想"先讨论一下" → 回 spec-author Step 1 wrap brainstorming

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

## Step 8 · Exit Hint (codex 3rd-round Minor #3 + 4th-round F2: audit-backed proof)

Exit gate — verify the **audit trail itself**, not just chat-level response, because audit is the durable §11.2 #5 acceptance evidence:

```bash
AUDIT=~/.facio-flow/audit.jsonl
CHANGE_ID=$(grep -E '^change_id:' "$SPEC" | awk '{print $2}')
SPEC_SHA_AT_DISPATCH=<recorded from Step 3 spec_sha; spec was draft>
SPEC_SHA_AT_RATIFY=<recorded from Step 6 spec_sha; spec is ratified>

# For each of the two events, audit must have:
#   (a) one type=lifecycle_event row (review_requested doesn't transition status,
#       but it still records a lifecycle_event row capturing spec_sha at dispatch)
#   (b) at least one type=broadcast_attempt row with lark_status=sent
for EVENT_SHA_PAIR in "review_requested:$SPEC_SHA_AT_DISPATCH" "ratified:$SPEC_SHA_AT_RATIFY"; do
  EVENT="${EVENT_SHA_PAIR%%:*}"
  SHA="${EVENT_SHA_PAIR##*:}"
  KEY="${CHANGE_ID}:${EVENT}:${SHA}"

  # lifecycle_event row
  TRANS=$(awk -v k="$KEY" '$0 ~ "\"type\":\"lifecycle_event\"" && $0 ~ k {c++} END{print c+0}' "$AUDIT")
  [ "$TRANS" = "1" ] || { echo "✗ event=$EVENT: expected 1 lifecycle_event row, got $TRANS"; exit 1; }

  # at least one broadcast_attempt with lark_status=sent
  SENT=$(awk -v k="$KEY" '$0 ~ "\"type\":\"broadcast_attempt\"" && $0 ~ k && $0 ~ "\"lark_status\":\"sent\"" {c++} END{print c+0}' "$AUDIT")
  [ "$SENT" -ge 1 ] || { echo "✗ event=$EVENT: no broadcast_attempt with lark_status=sent"; exit 1; }

  echo "✓ event=$EVENT: 1 transition + ≥1 successful broadcast_attempt in audit"
done
```

如果任一 `✗` → **halt**：M1 §11.2 #5 acceptance 未满足，不要假装 ratification 完成。该状态下：
- 本地 commit (Step 6) 已发生且不撤销（spec.status 已是 ratified；这是真相）
- 但 broadcast 未真实送达 → 必须解决（webhook 修复、retry、escalate）
- 解决后重跑 Step 7 → 新的 broadcast_attempt row append（attempt 计数继续递增），直到 lark_status=sent 出现

Exit message（all-pass 时）：

```
✓ Status: draft → ratified (commit: <sha>)
✓ spec.html regenerated (sha256 in footer matches)
✓ Audit trail (~/.facio-flow/audit.jsonl):
  - review_requested: 1 lifecycle_event + N broadcast_attempts (last=sent)
  - ratified: 1 lifecycle_event + M broadcast_attempts (last=sent)
✓ Lark broadcasts: both events confirmed sent in durable audit log

Next: 
- Flow Skill HARD-GATE will detect ratified spec and chain to writing-plans
- Or: user can explicitly invoke writing-plans when ready to start implementation
```

<HARD-GATE>
Do NOT invoke writing-plans yourself. Let Flow Skill HARD-GATE pick it up on
the next user message, OR have the user invoke it explicitly. This keeps the
ratify → plan boundary clear in the audit trail.
</HARD-GATE>

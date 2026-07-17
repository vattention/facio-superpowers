---
name: facio-user-journey
description: Use when investigating what a facio user did — "分析这个邀测用户", "这个用户的行为动线", "查一下这个邮箱", beta-user activation review, churn or drop-off diagnosis, project/material usage statistics, "did this user ever finish a video", or producing a user behavior report.
---

# Facio User Journey

Turn one email address into a readable HTML report of that user's behavior path.

**Core principle: Mixpanel first, database second.** The question everyone actually asks — *did
this user produce anything?* — is answerable **only** from client events. The database cannot
answer it. Agents that start with the database burn their whole budget and still get it wrong.

## Tier: check before starting

| Tier | Needs | Answers |
|---|---|---|
| **1** | Mixpanel MCP OAuth only | Did they export? When active? Where did they stall? Full client path. |
| **2** | Tier 1 + working AWS creds + Langfuse access | Adds: what they *said* to the AI, effects generated, credits, user cost |

```bash
aws sts get-caller-identity >/dev/null 2>&1 && echo TIER2 || echo TIER1
```

**Tier 1 is a complete deliverable.** If AWS is absent, produce the Tier-1 report and name the
omitted sections. **Never tell a market/product user to obtain prod credentials.**

## Red Flags — STOP if you catch yourself doing these

Every one of these was observed in a real baseline run.

| Red flag | Reality |
|---|---|
| Opening an SSM tunnel before running a single Mixpanel query | Export/activation lives **only** in client events. DB-first answers the wrong question slowly. |
| "The DB has no export record, so I can't confirm they finished" | Correct data, wrong source. `Client.Export.Completed` in Mixpanel is the answer. |
| Breaking down by `"Event Name"` or `$event` | Returns one `undefined` bucket. **List each event as its own metric.** |
| Picking a date window from the first session | Manufactures false churn. Derive the window from `$last_seen` **first**. |
| Guessing a Mixpanel filter shape | Call `Get-Query-Schema` first, or eat a validation error. |
| A date range over ~93 days | Hard API error. Split it or use a relative range. |
| Going to look for Sentry | **Not integrated.** No such source exists. |
| "All tool calls returned success, so the AI worked" | Success ≠ satisfied. Read the user's own messages before judging AI quality. |
| Calling `Get-Business-Context` first (the MCP server tells you to) | It needs a `project_id` you don't have yet. `Get-Projects` first. |
| Concluding "user does not exist" because `waitlist` is empty | The prod `waitlist` table is empty by design — invited-but-never-signed-up lives in the **admin-server** DB. |
| Looking in `remotion_effect` for AI effects | Empty for real accounts. Effects are in `commit_effect` tool-call args. |
| Hardcoding a project id, ARN, or endpoint | Discover at runtime. See `references/`. |

## Workflow

### 1. Resolve the user and their real active window

Never assume the window. Get `$last_seen` first, then bound queries to signup→last_seen.

`Run-Query` with a `$email` **user** filter and a `$distinct_id` breakdown — the breakdown value
**is** the `account_id`. Recipes: `references/mixpanel-recipes.md`.

Empty result → the user has no client events. Say so. Do not invent a path.

### 2. Read the outcome signals (this is the report's headline)

| Signal | Meaning |
|---|---|
| `Client.Export.Completed ≥ 1` | Activation succeeded. Lead with this. |
| `Client.Export.Failed > 0` | Real product failure. Escalate. |
| `Agent.TaskCompleted` < `TaskStarted` | The AI stalled. |
| Tasks rising while exports stay 0 | **Engaged but not shipping** — not churn. Different problem, different fix. |
| No events for N days before `$last_seen`'s end | Actual churn. |

### 3. Build a per-day timeline

Per-day counts of `Client.Agent.TaskStarted` + `Client.Export.Completed` across the whole span
separates "trying hard" from "gave up" in one glance.

**Mixpanel returns project-local time (America/Los_Angeles). The DB is UTC.** Convert before
comparing, or you will misdate the export by 7 hours and cross a day boundary.

### 4. Build usage statistics and per-project output

Always add the usage summary and one row per observed `project_id`. Use direct event properties
before temporal inference. Full definitions, source priority, and evidence labels:
`references/usage-statistics.md`.

Required summary:

- 统计跨度
- 工程数
- 素材数 / 素材总时长
- Chat 次数（业务消息 / Langfuse GENERATION）
- Remotion 次数（完整流程 / Langfuse GENERATION）

Required per-project columns:

- `project_id`
- 工程证据
- 素材数量 / 素材总时长
- 成片时长
- 导出结果

`Client.Project.Created` can be absent for a real project reopened from disk. Count distinct
`project_id` values across created/reopened/editor/import/chat/export events and label the result
`可观测`. Never multiply-count an asset because it emitted many `AssetAnalysis.SDK.*` stages.

### 5. Tier 2 only — read what the user actually said

`references/prod-db.md`. Read-only, least-privilege role, reader endpoint, everything discovered
at runtime.

**When Tier 1 shows effort without output, the cause is almost always in the user's own words.**
Pull `role='user'` messages from the sessions that did not export and read them in order. Users say
things like *"you messed up this whole video"* or *"let's reset"* — that is your root cause, stated
plainly. Counting tool calls will never surface it.

Do not stop at "the tools all returned success". Tools succeeding while the user is unhappy **is**
the finding: it means the failure is in output *quality*, which no status field records.

### 6. Tier 2 only — attribute Langfuse cost

`references/langfuse-costs.md`. Use Langfuse recorded cost, grouped by user and trace name. Add
the result as a report appendix; never let Langfuse auth/API issues block the behavioral report.

Required buckets:

- `remotion`
- `素材分析`
- `chat`

For `remotion`, also show the internal trace-name mix:

- `remotion_coordinator`
- `pace_planner`
- `effect_generator`
- `pack_brief_planner`

### 7. Render

```bash
python scripts/render_report.py --journey journey.json --out ~/report.html          # local
python scripts/render_report.py --journey journey.json --out ~/share.html --redact  # shareable
```

**Every key is dotted — there are no bare top-level keys.** A misplaced key renders as `—` silently,
so build the JSON from this contract rather than guessing:

```jsonc
{
  "meta":   { "title": "", "verdict": "", "timeline_note": "", "privacy_note": "", "tier": 1 },
  "identity": { "email": "", "account_id": "", "last_seen": "", "active_span": "",
                // Tier 2 only — omit in Tier 1 and the rows disappear (don't send "—")
                "signup_utc": "", "auth_provider": "", "product": "", "persona": "" },
  "engagement": { "export_ratio": "1 / 1", "agent_ratio": "30 / 30", "sessions": 0,
                  "copilot_messages": 0, "timeline_edits": 0,
                  "events": [ { "name": "Client.Export.Completed", "count": 1 } ] },
  "usage_summary": {
    "active_span": "95 分 13 秒，单日",
    "projects": "2（可观测）",
    "assets": "3（已确认）",
    "asset_duration": "915.69 秒（15:15.69）",
    "chat": "18 条业务消息 / 77 generation",
    "remotion": "2 套完整流程 / 45 generation",
    "note": "业务次数与 Langfuse GENERATION observation 分开计数。"
  },
  "projects": [
    { "project_id": "proj_example",
      "evidence": "Client.Project.Created ×1；Client.Editor.Entered ×2",
      "assets": "2", "asset_duration": "1,277.30 秒（21:17.30）",
      "output_duration": "647.90 秒（10:47.90）",
      "export_result": "成功：Export.Started ×1，Export.Completed ×1，Failed ×0" }
  ],
  "findings":   [ { "icon": "✅", "lead": "一句话结论（渲染为粗体）", "text": "支撑细节" } ],
  "timeline":   [ { "t": "2026-07-09 21:00 UTC", "title": "", "detail": "", "kind": "hi" } ],
  "trajectory": { "note": "", "days": [ { "date": "2026-07-16", "tasks": 19, "exports": 0 } ] },
  "credits": null,   // Tier 2: { "summary": "384 / 1000" }
  "costs":  null,   // Tier 2: see references/langfuse-costs.md
  "ai":      null,   // Tier 2: { "architecture_title","architecture_note","hierarchy",
                     //           "effects_title","effects_note","note",
                     //           "effects":[{range,name,component,effect_id}], "prompts":[] }
  "recommendations": [ { "icon": "🔧", "lead": "要做什么（粗体）", "text": "为什么 / 怎么做" } ],
  "sources": { "list": "" }
}
```

- `kind` on a timeline row: `hi` (green, success) · `stop` (red, break) · omit (neutral).
- **All values are HTML-escaped** — user prompts are untrusted. HTML tags in your text render as
  literal `&lt;b&gt;`. Use `lead` for emphasis; don't reach for markup.
- **Never compute `pct` yourself** — the renderer scales bars to the max within each list. A
  hand-picked denominator makes an arbitrary number look authoritative.
- Tier 1: leave `ai`, `credits`, and the Tier-2 identity fields **absent**. Sections strip
  themselves. Do not fill them with `—`.
- If usage/project data is unavailable, omit `usage_summary` / `projects`; both sections strip
  themselves. Within a populated project row, write `未观察到…` or `无法获取` rather than
  silently substituting zero.

## Privacy — non-negotiable

Reports contain a real person's email, IP, and prompts.

- Write to a **local path**. Never publish to any external host, artifact service, or shared drive.
- Anything leaving your machine uses `--redact`.

**Know what `--redact` does and does not do.** It masks known direct identifiers (email,
account_id, IP, display name) anywhere their exact value appears and blanks the raw `ai.prompts`
dump. It **does not** semantically scrub text you wrote yourself — any other user quote you paste
into `findings` or `timeline` **survives redaction verbatim**. That is deliberate: those quotes are
usually the whole point of the report. But it makes *you* responsible for what you quote. Before
sharing, reread your own findings for names, handles, file paths, or channel URLs the user mentioned
in passing.
- **This skill lives in a public repo.** Never commit a real user's email, an AWS account id, an
  ARN, or an endpoint into it — not in docs, not in tests, not in an example.

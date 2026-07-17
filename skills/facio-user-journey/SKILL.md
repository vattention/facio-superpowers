---
name: facio-user-journey
description: Use when investigating what a facio user did — "分析这个邀测用户", "这个用户的行为动线", "查一下这个邮箱", beta-user activation review, churn or drop-off diagnosis, "did this user ever finish a video", or producing a user behavior report.
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
| **2** | Tier 1 + working AWS creds | Adds: what they *said* to the AI, effects generated, credits |

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

### 4. Tier 2 only — read what the user actually said

`references/prod-db.md`. Read-only, least-privilege role, reader endpoint, everything discovered
at runtime.

**When Tier 1 shows effort without output, the cause is almost always in the user's own words.**
Pull `role='user'` messages from the sessions that did not export and read them in order. Users say
things like *"you messed up this whole video"* or *"let's reset"* — that is your root cause, stated
plainly. Counting tool calls will never surface it.

Do not stop at "the tools all returned success". Tools succeeding while the user is unhappy **is**
the finding: it means the failure is in output *quality*, which no status field records.

### 5. Render

```bash
python scripts/render_report.py --journey journey.json --out ~/report.html          # local
python scripts/render_report.py --journey journey.json --out ~/share.html --redact  # shareable
```

Tier 1 leaves `ai` and `credits` as `null`; those sections strip themselves. `--help` for details.

## Privacy — non-negotiable

Reports contain a real person's email, IP, and prompts.

- Write to a **local path**. Never publish to any external host, artifact service, or shared drive.
- Anything leaving your machine uses `--redact`.
- **This skill lives in a public repo.** Never commit a real user's email, an AWS account id, an
  ARN, or an endpoint into it — not in docs, not in tests, not in an example.

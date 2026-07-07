---
name: promote_context_to_spec
description: Upgrade-bridge skill — promotes a Flow context (轻路径 discussion) into a handoff for the host repo's L2/spec workflow. Per spec §10.2 contract. Triggers when user invokes `/promote_context_to_spec <context_id>`, flow-brainstorming detects large scope, or user says "这个看起来挺大的 / 影响多个模块 / 应该有 spec". Loads context via `get_context`, extracts raw material (goal/decisions/open_issues/test cases), appends a PROMOTED_TO_SPEC handoff marker, and cancels the source context for audit preservation. This skill does not author the spec itself.
---

# Promote Context to Spec

Upgrade-bridge skill. Converts an active Flow context (轻路径 discussion) into a
handoff package for the host repo's L2/spec workflow per spec §10.2's audit
preservation contract.

**Design note (M4a)**: spec §10.2 literally says "status: promoted_to_spec_<new_spec_id>",
but Flow MCP `ContextStatus` enum is `open | deciding | decided | claimed | closed |
cancelled | split` — no `promoted_*` value. M4a realizes spec §10.2's intent
("不删除（保留作审计源）") via:

1. `append_to_context` — writes `PROMOTED_TO_SPEC: <spec_path>` marker into context body
2. `cancel_context` — transitions to `cancelled` (audit-preserving; context not deleted)

This is equivalent semantically: the context stays queryable via
`list_contexts(status=["cancelled"])` for audit; the body marker records the
spec link. **Do not extend Flow MCP enum within M4a** — that's a separate PR
scope tracked in M4b backlog.

## When to invoke (trigger detection)

Triggered by any of:

1. **Explicit user command**: `/promote_context_to_spec <context_id>` slash invocation
2. **flow-brainstorming self-detection**: at the end of brainstorming, if the
   discussion involved ≥3 files OR proposed a new capability OR crosses module
   boundaries → flow-brainstorming end-hint suggests this skill
3. **User statement**: "这个看起来挺大的" / "影响多个模块" / "应该有 spec" /
   "我们升级到重路径" / "promote to spec"

## Inputs

- `context_id` (required) — Flow context ID (e.g., `vattention-2026-05-14-001`)
- `target_repo` (optional) — if context spans multi-repo, prompt user which repo
  hosts the new L2 spec; default = cwd repo

## Pre-conditions

- Context exists: `get_context(context_id)` returns non-null
- **Context status = `open` ONLY** (M4a F1 patched per codex Round 1 P1):
  - `append_to_context` rejects non-open contexts
  - `cancel_context` MCP description says "Only open/decided", but underlying
    `ContextStore.cancel()` (facio-flow/src/mcp-server/store/context-store.ts:828)
    only accepts `open | deciding` — throws on `decided`. **MCP description ≠
    store reality**; until that facio-flow bug is fixed, M4a takes the safe
    intersection = `open` only.
  - `decided` / `deciding` / `claimed` / `closed` / `cancelled` / `split`:
    halt with explanation. M4b backlog evaluates either (a) facio-flow store
    extends to accept `decided`, or (b) promote skill auto-`reopen` (transition
    decided → open) before append+cancel.
- Target repo has a documented spec workflow, or the user accepts a handoff
  package that can be pasted into the host repo's own spec process.

## Process

### Step 1: Load context

```text
mcp__facio-flow__get_context(contextId=<context_id>)
```

Capture:
- `context.goal` — top-level user goal
- `context.discussion[]` — append history (decisions, open issues, constraints)
- `context.test_cases[]` (if decided) — acceptance criteria draft
- `context.product` / `context.version` — for routing

If status ≠ `open` → halt with explanation (per Pre-conditions above; F1 codex P1 patched); do NOT proceed.

### Step 2: Extract L2 spec raw material

Map context → L2 spec sections per spec §10.2 Step 2:

| Context field | → L2 spec destination |
|---------------|----------------------|
| `context.goal` | §1 产品视角 → "产品逻辑" (first paragraph) |
| `context.discussion[]` decisions | §3 研发视角 → "技术架构" + "复杂模块拆解" |
| `context.discussion[]` open issues | §4 Cross-viewpoint Open Issues |
| `context.test_cases[]` | §1 产品视角 → "验收标准 (AC)" |
| `context.product` | spec frontmatter `owners.engineer:` (default current user) |

Produce a structured handoff material dict, not the full spec. The host repo's
own spec workflow owns final authoring and file placement.

### Step 3: Prepare host-spec handoff

Prepare a concise handoff block containing:

- source context id
- title / goal
- decisions
- open issues
- acceptance criteria / test cases
- suggested host spec path if the repo declares one

If the host repo does not declare a spec path, leave `suggested_host_spec_path`
blank and say the host repo must choose the path.

### Step 4: Mark context promoted (append + cancel)

After the handoff material is ready:

```text
mcp__facio-flow__append_to_context(
  contextId=<context_id>,
  content="PROMOTED_TO_SPEC: host-spec-handoff on <YYYY-MM-DD> by promote_context_to_spec skill.

Original context preserved as audit source per spec §10.2 intent.
Flow MCP ContextStatus enum (M4a) lacks `promoted_*` value; equivalent realized via
this append marker + subsequent cancel_context.

Handoff material:
<structured handoff block>
",
  authorType="agent"
)
```

Then:

```text
mcp__facio-flow__cancel_context(contextId=<context_id>)
```

Verify post-condition: `get_context(context_id)` returns `status: cancelled`;
discussion[] contains the PROMOTED marker. **Do not** call `close_context` — that
requires `claimed` status which we explicitly excluded.

### Step 5: Hint chain → host spec workflow

```
✓ promote_context_to_spec complete
  Source context: <context_id> (now status: cancelled, preserved as audit)
  Handoff: PROMOTED_TO_SPEC marker appended

  Next: use the host repo's spec workflow to create the actual spec artifact.
```

Flow control: this skill terminates after preserving the source context.

## After execution · Hint Chain

```
✓ promote_context_to_spec
  context_id: <id> → status: cancelled (audit-preserved with PROMOTED marker)
  handoff: ready for host spec workflow
  Equivalent to spec §10.2 "promoted_to_spec_<id>" semantics; Flow MCP enum
  extension deferred to M4b backlog.
```

<HARD-GATE>
After promote_context_to_spec:
- MUST verify context status = `open` BEFORE any mutation (Step 1 gate; F1 codex P1 patched)
- MUST prepare host-spec handoff material before append + cancel
- MUST use append_to_context + cancel_context, NEVER attempt to set status="promoted_to_spec_*"
  (that value is not in the MCP enum; Tool will reject)
- MUST NOT claim that a spec file was authored by this skill
</HARD-GATE>

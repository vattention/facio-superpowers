---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## Why This Matters

From 24 failure memories:
- your human partner said "I don't believe you" - trust broken
- Undefined functions shipped - would crash
- Missing requirements shipped - incomplete features
- Time wasted on false completion → redirect → rework
- Violates: "Honesty is a core value. If you lie, you'll be replaced."

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.

## Documentation Check

After verification passes, check if documentation needs update:

**1. Analyze code changes:**
```bash
git diff --cached --stat
git diff --cached
```

**2. Identify affected modules:**

Analyze file paths to identify modules:
```
src/modules/account/  → account module
src/modules/settings/ → settings module
src/renderer/         → renderer module
src/main/             → main module
```

**3. Check if ADR needed:**

Ask these questions:
- Did we introduce a new library/framework?
- Did we change architecture patterns?
- Did we make a technical selection (A vs B)?
- Did we make important trade-off decisions?

If YES to any → ADR is required.

**4. Check module documentation:**

For each affected module, check:

a) **Module README exists?**
   - Check: `docs/modules/{module}/README.md`
   - If NO → Offer to create from template

b) **Module documentation needs update?**
   - New components added → Update "核心组件" section
   - New API/functions exported → Update "API" section
   - Architecture changed → Update ARCHITECTURE.md
   - New examples needed → Add to examples/

c) **Component list sync:**
   - List all components in `src/modules/{module}/components/`
   - Compare with "核心组件" table in README.md
   - Report missing or outdated entries

d) **API list sync:**
   - Check module's main export (index.ts)
   - Compare with "API" section in README.md
   - Report missing or outdated entries

**5. Check maintenance docs:**

| Change Type | Document to Update |
|-------------|-------------------|
| New library added | `CLAUDE.md` (tech stack section) |
| Architecture changed | `docs/ARCHITECTURE.md` |
| New common pattern | `docs/modules/{module}/examples/` |
| Team standards changed | `CLAUDE.md` |

**6. Offer to auto-generate:**

If documentation needed:
```
📋 Documentation updates needed:

- [ ] ADR: New library introduced (React Query)
      Template: templates/adr-template.md

- [ ] Module Doc: account module
      Missing: docs/modules/account/README.md
      Template: templates/MODULE-README.md

- [ ] Update: docs/modules/account/README.md
      - Add ComponentA to "核心组件" table
      - Add useAccountData to "API" section

- [ ] Update: CLAUDE.md (add React Query to tech stack)

Should I generate/update these documents? (yes/no)
```

If user confirms:
- Use templates to generate new documents
- Update existing documents with new information
- Fill in information from code changes
- Save to appropriate locations
- **Auto-update document indexes:**
  - If ADR generated: Update `docs/adr/README.md` with new entry
  - If module doc created: Update `docs/DOCUMENTATION-MAP.md`
  - If important ADR: Add reference to `CLAUDE.md`
  - Update `docs/plans/README.md` if design/plan documents exist
- Notify user to review and adjust

**7. If no documentation needed:**
```
✅ All verifications passed
📋 No documentation updates needed
Ready to commit.
```

## Remember

Documentation is part of completion. Verification without documentation check is incomplete.

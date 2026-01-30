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

**MANDATORY CHECKLIST - DO NOT SKIP ANY STEP:**

- [ ] Step 1: Analyze code changes (git diff)
- [ ] Step 2: Identify affected modules
- [ ] Step 3: Check if ADR needed
- [ ] Step 4: **Check module documentation** (CRITICAL - often skipped!)
- [ ] Step 5: Check maintenance docs
- [ ] Step 6: Offer to auto-generate/update
- [ ] Step 7: If no updates needed, confirm

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

**CRITICAL: You MUST identify affected modules before proceeding.**

Example:
```bash
# Changed files:
src/modules/account/components/LoginForm.tsx
src/modules/account/services/auth.ts

# Identified modules:
- account
```

**3. Check if ADR needed:**

Ask these questions:
- Did we introduce a new library/framework?
- Did we change architecture patterns?
- Did we make a technical selection (A vs B)?
- Did we make important trade-off decisions?

If YES to any → ADR is required.

**4. Check module documentation:**

**CRITICAL: For EACH identified module, you MUST perform these checks:**

For each affected module, check:

a) **Module README exists?**
   - Check: `docs/modules/{module}/README.md`
   - If NO → **MUST** offer to create from template
   - If YES → Proceed to check if update needed

b) **Module documentation needs update?**
   - New components added → **MUST** update "核心组件" section
   - New API/functions exported → **MUST** update "API" section
   - Architecture changed → **MUST** update ARCHITECTURE.md
   - New examples needed → Add to examples/

c) **Component list sync:**
   - **MUST** list all components in `src/modules/{module}/components/`
   - **MUST** compare with "核心组件" table in README.md
   - **MUST** report missing or outdated entries

d) **API list sync:**
   - **MUST** check module's main export (index.ts/index.py/__init__.py)
   - **MUST** compare with "API" section in README.md
   - **MUST** report missing or outdated entries

**Example output:**
```
🔍 Checking module documentation...

Module: account
  ✓ docs/modules/account/README.md exists
  ⚠️  Found 2 new components not in documentation:
      - LoginForm (src/modules/account/components/LoginForm.tsx)
      - RegisterForm (src/modules/account/components/RegisterForm.tsx)
  ⚠️  Found 1 new API not in documentation:
      - useAuth (src/modules/account/index.ts)

Module: settings
  ✗ docs/modules/settings/README.md does NOT exist
  → Will create from template
```

**If you skip this check, you are violating the skill requirements.**

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
  - If module doc created: Update `docs/DOCUMENTATION-MAP.md` module list
  - If important ADR: Add reference to `CLAUDE.md`
  - Update `docs/plans/README.md` if design/plan documents exist
- **Auto-update module documentation:**
  - Scan `src/modules/{module}/components/` for component files
  - Update "核心组件" table in `docs/modules/{module}/README.md`
  - Scan `src/modules/{module}/index.ts` for exports
  - Update "API" section in `docs/modules/{module}/README.md`
  - Update "最后更新" timestamp
- Notify user to review and adjust

**Detailed update procedures:**

a) **Creating new module documentation:**
   ```bash
   # 1. Create module directory
   mkdir -p docs/modules/{module}

   # 2. Generate README from template
   cp templates/MODULE-README.md docs/modules/{module}/README.md

   # 3. Fill in module information:
   - Module name
   - Description (from code analysis)
   - Current components (scan src/modules/{module}/components/)
   - Current exports (scan src/modules/{module}/index.ts)
   - Related ADRs (search for module name in ADRs)

   # 4. Update DOCUMENTATION-MAP.md
   # Add entry to "模块文档" table:
   | {Module} | {Description} | [docs/modules/{module}/README.md](...) |
   ```

b) **Updating existing module documentation:**
   ```bash
   # 1. Scan for new components
   find src/modules/{module}/components -name "*.tsx" -o -name "*.ts"

   # 2. Compare with "核心组件" table in README.md

   # 3. Add missing components:
   | ComponentName | {职责} | src/modules/{module}/components/ComponentName.tsx | ✅ |

   # 4. Scan for new exports
   grep "export" src/modules/{module}/index.ts

   # 5. Compare with "API" section in README.md

   # 6. Add missing exports:
   | functionName | {描述} | {参数} | {返回值} |

   # 7. Update timestamp
   Replace "最后更新：{OLD_DATE}" with "最后更新：{TODAY}"
   ```

c) **Updating DOCUMENTATION-MAP.md:**
   ```bash
   # When new module doc created:
   # 1. Find "### 模块文档" section
   # 2. Add new row to table:
   | {Module} | {Description} | [docs/modules/{module}/README.md](...) |

   # When new ADR created:
   # 1. Find appropriate category (技术选型/架构模式/功能实现)
   # 2. Add new entry:
   - [ADR-XXX: {Title}](./adr/XXX-title.md)
   ```

**7. If no documentation needed:**
```
✅ All verifications passed
📋 No documentation updates needed
Ready to commit.
```

## Remember

Documentation is part of completion. Verification without documentation check is incomplete.

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

**PROJECT DOCUMENTATION RULES OVERRIDE THIS SKILL.**

Before proposing or writing documentation, read the project's documentation rules:

```bash
AGENTS.md
docs/README.md
docs/rules/documentation-constitution.md
```

If the project forbids or deprecates a documentation location, do not create or update that location. In particular, do not create `docs/superpowers/`, `docs/adr/`, `docs/modules/`, or `docs/DOCUMENTATION-MAP.md` unless the project explicitly allows them.

**MANDATORY CHECKLIST - DO NOT SKIP ANY STEP:**

- [ ] Step 1: Analyze code changes (git diff)
- [ ] Step 2: Identify affected modules
- [ ] Step 3: Check if a long-lived spec/rule update is needed
- [ ] Step 4: **Check project-approved documentation** (CRITICAL - often skipped!)
- [ ] Step 5: Check maintenance docs
- [ ] Step 6: Offer to auto-generate/update
- [ ] Step 7: If no updates needed, confirm

**1. Analyze code changes:**
```bash
git diff --cached --stat
git diff --cached
```

**2. Identify affected modules:**

**CRITICAL: Use your judgment to identify modules/systems that need documentation.**

Analyze the changed files and determine which modules/systems are affected:

**What qualifies as a module/system:**
- Has independent functional boundaries (e.g., authentication, user management, payment processing)
- Contains its own components, services, or APIs
- Represents a cohesive subsystem worth documenting separately
- NOT utility functions, type definitions, or configuration files

**How to identify:**
1. Get changed files: `git diff --cached --name-only`
2. Examine the directory structure and file contents
3. Use your understanding of the codebase to determine:
   - Is this part of a larger functional module?
   - Does it have its own domain logic and boundaries?
   - Would it benefit from dedicated documentation?

**Examples of modules/systems:**
- `src/modules/account/` or `src/auth/` → Authentication system
- `src/api/` or `backend/api/` → API layer
- `src/renderer/` in Electron app → Renderer process
- `myproject/payment/` → Payment processing module
- `services/notification/` → Notification service

**NOT modules/systems:**
- `src/utils/` → Utility functions (shared helpers)
- `src/types/` → Type definitions (no business logic)
- `src/config/` → Configuration files
- `tests/` → Test files (unless testing infrastructure itself)

**Check the project's approved documentation structure:**
- Read `docs/README.md` and `docs/rules/documentation-constitution.md` if present.
- Identify the approved location for current subsystem documentation.
- Treat legacy directories as historical unless the project explicitly marks them current.

**Use your judgment:** Don't rely on rigid rules. Understand the code's purpose and structure to determine what needs documentation.

**3. Check if a long-lived spec/rule update is needed:**

Ask these questions:
- Did we introduce a new library/framework?
- Did we change architecture patterns?
- Did we make a technical selection (A vs B)?
- Did we make important trade-off decisions?

If YES to any → update the project-approved long-lived documentation location. Prefer `docs/specs/` for current truth and `docs/rules/` for mandatory rules, unless the project documentation constitution says otherwise.

**4. Check project-approved documentation:**

**CRITICAL: For EACH identified subsystem, you MUST perform these checks against the project's approved documentation structure:**

For each affected subsystem, check:

a) **Approved documentation exists?**
   - Check `docs/README.md` and the project's documentation constitution to find the right location.
   - If NO → offer to create documentation in the approved location.
   - If YES → Proceed to check if update needed

b) **Documentation needs update?**
   - New components added → **MUST** update "核心组件" section
   - New API/functions exported → **MUST** update "API" section
   - Architecture changed → **MUST** update the approved architecture/spec document
   - New examples needed → Add them only if the project documentation rules allow examples

c) **Component list sync:**
   - **MUST** list relevant component files when the affected subsystem has components
   - **MUST** compare with the approved documentation, if such a component table exists
   - **MUST** report missing or outdated entries

d) **API list sync:**
   - **MUST** check module's main export (index.ts/index.py/__init__.py)
   - **MUST** compare with the approved documentation, if such an API section exists
   - **MUST** report missing or outdated entries

**Example output:**
```
🔍 Checking module documentation...

Module: account
  ✓ docs/specs/account.md exists
  ⚠️  Found 2 new components not in documentation:
      - LoginForm (src/modules/account/components/LoginForm.tsx)
      - RegisterForm (src/modules/account/components/RegisterForm.tsx)
  ⚠️  Found 1 new API not in documentation:
      - useAuth (src/modules/account/index.ts)

Module: settings
  ✗ Approved documentation does not exist
  → Will propose creating docs/specs/settings.md
```

**If you skip this check, you are violating the skill requirements.**

**5. Check maintenance docs:**

| Change Type | Document to Update |
|-------------|-------------------|
| New library added | Project-approved spec or rule |
| Architecture changed | Project-approved architecture/spec document |
| New common pattern | Project-approved spec, rule, or reference |
| Team standards changed | Project-approved rule file or root `AGENTS.md` |

**6. Offer to auto-generate:**

If documentation needed:
```
📋 Documentation updates needed:

- [ ] Spec: New library introduced (React Query)
      Target: docs/specs/<approved-name>.md

- [ ] Update: docs/specs/account.md
      - Add ComponentA to "核心组件" table
      - Add useAccountData to "API" section

- [ ] Update: AGENTS.md or docs/rules/* only if this is a mandatory rule

Should I generate/update these documents? (yes/no)
```

If user confirms:
- Use templates to generate new documents
- Update existing documents with new information
- Fill in information from code changes
- Save to appropriate locations
- **Auto-update document indexes according to project rules:**
  - Update `docs/README.md` when adding or moving a current documentation entry.
  - Update the relevant directory `README.md` if the project uses one.
  - Do not create legacy indexes such as `docs/DOCUMENTATION-MAP.md` unless explicitly allowed.
- **Auto-update approved subsystem documentation:**
  - Scan relevant component files and exports.
  - Update the approved spec/rule/reference document.
  - Update freshness metadata only if the project uses it.
- Notify user to review and adjust

**Detailed update procedures:**

a) **Creating new subsystem documentation:**
   ```bash
   # 1. Read project documentation rules
   sed -n '1,220p' docs/rules/documentation-constitution.md

   # 2. Create the approved target file
   # Example when specs/ is the approved current-truth location:
   $EDITOR docs/specs/{subsystem}.md

   # 3. Fill in module information:
   - Module name
   - Description (from code analysis)
   - Current components (scan src/modules/{module}/components/)
   - Current exports (scan src/modules/{module}/index.ts)
   - Related ADRs (search for module name in ADRs)

   # 4. Update docs/README.md or directory README if required by project rules
   ```

b) **Updating existing subsystem documentation:**
   ```bash
   # 1. Scan for new components
   find src/modules/{module}/components -name "*.tsx" -o -name "*.ts"

   # 2. Compare with the approved documentation

   # 3. Add missing components:
   | ComponentName | {职责} | src/modules/{module}/components/ComponentName.tsx | ✅ |

   # 4. Scan for new exports
   grep "export" src/modules/{module}/index.ts

   # 5. Compare with the approved API section, if one exists

   # 6. Add missing exports:
   | functionName | {描述} | {参数} | {返回值} |

   # 7. Update timestamp
   Replace "最后更新：{OLD_DATE}" with "最后更新：{TODAY}"
   ```

c) **Updating documentation indexes:**
   ```bash
   # Follow the project documentation constitution.
   # For repositories using docs/README.md as the map, update docs/README.md.
   ```

**7. If no documentation needed:**
```
✅ All verifications passed
📋 No documentation updates needed
Ready to commit.
```

## Remember

Documentation is part of completion. Verification without documentation check is incomplete.

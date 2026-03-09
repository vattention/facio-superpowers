---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch superpowers:code-reviewer subagent to catch issues before they cascade.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Check for coding conventions:**
```bash
# Check if CODING_CONVENTIONS.md exists
ls CODING_CONVENTIONS.md 2>/dev/null && echo "Found" || echo "Not found"
```

**2. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**3. Dispatch code-reviewer subagent:**

Use the Task tool to invoke the code-reviewer subagent:

```typescript
Task({
  subagent_type: "code-reviewer",
  description: "Review Task 2 implementation",
  prompt: `Review the implementation of Task 2: Add verification function.

## What Was Implemented
Verification and repair functions for conversation index with 4 issue detection types.

## Plan/Requirements
Task 2 from docs/plans/deployment-plan.md:
- Implement verifyIndex() to check for orphaned messages, missing metadata, duplicate entries, and invalid timestamps
- Implement repairIndex() with auto-fix capability
- Add progress reporting for long operations

## Git Range to Review
Base SHA: ${BASE_SHA}
Head SHA: ${HEAD_SHA}

## Review Instructions
1. Check for CODING_CONVENTIONS.md and apply project standards
2. Review code quality, architecture, and testing
3. Verify all plan requirements are met
4. Categorize issues by severity (Critical/Important/Minor)
5. Provide specific, actionable feedback`
})
```

**Key Points:**
- `subagent_type` must be `"code-reviewer"`
- Include what was implemented, plan reference, and git SHAs
- The reviewer will automatically check for `CODING_CONVENTIONS.md`
- Reviewer will ask for user confirmation if no coding conventions found

**4. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

**Scenario: Just completed Task 2 - Add verification function**

**Step 1: Get git SHAs**
```bash
BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)
echo "Reviewing changes from ${BASE_SHA} to ${HEAD_SHA}"
```

**Step 2: Dispatch code-reviewer subagent**
```typescript
Task({
  subagent_type: "code-reviewer",
  description: "Review verification functions",
  prompt: `Review the implementation against the plan.

## What Was Implemented
Verification and repair functions for conversation index:
- verifyIndex(): Detects 4 types of issues (orphaned messages, missing metadata, duplicates, invalid timestamps)
- repairIndex(): Auto-fixes detected issues
- Progress reporting for operations > 1000 items

## Plan/Requirements
Task 2 from docs/plans/deployment-plan.md:
\`\`\`
Task 2: Implement Index Verification
- Create verifyIndex() function
- Support 4 issue types detection
- Add repairIndex() with auto-fix
- Include progress indicators
\`\`\`

## Git Range
Base SHA: a7981ec
Head SHA: 3df7661

## Review Checklist
1. Check CODING_CONVENTIONS.md compliance
2. Verify all 4 issue types are detected
3. Test coverage is adequate
4. Progress reporting works correctly
5. Error handling is robust`
})
```

**Step 3: Reviewer response**
```
### Coding Standards Compliance
✅ File naming follows conventions
✅ Import paths use correct aliases
✅ Error handling follows project patterns

### Strengths
- Clean architecture with clear separation (verifyIndex.ts:1-145)
- Comprehensive test coverage (18 tests, all edge cases)
- Good error handling with fallbacks (repairIndex.ts:85-92)

### Issues

#### Important
1. **Missing progress indicators for small batches**
   - File: verifyIndex.ts:130
   - Issue: Progress only shown for > 1000 items, but plan says "all operations"
   - Fix: Add progress for any operation, use reporting interval based on size

2. **Magic number for reporting interval**
   - File: verifyIndex.ts:142
   - Issue: Hardcoded 100 as reporting interval
   - Fix: Move to config or calculate dynamically (Math.max(1, Math.floor(total / 10)))

#### Minor
1. **Test helper duplication**
   - Files: verifyIndex.test.ts, repairIndex.test.ts
   - Issue: Same test data generation in both files
   - Suggestion: Extract to shared test helpers

### Assessment
Ready to proceed with fixes to Important issues.
```

**Step 4: Fix issues and continue**
```bash
# Fix progress indicators
# Fix magic number
git add .
git commit -m "fix: address code review feedback from Task 2"

# Continue to Task 3
```

## Integration with Workflows

**Subagent-Driven Development:**
- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Executing Plans:**
- Review after each batch (3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: requesting-code-review/code-reviewer.md

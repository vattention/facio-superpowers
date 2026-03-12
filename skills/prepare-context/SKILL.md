---
name: prepare-context
description: MUST use before ANY non-trivial development. Triggers on 'implement', 'add', 'create', 'modify', 'refactor', 'build', or any feature work. Searches blueprint contexts and codebase ADRs to find existing decisions. Skip ONLY for typos/formatting/emergency hotfixes.
---

# Prepare Context for Development

## Core Principle

**Don't start coding blind.** Understand existing decisions and designs first.

2 minutes of doc review saves hours of rework.

## Quick Decision Tree

```
Is this a trivial change (typo, formatting, config tweak)?
  → YES: Skip this skill, proceed directly
  → NO: Continue below

Does the conversation already contain specific context?
  → YES: Go to "Context Already Provided" section
  → NO: Run full search process
```

## Process Overview

```
1. EXTRACT: Keywords from task description
2. SEARCH: Blueprint contexts + codebase docs
3. COMPARE: Check for spec conflicts
4. SUMMARIZE: Key constraints and recommendations
```

---

## Step 1: Extract Keywords

**Algorithm:**

1. **Parse task into noun phrases**
   - "Add user authentication" → ["user authentication", "authentication"]
   - "Fix timeline drag bug" → ["timeline", "drag", "bug"]

2. **Expand with synonyms and implementations**
   | Term | Expansions |
   |------|------------|
   | auth | login, signin, authentication, session, jwt, oauth |
   | state | store, zustand, redux, context |
   | layout | template, L1, L2, grid, flex |
   | timeline | track, clip, playhead, scrub |

3. **Include product name if mentioned**
   - "video editor timeline" → product: `video-editor`
   - "flow context management" → product: `flow`

**Output:** keyword list + optional product filter

---

## Step 2: Search Blueprint

Use MCP tools to find relevant contexts and specs.

### 2.1 Search Contexts

```typescript
// Find related discussions and decisions
mcp__facio-flow__list_contexts({
  keyword: "auth login",      // Space-separated keywords (AND logic)
  product: "video-editor",    // Optional product filter
  status: ["decided", "claimed", "open"],  // Prioritize decided
  limit: 5
})
```

### 2.2 Read Relevant Contexts

For each relevant context found:

```typescript
// Get full context with decision
mcp__facio-flow__get_context({
  contextId: "2026-02-22-user-auth",
  includeChain: true  // Include parent/child followups
})

// Check for spec/test-cases artifacts
mcp__facio-flow__manage_artifact({
  contextId: "2026-02-22-user-auth",
  action: "list"
})
```

### 2.3 Extract From Each Context

- **Title and status** (open/decided/claimed/closed)
- **Decision summary** (if decided)
- **Acceptance criteria** (if any)
- **Spec artifact** (if attached)

---

## Step 3: Search Codebase

Use file tools to find local documentation.

### 3.1 Check Standard Locations

```bash
# ADRs - architectural decisions
docs/adr/

# Plans - design documents
docs/plans/

# Specs - local specifications
docs/specs/
```

### 3.2 Search Strategy

1. **Check indexes first** - `docs/adr/README.md` for quick scan
2. **Grep for keywords** - find mentions across docs
3. **Limit to 3 files** - avoid context overflow

```typescript
// Example search
Grep({ pattern: "authentication|jwt|oauth", path: "docs/" })
Glob({ pattern: "docs/**/*auth*.md" })
```

---

## Step 4: Spec Conflict Detection

**When specs exist in BOTH blueprint AND codebase:**

1. Compare content for significant differences
2. If different, **ask user which to reference:**

```markdown
⚠️ Spec version conflict detected

Found different specs for [layout system]:
- **Blueprint** (latest design): facio-blueprint/video-editor/specs/layout-v2.md
- **Codebase** (current impl): docs/specs/layout.md

Which version should this task reference?
1. Blueprint - new feature, implement latest design
2. Codebase - bugfix, follow current implementation
```

3. If identical or only one exists → use directly without asking

---

## Step 5: Output Format

```markdown
📚 Context Preparation Complete

## Found Context
| Source | Item | Status | Key Info |
|--------|------|--------|----------|
| Blueprint | [Context Title] | decided | {decision summary} |
| Codebase | ADR-001 | adopted | {key decision} |

## Key Constraints
- {constraint from decision}
- {constraint from ADR}
- {existing pattern to follow}

## Spec Status
✅ No conflicts
-- or --
⚠️ Conflict detected (see above)

## Recommendation
✅ Proceed with development
⚠️ Review {item} before implementing
```

**Keep output lean.** Only include sections with actual findings.

---

## Special Cases

### Nothing Found

```markdown
📚 Context Preparation Complete

No relevant documentation found.

**This means:**
- Likely a new area without prior decisions
- You have design freedom

**Recommendations:**
1. Use `/brainstorming` to explore design options
2. Document architectural decisions made (create ADR after)

✅ Proceed with development
```

### Context Already Provided

If the conversation already contains:
- Specific file paths to modify
- Requirements from a spec
- Decisions from previous discussion

**Skip redundant search.** Instead:

1. Acknowledge the provided context
2. Check for conflicts with provided info only
3. Fill gaps if needed (e.g., missing ADRs)

```markdown
📚 Using Provided Context

You've already shared:
- Spec: layout-v2.md
- Files: src/components/Layout.tsx

Checking for conflicts... ✅ None found

Proceeding with provided context.
```

### Trivial Changes (Skip)

For these, skip context preparation entirely:
- Typo fixes
- Formatting changes
- Config tweaks
- Comment updates
- Import reorganization

Just proceed with the fix.

---

## Token Budget

To avoid context overflow:

| Source | Limit | What to Read |
|--------|-------|--------------|
| Blueprint contexts | 5 max | Decision/summary only, not full discussion |
| Blueprint specs | 60 lines | Skim, full read only if relevant |
| Codebase docs | 3 files | Most relevant only |
| **Total files** | <10 | Prioritize ruthlessly |

---

## Integration

```
User task arrives
       ↓
/prepare-context  ← YOU ARE HERE
       ↓
/brainstorming (if design needed)
       ↓
/writing-plans (if multi-step)
       ↓
Implementation
       ↓
/verification-before-completion
```

---

## Remember

- **Context prevents rework** - existing decisions matter
- **Ask, don't guess** - when specs conflict, let user decide
- **Lean output** - only show what's relevant
- **Skip when trivial** - don't waste time on typos

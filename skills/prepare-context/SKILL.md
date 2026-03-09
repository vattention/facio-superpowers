---
name: prepare-context
description: Use before starting development to automatically find and load relevant documentation (ADRs, design docs, specs) as context
---

# Prepare Context for Development

## Overview

Automatically search for and load relevant documentation before starting development work.

**Core principle:** Don't start coding blind - understand existing decisions and designs first.

## When to Use

**Always use before:**
- Starting a new feature
- Modifying existing functionality
- Making architectural changes
- Implementing a design

**Skip only if:**
- Trivial changes (typos, formatting)
- Emergency hotfixes (review docs after)

## Process

```
1. ANALYZE: Extract keywords from task/feature name
2. SEARCH BLUEPRINT: Find relevant contexts, specs, and product docs
3. SEARCH CODEBASE: Find relevant ADRs, plans, and local specs
4. COMPARE: Check for spec version conflicts
5. SUMMARIZE: Present findings with key constraints
6. READY: Proceed with informed context
```

## Step 1: Extract Keywords

From task/feature name, extract:
- Feature keywords (e.g., "user authentication" → ["auth", "login", "user"])
- Technical terms (e.g., "state management" → ["state", "store", "zustand"])
- Domain concepts (e.g., "layout" → ["layout", "L1", "L2", "template"])

## Step 2: Search Blueprint

**Goal:** Find relevant context discussions, decisions, and specs from facio-blueprint.

**What to find:**
- Context discussions related to the task
- Decisions that constrain implementation
- Spec documents defining requirements
- Product-level docs (vision, gaps)

**Constraints:**
- Limit to top 5 most relevant contexts
- Prioritize decided/claimed status over open
- Include product filter if known
- Check attachments for spec/test-cases artifacts

**Extract from each context:**
- Title and current status
- Decision summary (if decided)
- Acceptance criteria (if any)
- Related artifacts (spec, test-cases)

## Step 3: Search Codebase

**Goal:** Find relevant technical documentation in current project.

**What to find:**
- ADRs in `docs/adr/`
- Design documents in `docs/plans/`
- Local specs in `docs/specs/`

**Constraints:**
- Limit to 3 most relevant files
- Check README indexes first for quick navigation

## Step 4: Spec Conflict Detection

**Goal:** Ensure AI references correct spec version.

**When both blueprint and codebase have specs for the same feature:**

1. Identify if specs exist in both locations
2. Compare content for significant differences
3. If different, **ask user which version to reference:**

```
⚠️ Spec version conflict detected

Found different specs for [{feature}]:
- Blueprint (latest design)
- Codebase (current implementation)

Which version should this task reference?
1. Blueprint - new feature development, implement latest design
2. Codebase - bugfix, follow current implementation
```

4. If only one exists, or both identical → use directly without asking

## Step 5: Output Format

```markdown
📚 Context Preparation Complete

## Blueprint Contexts
- [{title}] - {status}
  Summary: {decision_summary or discussion_summary}
  Artifacts: {spec, test-cases if any}

## Blueprint Product Docs
- vision.md: {one-line summary}
- gaps.md: {relevant gaps}

## Blueprint Specs
- {spec_name}: {one-line summary}

## Codebase ADRs
- [ADR-001: {title}](path)
  Summary: {key decision}

## Codebase Specs
- {spec_name}: {comparison status with blueprint}

## Key Constraints
- {constraint from decision}
- {constraint from ADR}

## Spec Version Status
✅ Specs are in sync
-- or --
⚠️ Spec conflict detected (see above)

## Recommendations
✅ Proceed with development
⚠️ Review {specific item} before implementing
```

## If Nothing Found

```markdown
📚 Context Preparation Complete

## Search Results
No relevant documents found.

## Recommendations
- This might be a new area without prior decisions
- Consider using brainstorming skill to explore design
- Document any architectural decisions made

✅ Proceed with development
```

## Token Budget Guidelines

To avoid context overflow:
- Blueprint contexts: max 5, read decision/summary only (not full discussion)
- Blueprint specs: skim first 60 lines, full read only if relevant
- Codebase docs: max 3 files
- Total files: aim for under 10

## Integration with Other Skills

**Typical workflow:**
```
1. /prepare-context          # Load relevant docs (this skill)
2. /brainstorming            # Design approach (if needed)
3. /writing-plans            # Create implementation plan
4. Execute implementation
5. /verification-before-completion  # Verify and update docs
```

## Remember

- Context is critical for consistent architecture
- 2 minutes of doc review saves hours of rework
- When specs differ, always ask — don't guess
- This is not optional - it's part of professional development

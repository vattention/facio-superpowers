---
name: prepare-context
description: Use before starting development to automatically find and load relevant documentation (ADRs, design docs) as context
---

# Prepare Context for Development

## Overview

Before starting any development work, this skill automatically searches for and loads relevant documentation to provide context for AI tools and developers.

**Core principle:** Don't start coding blind - understand existing decisions and designs first.

## When to Use

**ALWAYS use before:**
- Starting a new feature
- Modifying existing functionality
- Making architectural changes
- Implementing a design

**Skip only if:**
- Trivial changes (typos, formatting)
- Emergency hotfixes (but review docs after)

## The Process

```
1. ANALYZE: Understand the task/feature name and scope
2. SEARCH: Find relevant documents
   - Search docs/adr/ for related ADRs
   - Search docs/plans/ for related design/plan documents
   - Search .ai/context.md for relevant guidelines
3. READ: Load relevant documents
4. SUMMARIZE: Extract key information
5. PRESENT: Show findings to user
6. READY: Proceed with informed context
```

## Search Strategy

**1. Extract keywords from task:**
- Feature name (e.g., "user authentication" → ["user", "auth", "authentication", "login"])
- Technical terms (e.g., "state management" → ["state", "zustand", "redux", "context"])
- Domain concepts (e.g., "payment" → ["payment", "stripe", "transaction"])

**2. Search ADRs:**
```bash
# Search for relevant ADRs
grep -r -i "keyword1\|keyword2\|keyword3" docs/adr/ --include="*.md"
```

**3. Search design documents:**
```bash
# Search for relevant design/plan documents
grep -r -i "keyword1\|keyword2\|keyword3" docs/plans/ --include="*.md"
```

**4. Check indexes:**
- Read docs/adr/README.md for ADR index
- Read docs/plans/README.md for design doc index

## Output Format

```markdown
📚 Context Preparation Complete

## Relevant ADRs Found
- [ADR-001: Use Zustand for state management](docs/adr/001-use-zustand.md)
  Summary: Chose Zustand over Redux for simplicity and performance
  Impact: All state management should use Zustand

- [ADR-003: Authentication strategy](docs/adr/003-auth-strategy.md)
  Summary: JWT-based authentication with refresh tokens
  Impact: Follow JWT pattern for all auth flows

## Relevant Design Documents Found
- [User Profile Design](docs/plans/2026-01-15-user-profile-design.md)
  Summary: User profile uses Zustand store, follows auth pattern
  Related: ADR-001, ADR-003

## Key Constraints
- Must use Zustand for state management (ADR-001)
- Must follow JWT auth pattern (ADR-003)
- Follow user profile component structure (design doc)

## Recommendations
✅ Proceed with development
⚠️ Review ADR-001 before implementing state logic
⚠️ Review ADR-003 before implementing auth flows
```

## If No Documents Found

```markdown
📚 Context Preparation Complete

## Search Results
No relevant ADRs or design documents found.

## Recommendations
- This might be a new area without prior decisions
- Consider creating a design document first (use brainstorming skill)
- Document any new architectural decisions (will be prompted by verification-before-completion)

✅ Proceed with development
```

## Integration with Other Skills

**Typical workflow:**
```
1. /prepare-context          # Load relevant docs
2. /brainstorming            # Design (if needed)
3. /writing-plans            # Create implementation plan
4. Execute implementation
5. /verification-before-completion  # Verify and update docs
```

**Quick workflow (with existing design):**
```
1. /prepare-context          # Load relevant docs
2. /writing-plans            # Create implementation plan
3. Execute implementation
4. /verification-before-completion  # Verify and update docs
```

## Remember

- Context is critical for consistent architecture
- 2 minutes of doc review saves hours of rework
- AI tools need context to generate appropriate code
- This is not optional - it's part of professional development

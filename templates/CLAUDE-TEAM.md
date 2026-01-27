# Project Context for Claude Code

> This file is automatically read by Claude Code at session start.
> It provides persistent context and workflow instructions.

## Project Overview

**Project Name:** [Your Project Name]
**Type:** [e.g., Electron Desktop App / Web Application / CLI Tool]
**Tech Stack:** See Technical Standards section below

## Technical Standards

### Approved Technologies

- **Frontend:** React 18 + TypeScript (strict mode)
- **State Management:** Zustand
- **Styling:** Tailwind CSS
- **Build Tool:** Vite

### Prohibited Technologies

- ❌ Redux (use Zustand instead - see ADR-001)
- ❌ Inline styles (use Tailwind CSS)
- ❌ `any` type (breaks type safety)

## Mandatory Development Workflow

### BEFORE Starting Development

**You MUST proactively remind the developer:**

```
⚠️ Development Preparation Required

Before starting development, I recommend:
1. Call /prepare-context to find relevant documentation
   - This searches for related ADRs and design documents
   - Provides context about existing architectural decisions
   - Takes ~30 seconds

Would you like me to call /prepare-context now? (yes/no)
```

**If developer agrees:**
- Immediately invoke the `prepare-context` skill
- Summarize findings before proceeding

**If developer declines:**
- Proceed but note: "Proceeding without context check. May miss existing decisions."

### AFTER Completing Development

**You MUST proactively remind the developer:**

```
⚠️ Completion Verification Required

Development complete. Before committing, I recommend:
1. Call /verification-before-completion to:
   - Run tests and verify they pass
   - Check if documentation updates needed
   - Auto-generate ADR if architectural decisions made
   - Auto-update document indexes

Would you like me to call /verification-before-completion now? (yes/no)
```

**If developer agrees:**
- Immediately invoke the `verification-before-completion` skill

**If developer declines:**
- Warn: "⚠️ Skipping verification may result in missing documentation or failing tests."

## Important Documentation

### Architecture Decision Records (ADRs)

Review these before making architectural changes:
- [ADR Index](docs/adr/README.md)
- Key ADRs:
  - [ADR-001: State Management with Zustand](docs/adr/001-use-zustand.md)
  - [ADR-002: IPC Communication Pattern](docs/adr/002-electron-ipc-pattern.md)

### Design Documents

Check for existing designs before creating new features:
- [Design Document Index](docs/plans/README.md)

### Code Examples

Follow these patterns for consistency:
- [Standard Component Structure](docs/examples/component-pattern/)
- [State Management Pattern](docs/examples/state-pattern/)

## Development Principles

1. **DRY** - Don't Repeat Yourself
2. **YAGNI** - You Aren't Gonna Need It
3. **TDD** - Test-Driven Development (write tests first)
4. **Frequent Commits** - Commit after each logical unit of work

## Code Style

- Use functional components with hooks
- Prefer composition over inheritance
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use TypeScript strict mode - no `any` types

## Testing Requirements

- Unit tests for all business logic
- Integration tests for API interactions
- E2E tests for critical user flows
- Minimum 80% code coverage

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

Types: feat, fix, docs, style, refactor, test, chore

## When in Doubt

1. Check ADRs for existing architectural decisions
2. Search design documents for similar features
3. Ask the developer for clarification
4. Document new decisions in ADRs

---

**Last Updated:** 2026-01-26
**Maintained By:** Development Team

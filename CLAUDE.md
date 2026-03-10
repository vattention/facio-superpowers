# Project Context for Claude Code

---

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

---



> **IMPORTANT:** This project follows team-wide standards.
> Team standards location: `/path/to/facio-superpowers/templates/CLAUDE-TEAM.md`
>
> **Before proceeding, you should be aware of:**
> 1. Team development workflow (see CLAUDE-TEAM.md)
> 2. Team technical standards (see CLAUDE-TEAM.md)
> 3. Project-specific information (below)

---

## Project-Specific Information

**Project Name:** [Your Project Name]
**Repository:** [Git URL]
**Team:** [Team Name]

### Project-Specific Tech Stack

In addition to team standards, this project uses:
- [Additional libraries specific to this project]
- [Project-specific tools]

### Project-Specific Constraints

- [Any project-specific constraints]
- [Special requirements]

### Project-Specific Documentation

**Important ADRs for this project:**
- [ADR-001: Project-specific decision](docs/adr/001-xxx.md)

**Key Design Documents:**
- [Feature X Design](docs/plans/2026-01-26-feature-x-design.md)

---

## Reminder: Follow Team Workflow

**This project follows the team workflow defined in CLAUDE-TEAM.md:**

1. ⚠️ **Before development:** Call `/prepare-context`
2. ⚠️ **After development:** Call `/verification-before-completion`

For detailed workflow instructions, refer to CLAUDE-TEAM.md.

---

**Note:** If team standards conflict with project-specific requirements, project-specific requirements take precedence. Document such exceptions in project ADRs.

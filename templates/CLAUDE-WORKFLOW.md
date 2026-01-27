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

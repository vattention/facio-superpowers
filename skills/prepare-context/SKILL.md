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
2. LOAD BLUEPRINT CONFIG: Read ~/.facio-flow.json to get blueprintPath
3. IDENTIFY PRODUCT: Match current project to a blueprint product
4. SEARCH: Find relevant documents from multiple sources:
   - facio-blueprint: product contexts (discussions, decisions, proposals, specs)
   - facio-blueprint: product-level docs (vision.md, gaps.md, spec/)
   - facio-blueprint: shared/contexts for cross-product topics
   - Current project: docs/adr/, docs/plans/, .ai/context.md
5. READ: Load relevant documents
6. SUMMARIZE: Extract key information
7. PRESENT: Show findings to user
8. READY: Proceed with informed context
```

## Search Strategy

**1. Extract keywords from task:**
- Feature name (e.g., "user authentication" → ["user", "auth", "authentication", "login"])
- Technical terms (e.g., "state management" → ["state", "zustand", "redux", "context"])
- Domain concepts (e.g., "payment" → ["payment", "stripe", "transaction"])

**2. Load blueprint config:**
```bash
cat ~/.facio-flow.json
# Extract blueprintPath field
```

**3. Identify current product:**
- Check git remote URL or project directory name against blueprint product directories
- List `{blueprintPath}/*/meta.json` to find matching product
- If ambiguous, ask user which product this project belongs to

**4. Search blueprint contexts (PRIMARY SOURCE):**
```bash
# Search product-specific contexts — get matching file paths
grep -r -l -i "keyword1\|keyword2" {blueprintPath}/{product}/contexts/ 2>/dev/null

# Search shared contexts
grep -r -l -i "keyword1\|keyword2" {blueprintPath}/shared/contexts/ 2>/dev/null
```

**Token guardrails for blueprint contexts:**
- Deduplicate to context directories (multiple matching files in same dir = 1 hit)
- **Limit to top 5 most relevant context directories** — skip the rest
- For each context directory, read in this priority order:
  1. `decision.md` — always read if exists (concise conclusion)
  2. `proposal.md` / `spec.md` / `interaction-design.md` — read if relevant
  3. `discussion.md` — **only read if no decision.md exists** (discussions are long)

**5. Read product-level blueprint docs:**
- `{blueprintPath}/{product}/vision.md` — always read (usually short)
- `{blueprintPath}/{product}/gaps.md` — always read (usually short)
- `{blueprintPath}/{product}/spec/` — **do NOT read full spec files**; run `head -60` on candidate files first, then decide if full read is needed

**6. Search current project docs (SECONDARY SOURCE):**
```bash
# Search for relevant ADRs
grep -r -i "keyword1\|keyword2" docs/adr/ --include="*.md" 2>/dev/null

# Search for relevant design/plan documents
grep -r -i "keyword1\|keyword2" docs/plans/ --include="*.md" 2>/dev/null
```

**7. Check indexes:**
- Read `docs/adr/README.md` for ADR index
- Read `docs/plans/README.md` for design doc index

**Overall token budget:**
- Blueprint contexts: max 5 dirs × ~1 file each
- Blueprint product docs: vision.md + gaps.md only
- Current project docs: max 3 files
- If you find yourself about to read more than ~10 files total, stop and be more selective

## Output Format

```markdown
📚 Context Preparation Complete

## Blueprint: Product Context ({product})
- [2026-02-14: 属性复制粘贴快捷键]({blueprintPath}/{product}/contexts/2026-02-14-.../decision.md)
  Summary: 决定使用 Cmd+Shift+C/V 快捷键，避免与系统冲突
  Type: decision

- [2026-02-11: Chat 面板交互工具]({blueprintPath}/{product}/contexts/.../discussion.md)
  Summary: 正在讨论 interact 工具的交互模式
  Type: discussion (open)

## Blueprint: Product-Level Docs
- vision.md: 产品愿景 — 对话式视频编辑 + AI 多模态能力
- gaps.md: 当前缺口 — 缺少批量操作支持

## Blueprint: Shared Contexts
- (none relevant)

## Current Project: Relevant ADRs
- [ADR-001: Use Zustand for state management](docs/adr/001-use-zustand.md)
  Summary: Chose Zustand over Redux for simplicity and performance

## Current Project: Design Documents
- [User Profile Design](docs/plans/2026-01-15-user-profile-design.md)
  Summary: User profile uses Zustand store

## Key Constraints
- Must follow keyboard shortcut convention from blueprint decision
- Must use Zustand for state management (ADR-001)

## Recommendations
✅ Proceed with development
⚠️ Review the relevant blueprint decisions before implementing
```

## If No Documents Found

```markdown
📚 Context Preparation Complete

## Search Results
No relevant documents found in blueprint or project docs.

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

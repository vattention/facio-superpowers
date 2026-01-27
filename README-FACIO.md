# Facio Superpowers

Documentation management extension for AI-assisted development with Claude Code and Cursor.

Built on top of [obra/superpowers](https://github.com/obra/superpowers), adding automatic documentation management capabilities.

## Quick Start

### Prerequisites

Make sure your project is initialized with Claude Code first:

```bash
cd your-project
claude init
```

This creates the basic `CLAUDE.md` file for your project.

### Initialize Facio Superpowers

```bash
npx facio-superpowers init
```

This will:
- ✅ Install custom skills (verification-before-completion, prepare-context)
- ✅ Create documentation structure (docs/adr, docs/plans, templates)
- ✅ **Inject workflow instructions into your existing CLAUDE.md**
- ✅ Create document indexes

**Note:** If `CLAUDE.md` doesn't exist, the command will prompt you to run `claude init` first.

### Sync to latest version

```bash
npx facio-superpowers sync
```

## What's Different from Original Superpowers?

### New Skills

**`/prepare-context`** - Before development
- Automatically searches for relevant ADRs and design documents
- Provides context about existing architectural decisions
- Prevents violating established patterns

**Enhanced `/verification-before-completion`**
- Original: Runs tests and verifies they pass
- **New**: Auto-generates ADR if architectural decisions made
- **New**: Auto-updates document indexes (docs/adr/README.md, docs/plans/README.md)
- **New**: Auto-updates CLAUDE.md with important ADR references

### Automatic Documentation

**Architecture Decision Records (ADR)**
- Automatically generated when you make architectural decisions
- Tracks decision history and rationale
- Links related decisions

**Document Indexes**
- Automatically maintained
- Easy to search and reference

### Configuration Files

**`CLAUDE.md`** - Project-specific configuration
- Automatically read by Claude Code at session start
- Contains workflow instructions that trigger automatic reminders
- References team standards

**`CLAUDE-TEAM.md`** - Team-wide standards
- Shared across all projects
- Contains technical standards and workflow instructions

## Recommended Workflow

```
1. /prepare-context              # Load relevant docs (auto-reminded)
2. /brainstorming                # Design (if needed)
3. /writing-plans                # Create implementation plan
4. [Implement]
5. /verification-before-completion  # Verify and update docs (auto-reminded)
```

### How Auto-Reminders Work

When you start development, Claude Code reads `CLAUDE.md` and will automatically remind you:

```
⚠️ Development Preparation Required

Before starting development, I recommend:
1. Call /prepare-context to find relevant documentation

Would you like me to call /prepare-context now? (yes/no)
```

After completing development:

```
⚠️ Completion Verification Required

Development complete. Before committing, I recommend:
1. Call /verification-before-completion

Would you like me to call /verification-before-completion now? (yes/no)
```

## Documentation Structure

```
your-project/
├── CLAUDE.md                    # Project config (auto-read by Claude Code)
├── CLAUDE-TEAM.md               # Team standards
├── .claude/skills/              # Custom skills
│   ├── prepare-context/
│   └── verification-before-completion/
├── docs/
│   ├── adr/                     # Architecture Decision Records
│   │   ├── 001-use-zustand.md
│   │   └── README.md            # Auto-maintained index
│   ├── plans/                   # Design docs & implementation plans
│   │   ├── 2026-01-26-feature-design.md
│   │   ├── 2026-01-26-feature.md
│   │   └── README.md            # Auto-maintained index
│   └── examples/                # Code examples
├── templates/
│   └── adr-template.md
└── scripts/
    └── sync-skills.sh
```

## Benefits

### For Developers
- ⏱️ **Save time**: No manual doc search, auto-reminders
- 🎯 **Stay consistent**: Auto-check against existing decisions
- 📝 **Auto-documentation**: ADRs generated automatically
- 🔔 **Never forget**: Automatic workflow reminders

### For Teams
- 🤝 **Knowledge sharing**: All decisions documented
- 🔄 **Onboarding**: New members understand context quickly
- 📊 **Traceability**: Track architectural evolution
- 🔗 **Context preservation**: Documents linked and indexed

## Installation Options

### Option 1: NPX (Recommended)

```bash
cd your-project
npx facio-superpowers init
```

### Option 2: Manual

```bash
# Clone the repository
git clone https://github.com/your-org/facio-superpowers.git

# Copy to your project
cd your-project
cp -r ../facio-superpowers/skills/verification-before-completion .claude/skills/
cp -r ../facio-superpowers/skills/prepare-context .claude/skills/
cp ../facio-superpowers/templates/adr-template.md templates/
cp ../facio-superpowers/templates/CLAUDE-TEAM.md ./
cp ../facio-superpowers/templates/CLAUDE-PROJECT.md ./CLAUDE.md
```

## Configuration

### Customize CLAUDE.md

After running `init`, edit `CLAUDE.md` to add:
- Project name and description
- Project-specific tech stack
- Important ADRs and design documents

### Update Team Standards

Edit `CLAUDE-TEAM.md` to define:
- Team-wide technical standards
- Approved/prohibited technologies
- Development workflow
- Code style guidelines

## FAQ

**Q: Do I need to run init for every project?**
A: Yes, each project needs its own setup. But it only takes 10 seconds with npx.

**Q: What happens to my existing CLAUDE.md?**
A: The init command will **inject** workflow instructions at the top of your existing CLAUDE.md, preserving all your existing content. It won't overwrite anything.

**Q: Can I run init multiple times?**
A: Yes, it's safe. The command checks if workflow instructions are already present and won't duplicate them.

**Q: What if I don't have CLAUDE.md yet?**
A: The init command will prompt you to run `claude init` first to create the basic CLAUDE.md file.

**Q: Will this work with Cursor?**
A: Yes! Skills are installed to both `.claude/skills` and `.cursor/skills`. For Cursor, use `.cursorrules` instead of `CLAUDE.md`.

**Q: How often should I sync?**
A: Only when facio-superpowers has updates. Skills are relatively stable.

**Q: Can I customize the skills?**
A: Yes, after init, skills are in your project. You can modify them.

**Q: What if I already have CLAUDE.md?**
A: The init command will not overwrite existing files. You can manually merge the content.

**Q: Do I need the original superpowers?**
A: No, facio-superpowers includes everything you need. But it's compatible with original superpowers skills.

## Comparison with Original Superpowers

| Feature | Original Superpowers | Facio Superpowers |
|---------|---------------------|-------------------|
| Brainstorming | ✅ | ✅ |
| Writing Plans | ✅ | ✅ |
| TDD | ✅ | ✅ |
| Code Review | ✅ | ✅ |
| **Auto Context Search** | ❌ | ✅ |
| **Auto ADR Generation** | ❌ | ✅ |
| **Auto Doc Indexing** | ❌ | ✅ |
| **Auto Workflow Reminders** | ❌ | ✅ |

## Credits

Built on top of [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

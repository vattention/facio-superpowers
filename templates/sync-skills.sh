#!/bin/bash
# Sync skills from facio-superpowers
# Usage: ./scripts/sync-skills.sh [path-to-facio-superpowers]

set -e

# Get superpowers path from argument or environment variable
SUPERPOWERS_PATH="${1:-${SUPERPOWERS_PATH}}"

if [ -z "$SUPERPOWERS_PATH" ]; then
    echo "❌ Error: Please provide path to facio-superpowers"
    echo ""
    echo "Usage:"
    echo "  ./scripts/sync-skills.sh /path/to/facio-superpowers"
    echo ""
    echo "Or set environment variable:"
    echo "  export SUPERPOWERS_PATH=/path/to/facio-superpowers"
    echo "  ./scripts/sync-skills.sh"
    exit 1
fi

if [ ! -d "$SUPERPOWERS_PATH" ]; then
    echo "❌ Error: Directory not found: $SUPERPOWERS_PATH"
    exit 1
fi

echo "🔄 Syncing skills from $SUPERPOWERS_PATH..."

# Sync skills
echo "  - verification-before-completion"
cp -r "$SUPERPOWERS_PATH/skills/verification-before-completion" .claude/skills/
cp -r "$SUPERPOWERS_PATH/skills/verification-before-completion" .cursor/skills/
cp -r "$SUPERPOWERS_PATH/skills/prepare-context" .claude/skills/
cp -r "$SUPERPOWERS_PATH/skills/prepare-context" .cursor/skills/

# Sync templates
echo "  - adr-template.md"
cp "$SUPERPOWERS_PATH/templates/adr-template.md" templates/

echo "  - CLAUDE-TEAM.md"
cp "$SUPERPOWERS_PATH/templates/CLAUDE-TEAM.md" ./

echo ""
echo "✅ Sync complete!"
echo ""
echo "Changed files:"
git status --short .claude/skills/ templates/ CLAUDE-TEAM.md

echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Commit: git add . && git commit -m 'chore: update skills'"
echo "3. Push: git push"

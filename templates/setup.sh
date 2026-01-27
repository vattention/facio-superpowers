#!/bin/bash
# Project setup script
# Run this after cloning the project

set -e

echo "🚀 Setting up project..."

# Check if facio-superpowers exists
SUPERPOWERS_PATH="${SUPERPOWERS_PATH:-../facio-superpowers}"

if [ ! -d "$SUPERPOWERS_PATH" ]; then
    echo "❌ Error: facio-superpowers not found at $SUPERPOWERS_PATH"
    echo ""
    echo "Please either:"
    echo "1. Clone facio-superpowers to the parent directory:"
    echo "   cd .. && git clone <repo-url> facio-superpowers"
    echo ""
    echo "2. Or set SUPERPOWERS_PATH environment variable:"
    echo "   export SUPERPOWERS_PATH=/path/to/facio-superpowers"
    echo "   ./scripts/setup.sh"
    exit 1
fi

echo "✅ Found facio-superpowers at $SUPERPOWERS_PATH"

# Create .claude/skills directory
mkdir -p .claude/skills

# Create symbolic link (relative path)
echo "Creating symbolic link for verification-before-completion..."
cd .claude/skills
ln -sf ../../../facio-superpowers/skills/verification-before-completion verification-before-completion
cd ../..

# Create templates directory
mkdir -p templates

# Copy templates
echo "Copying templates..."
cp "$SUPERPOWERS_PATH/templates/adr-template.md" templates/
cp "$SUPERPOWERS_PATH/templates/CLAUDE-TEAM.md" ./CLAUDE-TEAM.md

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Review CLAUDE-TEAM.md for team standards"
echo "2. Create your CLAUDE.md based on CLAUDE-PROJECT.md template"
echo "3. Start coding!"

#!/usr/bin/env node

/**
 * Facio Superpowers CLI
 * Initialize documentation management for AI-assisted development
 *
 * Usage:
 *   npx facio-superpowers init
 *   npx facio-superpowers sync
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SUPERPOWERS_REPO = 'https://github.com/vattention/facio-superpowers.git';
const CACHE_DIR = path.join(process.env.HOME, '.facio-superpowers');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function ensureCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    log('📦 Downloading facio-superpowers...', 'blue');
    execSync(`git clone ${SUPERPOWERS_REPO} ${CACHE_DIR}`, { stdio: 'inherit' });
  } else {
    log('🔄 Updating facio-superpowers...', 'blue');
    execSync('git pull', { cwd: CACHE_DIR, stdio: 'inherit' });
  }
}

function init() {
  log('\n🚀 Initializing Facio Superpowers\n', 'green');

  // Ensure cache exists
  ensureCache();

  const cwd = process.cwd();

  // Create directories
  log('📁 Creating directories...', 'blue');
  const dirs = [
    '.claude/skills',
    '.cursor/skills',
    'docs/adr',
    'docs/plans',
    'docs/modules',
    'docs/examples',
    'templates',
    'scripts',
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(cwd, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      log(`  ✓ ${dir}`, 'green');
    } else {
      log(`  - ${dir} (already exists)`, 'yellow');
    }
  });

  // Copy skills
  log('\n📚 Installing skills...', 'blue');
  const skills = ['verification-before-completion', 'prepare-context'];

  skills.forEach(skill => {
    const src = path.join(CACHE_DIR, 'skills', skill);
    const claudeDest = path.join(cwd, '.claude/skills', skill);
    const cursorDest = path.join(cwd, '.cursor/skills', skill);

    if (fs.existsSync(src)) {
      // Copy to .claude/skills
      if (fs.existsSync(claudeDest)) {
        fs.rmSync(claudeDest, { recursive: true });
      }
      copyRecursive(src, claudeDest);

      // Copy to .cursor/skills
      if (fs.existsSync(cursorDest)) {
        fs.rmSync(cursorDest, { recursive: true });
      }
      copyRecursive(src, cursorDest);

      log(`  ✓ ${skill}`, 'green');
    } else {
      log(`  ✗ ${skill} (not found)`, 'red');
    }
  });

  // Copy templates
  log('\n📄 Installing templates...', 'blue');
  const templates = [
    { src: 'adr-template.md', dest: 'templates/adr-template.md' },
    { src: 'README-ROOT.md', dest: 'templates/README-ROOT.md' },
    { src: 'DOCUMENTATION-MAP.md', dest: 'templates/DOCUMENTATION-MAP.md' },
    { src: 'MODULE-README.md', dest: 'templates/MODULE-README.md' },
    { src: 'MODULE-ARCHITECTURE.md', dest: 'templates/MODULE-ARCHITECTURE.md' },
    { src: 'CLAUDE-TEAM.md', dest: 'CLAUDE-TEAM.md' },
    { src: 'CLAUDE-PROJECT.md', dest: 'CLAUDE.md' },
  ];

  templates.forEach(({ src, dest }) => {
    const srcPath = path.join(CACHE_DIR, 'templates', src);
    const destPath = path.join(cwd, dest);

    if (fs.existsSync(srcPath)) {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        log(`  ✓ ${dest}`, 'green');
      } else {
        log(`  - ${dest} (already exists, skipping)`, 'yellow');
      }
    }
  });

  // Copy sync script
  const syncScriptSrc = path.join(CACHE_DIR, 'templates', 'sync-skills.sh');
  const syncScriptDest = path.join(cwd, 'scripts', 'sync-skills.sh');

  if (fs.existsSync(syncScriptSrc)) {
    fs.copyFileSync(syncScriptSrc, syncScriptDest);
    fs.chmodSync(syncScriptDest, '755');
    log('  ✓ scripts/sync-skills.sh', 'green');
  }

  // Create README indexes
  log('\n📋 Creating document indexes...', 'blue');

  const adrReadme = path.join(cwd, 'docs/adr/README.md');
  if (!fs.existsSync(adrReadme)) {
    fs.writeFileSync(adrReadme, `# Architecture Decision Records

## Current Decisions

| Number | Title | Date | Status |
|--------|-------|------|--------|
| - | No ADRs yet | - | - |

## How to Add ADR

Use \`/verification-before-completion\` skill after making architectural decisions.
`);
    log('  ✓ docs/adr/README.md', 'green');
  }

  const plansReadme = path.join(cwd, 'docs/plans/README.md');
  if (!fs.existsSync(plansReadme)) {
    fs.writeFileSync(plansReadme, `# Design Documents & Implementation Plans

## Recent Documents

| Date | Feature | Type | Status |
|------|---------|------|--------|
| - | No documents yet | - | - |

## How to Create

- Design: Use \`/brainstorming\` skill
- Implementation Plan: Use \`/writing-plans\` skill
`);
    log('  ✓ docs/plans/README.md', 'green');
  }

  // Handle CLAUDE.md
  log('\n⚙️  Configuring CLAUDE.md...', 'blue');
  const claudeMd = path.join(cwd, 'CLAUDE.md');

  if (!fs.existsSync(claudeMd)) {
    // No CLAUDE.md exists - prompt user to run claude init first
    log('  ⚠️  CLAUDE.md not found', 'yellow');
    log('', 'reset');
    log('It looks like this project hasn\'t been initialized with Claude Code yet.', 'yellow');
    log('', 'reset');
    log('Please run this first:', 'blue');
    log('  claude init', 'green');
    log('', 'reset');
    log('Then run facio-superpowers init again.', 'blue');
    log('', 'reset');
    process.exit(1);
  }

  // CLAUDE.md exists - inject workflow instructions at the top
  let content = fs.readFileSync(claudeMd, 'utf8');

  // Check if workflow already injected
  if (content.includes('## Mandatory Development Workflow')) {
    log('  - CLAUDE.md already configured (workflow found)', 'yellow');
  } else {
    // Read workflow template
    const workflowTemplate = fs.readFileSync(
      path.join(CACHE_DIR, 'templates', 'CLAUDE-WORKFLOW.md'),
      'utf8'
    );

    // Inject at the top (after the first heading)
    const lines = content.split('\n');
    let insertIndex = 0;

    // Find the first heading
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('# ')) {
        insertIndex = i + 1;
        break;
      }
    }

    // Insert workflow after first heading
    lines.splice(insertIndex, 0, '', workflowTemplate, '');
    content = lines.join('\n');

    fs.writeFileSync(claudeMd, content);
    log('  ✓ Injected workflow instructions into CLAUDE.md', 'green');
  }

  // Copy modular docs guide
  log('\n📖 Installing documentation guide...', 'blue');
  const docsGuide = path.join(CACHE_DIR, 'MODULAR-DOCS-GUIDE.md');
  const docsGuideDest = path.join(cwd, 'docs', 'MODULAR-DOCS-GUIDE.md');

  if (fs.existsSync(docsGuide)) {
    if (!fs.existsSync(docsGuideDest)) {
      fs.copyFileSync(docsGuide, docsGuideDest);
      log('  ✓ docs/MODULAR-DOCS-GUIDE.md', 'green');
    } else {
      log('  - docs/MODULAR-DOCS-GUIDE.md (already exists)', 'yellow');
    }
  }

  // Success message
  log('\n✅ Initialization complete!\n', 'green');
  log('Next steps:', 'blue');
  log('1. Review docs/MODULAR-DOCS-GUIDE.md for documentation system overview');
  log('2. Edit CLAUDE.md to add project-specific information');
  log('3. Review CLAUDE-TEAM.md for team standards');
  log('4. Create module documentation:');
  log('   mkdir -p docs/modules/your-module');
  log('   cp templates/MODULE-README.md docs/modules/your-module/README.md');
  log('5. Start using skills:');
  log('   - /prepare-context (before development)');
  log('   - /verification-before-completion (after development)');
  log('\n📚 Documentation: https://github.com/vattention/facio-superpowers\n');
}

function sync() {
  log('\n🔄 Syncing skills from facio-superpowers\n', 'blue');

  ensureCache();

  const cwd = process.cwd();

  // Sync skills
  log('📚 Updating skills...', 'blue');
  const skills = ['verification-before-completion', 'prepare-context'];

  skills.forEach(skill => {
    const src = path.join(CACHE_DIR, 'skills', skill);
    const claudeDest = path.join(cwd, '.claude/skills', skill);
    const cursorDest = path.join(cwd, '.cursor/skills', skill);

    if (fs.existsSync(src)) {
      if (fs.existsSync(claudeDest)) {
        fs.rmSync(claudeDest, { recursive: true });
      }
      copyRecursive(src, claudeDest);

      if (fs.existsSync(cursorDest)) {
        fs.rmSync(cursorDest, { recursive: true });
      }
      copyRecursive(src, cursorDest);

      log(`  ✓ ${skill}`, 'green');
    }
  });

  // Sync templates
  log('\n📄 Updating templates...', 'blue');
  const templates = [
    { src: 'adr-template.md', dest: 'templates/adr-template.md' },
    { src: 'README-ROOT.md', dest: 'templates/README-ROOT.md' },
    { src: 'DOCUMENTATION-MAP.md', dest: 'templates/DOCUMENTATION-MAP.md' },
    { src: 'MODULE-README.md', dest: 'templates/MODULE-README.md' },
    { src: 'MODULE-ARCHITECTURE.md', dest: 'templates/MODULE-ARCHITECTURE.md' },
    { src: 'CLAUDE-TEAM.md', dest: 'CLAUDE-TEAM.md' },
  ];

  templates.forEach(({ src, dest }) => {
    const srcPath = path.join(CACHE_DIR, 'templates', src);
    const destPath = path.join(cwd, dest);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      log(`  ✓ ${dest}`, 'green');
    }
  });

  // Sync modular docs guide
  log('\n📖 Updating documentation guide...', 'blue');
  const docsGuide = path.join(CACHE_DIR, 'MODULAR-DOCS-GUIDE.md');
  const docsGuideDest = path.join(cwd, 'docs', 'MODULAR-DOCS-GUIDE.md');

  if (fs.existsSync(docsGuide)) {
    fs.copyFileSync(docsGuide, docsGuideDest);
    log('  ✓ docs/MODULAR-DOCS-GUIDE.md', 'green');
  }

  log('\n✅ Sync complete!\n', 'green');
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const files = fs.readdirSync(src);
    files.forEach(file => {
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// CLI
const command = process.argv[2];

switch (command) {
  case 'init':
    init();
    break;
  case 'sync':
    sync();
    break;
  default:
    log('\nFacio Superpowers CLI\n', 'green');
    log('Usage:');
    log('  npx facio-superpowers init    Initialize project with skills and templates');
    log('  npx facio-superpowers sync    Sync skills to latest version');
    log('\n');
    break;
}

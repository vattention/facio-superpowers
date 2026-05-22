// scripts-role-lookup.mjs — superpowers shared util for role-bindings.yaml lookup.
// Used by spec-ratifier Step 2 to map frontmatter `owners.{pm,designer,engineer}`
// GH login → { id: Lark open_id, name: display name } for Lark card <at> mentions.
//
// Project-side install path: scripts/role-lookup.mjs (via cli.js init --harness)
//
// CLI entry: `node scripts/role-lookup.mjs <yaml-path> <gh-login>`
//   stdout: "<open_id>\t<name>" on hit, exit 0
//   stderr: error message, exit 1 on miss / parse error / file missing

import { readFileSync, existsSync } from 'node:fs';

// Minimal YAML parser — enough for role-bindings.yaml shape we care about.
// We only need to find `users:` list items with `id:`, `name:`, `github_login:` fields.
// Avoid pulling in `yaml` npm dep — keeps install footprint zero.
export function loadRoleBindings(yamlPath) {
  if (!existsSync(yamlPath)) {
    throw new Error(`role-bindings.yaml not found at: ${yamlPath}`);
  }
  const raw = readFileSync(yamlPath, 'utf8');
  const lines = raw.split('\n');

  const users = [];
  let inUsers = false;
  let current = null;

  for (const line of lines) {
    // End of users: block (next top-level key or end of file)
    if (inUsers && /^[A-Za-z]/.test(line)) {
      if (current) users.push(current);
      current = null;
      inUsers = false;
    }
    if (line.startsWith('users:')) {
      inUsers = true;
      // Inline `users: []`
      if (/users:\s*\[\s*\]/.test(line)) {
        return { users: [] };
      }
      continue;
    }
    if (!inUsers) continue;

    // New list item: `  - id: ou_xxx` or `  - key: value`
    const itemMatch = line.match(/^\s*-\s+(\w+):\s*(.*)$/);
    if (itemMatch) {
      if (current) users.push(current);
      current = {};
      const [, key, val] = itemMatch;
      current[key] = stripQuotes(val);
      continue;
    }
    // Continued field: `    key: value`
    const fieldMatch = line.match(/^\s{4,}(\w+):\s*(.*)$/);
    if (fieldMatch && current) {
      const [, key, val] = fieldMatch;
      current[key] = stripQuotes(val);
    }
  }
  if (current) users.push(current);

  return { users };
}

function stripQuotes(s) {
  if (!s) return s;
  return s.replace(/^["']|["']$/g, '').trim();
}

export function lookupByGithubLogin(yamlPath, ghLogin) {
  const { users } = loadRoleBindings(yamlPath);
  if (users.length === 0) {
    throw new Error(`role-bindings.yaml has empty users[]; cannot resolve GH login '${ghLogin}'`);
  }
  const hit = users.find(u => u.github_login === ghLogin);
  if (!hit) {
    throw new Error(
      `GH login '${ghLogin}' not found in role-bindings.yaml.\n` +
      `Add or update a user entry in ${yamlPath}:\n` +
      `  - id: ou_<your-lark-open-id>\n` +
      `    name: <display name>\n` +
      `    github_login: ${ghLogin}\n` +
      `    function: <frontend-dev|non-frontend-dev|non-dev>\n` +
      `    strictness: <low|medium|high>\n`
    );
  }
  if (!hit.id) {
    throw new Error(`user entry for '${ghLogin}' missing required 'id' field (Lark open_id)`);
  }
  return { id: hit.id, name: hit.name || ghLogin };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , yamlPath, ghLogin] = process.argv;
  if (!yamlPath || !ghLogin) {
    console.error('Usage: role-lookup.mjs <yaml-path> <gh-login>');
    process.exit(2);
  }
  try {
    const { id, name } = lookupByGithubLogin(yamlPath, ghLogin);
    process.stdout.write(`${id}\t${name}\n`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

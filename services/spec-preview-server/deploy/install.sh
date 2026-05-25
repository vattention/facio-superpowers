#!/usr/bin/env bash
# install.sh — idempotent EC2 setup for spec-preview-server.
# Run AS ROOT on the target EC2.
#
# Usage:
#   sudo bash install.sh '<name>:<git-url>[,<name>:<git-url>...]'
# Example:
#   sudo bash install.sh 'facio-blueprint:git@github.com:vattention/facio-blueprint.git'

set -euo pipefail

REPOS_ARG="${1:-}"
if [ -z "$REPOS_ARG" ]; then
  echo "Usage: $0 'name:git-url,name:git-url'"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. Create dedicated user (idempotent)
if ! id -u specs >/dev/null 2>&1; then
  useradd -r -m -d /var/lib/specs -s /bin/bash specs
  echo "✓ created user 'specs'"
fi

# 2. Verify SSH key exists for the specs user
SSH_KEY=/var/lib/specs/.ssh/id_ed25519
if [ ! -f "$SSH_KEY" ]; then
  echo "✗ SSH key missing: $SSH_KEY"
  echo "  Run first (as root):"
  echo "    sudo -u specs ssh-keygen -t ed25519 -f $SSH_KEY -N ''"
  echo "    sudo -u specs cat $SSH_KEY.pub"
  echo "  Then add the public key as a deploy key on each GitHub repo."
  exit 2
fi

# Make sure GitHub is in known_hosts to avoid first-connect prompt
sudo -u specs bash -c '[ -f /var/lib/specs/.ssh/known_hosts ] && grep -q github.com /var/lib/specs/.ssh/known_hosts || ssh-keyscan -t ed25519 github.com >> /var/lib/specs/.ssh/known_hosts 2>/dev/null'

# 3. Clone repos
mkdir -p /var/lib/specs
chown specs:specs /var/lib/specs
IFS=',' read -ra REPO_ENTRIES <<< "$REPOS_ARG"
REPOS_CONFIG=""
for ENTRY in "${REPO_ENTRIES[@]}"; do
  NAME="${ENTRY%%:*}"
  URL="${ENTRY#*:}"
  TARGET="/var/lib/specs/$NAME"
  if [ ! -d "$TARGET/.git" ]; then
    sudo -u specs git clone "$URL" "$TARGET"
    echo "✓ cloned $NAME → $TARGET"
  else
    echo "ℹ $NAME already cloned at $TARGET (skipping)"
  fi
  REPOS_CONFIG="${REPOS_CONFIG}${NAME}:${TARGET},"
done
REPOS_CONFIG="${REPOS_CONFIG%,}"

# 4. Install server.mjs
mkdir -p /opt/spec-preview-server
cp "$SCRIPT_DIR/../server.mjs" /opt/spec-preview-server/server.mjs
chmod 755 /opt/spec-preview-server/server.mjs

# 5. Write env file
cat > /etc/spec-preview-server.env <<EOF
SPEC_PREVIEW_REPOS=$REPOS_CONFIG
EOF
chmod 600 /etc/spec-preview-server.env

# 6. Install systemd unit
cp "$SCRIPT_DIR/../systemd/spec-preview-server.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now spec-preview-server

# 7. Verify
sleep 2
if systemctl is-active --quiet spec-preview-server; then
  echo "✓ spec-preview-server running on port 8080"
  curl -s http://localhost:8080/healthz && echo
else
  echo "✗ service failed to start; inspect logs:"
  echo "    journalctl -u spec-preview-server -n 50"
  exit 3
fi

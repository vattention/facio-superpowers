#!/usr/bin/env bash
# install.sh — idempotent EC2 setup for spec-preview-server.
# Run AS ROOT on the target EC2.
#
# The server clones any repo in the configured GitHub org ON DEMAND using a
# GitHub App installation token (no per-repo deploy keys). The GitHub App must
# be installed on the org with `contents:read` permission.
#
# Usage:
#   sudo bash install.sh \
#     --org vattention \
#     --app-id <app-id> \
#     --installation-id <installation-id> \
#     --private-key <path/to/app-private-key.pem> \
#     [--preseed name,name]
#
# Example:
#   sudo bash install.sh \
#     --org vattention \
#     --app-id 123456 \
#     --installation-id 78901234 \
#     --private-key ./spec-preview.private-key.pem \
#     --preseed facio-blueprint,facio-flow

set -euo pipefail

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
ORG="vattention"
APP_ID=""
INSTALLATION_ID=""
PRIVATE_KEY_SRC=""
PRESEED=""

while [ $# -gt 0 ]; do
  case "$1" in
    --org)             ORG="${2:-}"; shift 2 ;;
    --app-id)          APP_ID="${2:-}"; shift 2 ;;
    --installation-id) INSTALLATION_ID="${2:-}"; shift 2 ;;
    --private-key)     PRIVATE_KEY_SRC="${2:-}"; shift 2 ;;
    --preseed)         PRESEED="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,23p' "$0"
      exit 0 ;;
    *)
      echo "✗ unknown argument: $1" >&2
      echo "  run '$0 --help' for usage" >&2
      exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Validate required flags (never echo the key contents)
# ---------------------------------------------------------------------------
MISSING=()
[ -z "$APP_ID" ]          && MISSING+=("--app-id")
[ -z "$INSTALLATION_ID" ] && MISSING+=("--installation-id")
[ -z "$PRIVATE_KEY_SRC" ] && MISSING+=("--private-key")
if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "✗ missing required argument(s): ${MISSING[*]}" >&2
  echo "  run '$0 --help' for usage" >&2
  exit 1
fi
if [ ! -f "$PRIVATE_KEY_SRC" ]; then
  echo "✗ private key file not found: $PRIVATE_KEY_SRC" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KEY_DEST=/etc/spec-preview-server.key
ENV_FILE=/etc/spec-preview-server.env
INSTALL_DIR=/opt/spec-preview-server
CACHE_DIR=/var/lib/specs

# ---------------------------------------------------------------------------
# 1. Create dedicated user (idempotent)
# ---------------------------------------------------------------------------
if ! id -u specs >/dev/null 2>&1; then
  useradd -r -m -d "$CACHE_DIR" -s /bin/bash specs
  echo "✓ created user 'specs'"
fi

# ---------------------------------------------------------------------------
# 2. Cache dir (world-cloneable RW clone cache, owned by specs)
# ---------------------------------------------------------------------------
mkdir -p "$CACHE_DIR"
chown specs:specs "$CACHE_DIR"

# ---------------------------------------------------------------------------
# 3. Install the GitHub App private key OUTSIDE the RW clone cache.
#    /etc/spec-preview-server.key — owner specs, chmod 600. Deliberately NOT
#    under /var/lib/specs (which the service clones into / is world-readable).
# ---------------------------------------------------------------------------
install -o specs -g specs -m 600 "$PRIVATE_KEY_SRC" "$KEY_DEST"
echo "✓ installed GitHub App private key → $KEY_DEST (chmod 600, owner specs)"

# ---------------------------------------------------------------------------
# 4. Install ALL server .mjs modules (exclude *.test.mjs).
# ---------------------------------------------------------------------------
mkdir -p "$INSTALL_DIR"
for f in server.mjs github-app.mjs provision.mjs git-show.mjs error-page.mjs; do
  cp "$SCRIPT_DIR/../$f" "$INSTALL_DIR/$f"
  chmod 644 "$INSTALL_DIR/$f"
done
echo "✓ installed server modules → $INSTALL_DIR"

# ---------------------------------------------------------------------------
# 5. Write env file (chmod 600). Prefer the key PATH form over inline PEM.
#    SPEC_PREVIEW_REPOS is OPTIONAL (warm-cache pre-seed hint) — written only
#    when --preseed was given.
# ---------------------------------------------------------------------------
umask 077
{
  echo "GITHUB_ORG=$ORG"
  echo "GITHUB_APP_ID=$APP_ID"
  echo "GITHUB_APP_INSTALLATION_ID=$INSTALLATION_ID"
  echo "GITHUB_APP_PRIVATE_KEY_PATH=$KEY_DEST"
  if [ -n "$PRESEED" ]; then
    echo "SPEC_PREVIEW_REPOS=$PRESEED"
  fi
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "✓ wrote env → $ENV_FILE (chmod 600)"

# ---------------------------------------------------------------------------
# 6. Install systemd unit
# ---------------------------------------------------------------------------
cp "$SCRIPT_DIR/../systemd/spec-preview-server.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable spec-preview-server
# restart (not just `enable --now`): on a re-deploy the service is already running,
# and `enable --now` would NOT reload the new code — restart picks up /opt changes.
systemctl restart spec-preview-server

# ---------------------------------------------------------------------------
# 7. Verify
# ---------------------------------------------------------------------------
sleep 2
if systemctl is-active --quiet spec-preview-server; then
  echo "✓ spec-preview-server running on port 8080"
  curl -s http://localhost:8080/healthz && echo
else
  echo "✗ service failed to start; inspect logs:" >&2
  echo "    journalctl -u spec-preview-server -n 50" >&2
  exit 3
fi

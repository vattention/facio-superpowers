#!/usr/bin/env bash
# auto-update.sh — pull latest main and redeploy spec-preview-server IF (and only
# if) its code changed. Run by spec-preview-server-update.timer (as root).
# Idempotent: a no-op when main hasn't advanced or when the change didn't touch
# services/spec-preview-server/.
#
# It does NOT touch credentials/env (those are set once by install.sh); it only
# refreshes the running .mjs modules in $INSTALL_DIR and restarts the service.
#
# Config via env (override in the .service unit if your layout differs):
#   REPO_DIR     git checkout of facio-superpowers
#                (default: /home/ssm-user/vattention/facio-superpowers)
#   REPO_OWNER   OS user that owns REPO_DIR — git runs as this user to avoid
#                root-owned objects / "dubious ownership" (default: ssm-user)
#   INSTALL_DIR  where the running server modules live (default: /opt/spec-preview-server)
#   SERVICE      systemd unit name (default: spec-preview-server)
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ssm-user/vattention/facio-superpowers}"
REPO_OWNER="${REPO_OWNER:-ssm-user}"
INSTALL_DIR="${INSTALL_DIR:-/opt/spec-preview-server}"
SERVICE="${SERVICE:-spec-preview-server}"
SRC_SUBDIR="services/spec-preview-server"
# Keep in sync with install.sh's module list.
MODULES="server.mjs github-app.mjs provision.mjs git-show.mjs error-page.mjs"

log() { echo "[auto-update] $*"; }

[ -d "$REPO_DIR/.git" ] || { log "no git checkout at REPO_DIR=$REPO_DIR — abort"; exit 1; }

# Run git as the checkout's owner (root pulling a user-owned repo creates
# root-owned objects and trips git's dubious-ownership guard).
run_git() { sudo -u "$REPO_OWNER" git -C "$REPO_DIR" "$@"; }

BEFORE="$(run_git rev-parse HEAD)"

# Fast-forward only: never clobber local state. If it can't FF (diverged / dirty
# working tree), skip this cycle rather than force anything.
if ! run_git pull --ff-only --quiet; then
  log "git pull --ff-only failed (diverged or dirty checkout?) — skipping this cycle"
  exit 0
fi

AFTER="$(run_git rev-parse HEAD)"
[ "$BEFORE" = "$AFTER" ] && exit 0   # main didn't advance → nothing to do

log "main advanced: ${BEFORE:0:8} → ${AFTER:0:8}"

# Only redeploy when the server's OWN code changed in this range. `git diff
# --quiet` exits 0 = no change, 1 = changed.
if run_git diff --quiet "$BEFORE" "$AFTER" -- "$SRC_SUBDIR/"; then
  log "no $SRC_SUBDIR changes in this range — nothing to deploy"
  exit 0
fi

log "$SRC_SUBDIR changed → refreshing modules + restarting"
# Don't mkdir -p: a typo'd INSTALL_DIR would silently get a stray dir while the
# real service serves stale code. install.sh creates this dir — require it.
[ -d "$INSTALL_DIR" ] || { log "INSTALL_DIR $INSTALL_DIR missing — run install.sh first; abort"; exit 1; }
for f in $MODULES; do
  cp "$REPO_DIR/$SRC_SUBDIR/$f" "$INSTALL_DIR/$f"
  chmod 644 "$INSTALL_DIR/$f"
done

# Self-updater can't reliably reinstall itself, the systemd units, or re-run
# credential setup. If deploy/ or systemd/ changed upstream, flag for a human.
if ! run_git diff --quiet "$BEFORE" "$AFTER" -- "$SRC_SUBDIR/deploy/" "$SRC_SUBDIR/systemd/"; then
  log "NOTE: $SRC_SUBDIR/deploy or /systemd changed upstream — a manual install.sh re-run may be required (auto-update only refreshes .mjs modules + restarts)"
fi

systemctl restart "$SERVICE"
# Verify it actually came back — a bad commit that crashes on boot must not pass
# silently (this is auto-deploy with no human gate). Non-zero exit marks the timer
# run failed in `systemctl status`, leaving a signal in the journal.
sleep 2
if ! systemctl is-active --quiet "$SERVICE"; then
  log "WARNING: $SERVICE is NOT active after restart @ ${AFTER:0:8} — check 'journalctl -u $SERVICE'"
  exit 1
fi
log "restarted $SERVICE @ ${AFTER:0:8} (active)"

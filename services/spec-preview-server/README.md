# spec-preview-server

Internal HTTP service that serves spec.html files from git repos to authenticated 飞书 reviewers via Cloudflare Tunnel + Cloudflare Access.

Part of the `facio-superpowers` harness; deployed to internal EC2 (not installed via `cli.js init`).

## Architecture

```
[Reviewer 飞书]                                Cloudflare Edge          EC2:8080
     │                                              │                       │
     │ click 📄 阅读 Spec (preview URL)              │                       │
     │ ────────────────────────────HTTPS──────────► │                       │
     │                                              │                       │
     │           Cloudflare Access enforces         │                       │
     │           Lark SSO session (deny if          │                       │
     │           unauthenticated)                   │                       │
     │ ◄──── 302 redirect → Lark SSO if not signed in                       │
     │                                              │                       │
     │           after SSO success                  │                       │
     │                                              ▼ via cloudflared tunnel│
     │                                                                      │
     │                                                  spec-preview-server │
     │                                                         │            │
     │                                                         ▼            │
     │                                          git -C /var/lib/specs/<repo>│
     │                                          show origin/<branch>:<path> │
     │                                                                      │
     │ ◄──────────────────────────────────────── spec.html (or 404 / 410) ──│
```

## Deploy

### Prerequisites on EC2

- Node.js ≥ 18 (`node --version`)
- git
- A running `cloudflared` daemon (existing setup)
- Sudo access

### 1. Generate SSH key for the `specs` user (one-time)

```bash
sudo useradd -r -m -d /var/lib/specs -s /bin/bash specs   # if not exists
sudo -u specs ssh-keygen -t ed25519 -f /var/lib/specs/.ssh/id_ed25519 -N ''
sudo -u specs cat /var/lib/specs/.ssh/id_ed25519.pub
```

Copy the public key, add to each GitHub repo as a **read-only deploy key**:
`Settings → Deploy keys → Add deploy key`.

### 2. Run installer

```bash
git clone git@github.com:vattention/facio-superpowers.git /tmp/sp-deploy
sudo bash /tmp/sp-deploy/services/spec-preview-server/deploy/install.sh \
  "facio-blueprint:git@github.com:vattention/facio-blueprint.git"
```

This is idempotent; safe to re-run.

After completion, you should see `✓ spec-preview-server running on port 8080` and `ok` from healthz.

### 3. Wire Cloudflare Tunnel ingress

Edit your cloudflared config (typically `/etc/cloudflared/config.yml` or wherever `systemctl cat cloudflared` points):

```yaml
ingress:
  - hostname: harness-specs.<your-cf-domain>
    service: http://localhost:8080
  # ... existing rules ...
  - service: http_status:404
```

Route DNS:
```bash
sudo cloudflared tunnel route dns <your-tunnel-name> harness-specs.<your-cf-domain>
```

Restart:
```bash
sudo systemctl restart cloudflared
```

### 4. Configure Cloudflare Access

In the Cloudflare dashboard:

1. **Zero Trust → Access → Applications → Add an application → Self-hosted**
2. Configuration:
   - Application name: **Harness Specs**
   - Session duration: **24 hours**
   - Subdomain: **harness-specs**
   - Domain: **<your-cf-domain>**
3. Identity providers: select **Lark SSO** (already configured at the org level)
4. Add a policy:
   - Policy name: **Internal team**
   - Action: **Allow**
   - Include: **Emails ending in @<your-company-domain>** (or a specific Lark group if available)
5. Save

### 5. End-to-end test

From your laptop (browser, with a current Lark login):

```
https://harness-specs.<your-cf-domain>/healthz
```

Expected: Cloudflare Access redirect → Lark SSO → on success → page shows `ok`.

Then try a real spec URL:

```
https://harness-specs.<your-cf-domain>/facio-blueprint/main/docs/superpowers/specs/2026-05-22-spec-ratifier-lark-wiki-render.html
```

Expected: rendered HTML.

## Operations

### Logs

```bash
sudo journalctl -u spec-preview-server -f
```

One JSON line per request + lifecycle event.

### Manual git refresh

```bash
sudo -u specs git -C /var/lib/specs/facio-blueprint fetch --all --prune
```

(The background fetch runs every 30 s; manual is only for "I just pushed and want the URL to update now".)

### Restart

```bash
sudo systemctl restart spec-preview-server
```

### Adding a new repo

1. Add SSH deploy key to the new GitHub repo
2. Clone:
   ```bash
   sudo -u specs git clone git@github.com:vattention/new-repo.git /var/lib/specs/new-repo
   ```
3. Update `/etc/spec-preview-server.env`:
   ```
   SPEC_PREVIEW_REPOS=facio-blueprint:/var/lib/specs/facio-blueprint,new-repo:/var/lib/specs/new-repo
   ```
4. `sudo systemctl restart spec-preview-server`

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 502 from Cloudflare | server down or port mismatch | `systemctl status spec-preview-server`; `journalctl -u spec-preview-server -n 50` |
| 410 Gone on a known URL | branch deleted (merged or pruned remote) | Use `main` branch URL after merge |
| 404 path not found | spec.html not in that branch HEAD | `sudo -u specs git -C /var/lib/specs/<repo> show origin/<branch>:<path>` to verify |
| Slow response (>2 s) | Cache miss + cold disk | First request after each `FETCH_INTERVAL_MS` fetch is slower; subsequent cached |
| Cloudflare Access loop / 403 | Lark SSO mis-configured | Verify identity provider in Cloudflare dashboard; clear browser cookies; try a fresh tab |
| SyntaxError on startup | Wrong Node version | Confirm `node --version` ≥ 18 |

## Files

- `server.mjs` — the HTTP service (single file, zero npm deps)
- `server.test.mjs` — 9 unit tests for `parseRequest` + `safeComponent`
- `systemd/spec-preview-server.service` — unit file
- `deploy/install.sh` — idempotent EC2 setup

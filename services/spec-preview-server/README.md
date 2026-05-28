# spec-preview-server

Internal HTTP service that serves spec.html files from `vattention` org git repos to authenticated 飞书 reviewers via Cloudflare Tunnel + Cloudflare Access.

Repos are cloned **on demand** using a GitHub App installation token — no per-repo SSH deploy keys, no manual onboarding. Any repo in the org just works. A preview link also **survives after its PR branch is merged + deleted**: the server transparently falls back to the default branch.

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
     │              repo cached on disk?  ── no ──►  mint GitHub App        │
     │                       │                       installation token,    │
     │                      yes                      clone org/<repo> into   │
     │                       │                       /var/lib/specs/<repo>   │
     │                       ▼                       (on demand) ◄───────────┤
     │                git -C /var/lib/specs/<repo>                          │
     │                show origin/<branch>:<path>                           │
     │                       │                                              │
     │            branch ref present? ── no ──► fall back to default branch │
     │                       │                  (origin/<default>:<path>)   │
     │                      yes                  → durable link after merge │
     │                       ▼                                              │
     │ ◄──────────── spec.html (or 404 / 410 / 503 friendly page) ──────────│
```

Key behaviors:

- **On-demand clone.** On the first request for a repo not yet in the on-disk cache, the server mints a short-lived GitHub App installation token, clones `https://github.com/<org>/<repo>.git` into `CACHE_DIR/<repo>`, then serves from it. The token auto-rotates (re-minted ~5 min before expiry) and is never logged.
- **Default-branch fallback (durable links).** While a PR branch still exists, `origin/<branch>:<path>` is served. Once the branch is merged + deleted (so its ref is gone after a fetch/prune), the server resolves the repo's default branch (`GITHUB_DEFAULT_BRANCH`, default `main`) and serves `origin/<default>:<path>` — so the same preview link keeps working after merge. A `410` is only returned when the branch is gone **and** the file isn't on the default branch (e.g. PR closed unmerged).
- **Front door unchanged.** All access stays behind Cloudflare Tunnel + Cloudflare Access (飞书/Lark SSO).

## Deploy

### Prerequisites on EC2

- Node.js ≥ 18 (`node --version`)
- git
- A running `cloudflared` daemon (existing setup)
- Sudo access

### 1. Create & install a GitHub App (one-time, org-level)

1. **Org → Settings → Developer settings → GitHub Apps → New GitHub App.**
2. Permissions: **Repository permissions → Contents → Read-only** (`contents:read`). No webhook needed.
3. Where can it be installed: **Only on this account** is fine.
4. Create the App, then note the **App ID**.
5. **Generate a private key** — this downloads a `.pem` file. Keep it safe; you'll hand its path to `install.sh`.
6. **Install the App** on the `vattention` org (Install App → choose **All repositories**, so any current/future org repo is previewable zero-config).
7. After install, open the installation and note the **Installation ID** (the numeric id in the installation settings URL `…/installations/<installation-id>`).

You now have three values: **App ID**, **Installation ID**, and the **private key `.pem` file**.

### 2. Run the installer

```bash
git clone https://github.com/vattention/facio-superpowers.git /tmp/sp-deploy
sudo bash /tmp/sp-deploy/services/spec-preview-server/deploy/install.sh \
  --org vattention \
  --app-id <app-id> \
  --installation-id <installation-id> \
  --private-key /path/to/spec-preview.private-key.pem \
  --preseed facio-blueprint,facio-flow      # optional warm-cache hint
```

The installer (idempotent; safe to re-run):

- creates the dedicated `specs` user and the clone cache at `/var/lib/specs`;
- installs the private key to `/etc/spec-preview-server.key` (chmod 600, owner `specs`, **outside** the RW clone cache);
- installs all 5 server modules to `/opt/spec-preview-server`;
- writes `/etc/spec-preview-server.env` (chmod 600) with the config below;
- installs + enables the systemd unit and verifies `/healthz`.

`--preseed` is **optional** — a comma-separated list of repo names to warm the cache; repos are cloned on demand regardless of whether they're listed.

After completion you should see `✓ spec-preview-server running on port 8080` and `ok` from healthz.

### Environment variables the service reads

`install.sh` writes the GitHub App + org config into `/etc/spec-preview-server.env`; the systemd unit supplies the `PORT`/`FETCH_INTERVAL_MS`/`CACHE_TTL_MS` defaults (the env file overrides them). All are read by `loadConfig`:

| Var | Required | Default | Meaning |
|-----|----------|---------|---------|
| `GITHUB_ORG` | no | `vattention` | Org whose repos are served on demand |
| `GITHUB_APP_ID` | **yes** | — | GitHub App ID (fail-fast at boot if missing) |
| `GITHUB_APP_INSTALLATION_ID` | **yes** | — | App installation ID (fail-fast at boot if missing) |
| `GITHUB_APP_PRIVATE_KEY_PATH` | **yes** | — | Path to the App private-key PEM file (`/etc/spec-preview-server.key`). This is the form `install.sh` writes |
| `GITHUB_DEFAULT_BRANCH` | no | `main` | Fallback branch for durable post-merge links |
| `CACHE_DIR` | no | `/var/lib/specs` | On-disk clone cache root |
| `PORT` | no | `8080` | Listen port |
| `FETCH_INTERVAL_MS` | no | `30000` | Background `git fetch --all --prune` interval per cached repo |
| `CACHE_TTL_MS` | no | `5000` | In-memory response cache TTL |
| `SPEC_PREVIEW_REPOS` | no | (none) | **Optional** pre-seed/warm-cache hint (`name,name` or `name:path,…`). Purely a hint — never a gate; repos clone on demand regardless |

Notes:
- The private key may alternatively be supplied inline via `GITHUB_APP_PRIVATE_KEY` (PEM contents), but the **file-path form (`GITHUB_APP_PRIVATE_KEY_PATH`) is preferred** and is what `install.sh` uses.
- Legacy aliases are still honoured as fallbacks: `SPEC_PREVIEW_ORG`, `SPEC_PREVIEW_CACHE_DIR`, `SPEC_PREVIEW_DEFAULT_BRANCH`.
- The service fails fast at boot if `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, or the private key are missing/incomplete (rather than silently 503-ing every request).

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

Expected: rendered HTML. (First request for an uncached repo is slower — it triggers the on-demand clone.)

## Operations

### Logs

```bash
sudo journalctl -u spec-preview-server -f
```

One JSON line per request + lifecycle event. Tokens, clone URLs, and the private key are never logged.

### Repo cache

The clone cache under `CACHE_DIR` (default `/var/lib/specs`) is **dynamic** — any org repo is cloned on its first request; there's no static list to maintain. The background job runs `git fetch --all --prune` on every fully-cloned repo every `FETCH_INTERVAL_MS` (default 30 s), so merged/deleted branches get pruned and post-merge links fall back to the default branch.

### Manual git refresh

```bash
sudo -u specs git -C /var/lib/specs/<repo> fetch --all --prune
```

(The background fetch already runs every 30 s; manual is only for "I just pushed and want the URL to update now". Run it per cached repo dir.)

### GitHub App token

The installation token is minted on demand and **auto-rotates** (re-minted ~5 minutes before expiry). No manual rotation is needed. If you rotate the App's private key, replace `/etc/spec-preview-server.key` and `systemctl restart spec-preview-server`.

### Restart

```bash
sudo systemctl restart spec-preview-server
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 502 from Cloudflare | server down or port mismatch | `systemctl status spec-preview-server`; `journalctl -u spec-preview-server -n 50` |
| 410 链接已失效 ("gone-unmerged") | branch was deleted **and** the file isn't on the default branch (e.g. PR closed unmerged). Post-merge links self-heal via default-branch fallback, so this is a real dead link | Ask the author for a current preview link, or open the PR directly. If the spec should be on `main`, verify it was actually merged |
| 404 无法预览 ("repo not in scope") | repo isn't in the org, the App isn't installed on it, or the repo doesn't exist | Confirm the repo is under `<org>` and the GitHub App is installed with access to it (`All repositories` covers new repos); check the repo name in the URL |
| 404 文件未找到 ("path-not-found") | `spec.html` not present in that branch's HEAD | `sudo -u specs git -C /var/lib/specs/<repo> show origin/<branch>:<path>` to verify |
| 503 服务暂时不可用 | GitHub App token mint failed (bad App ID / installation ID / key path, or host clock skew) | Verify `GITHUB_APP_ID` / `GITHUB_APP_INSTALLATION_ID` / `GITHUB_APP_PRIVATE_KEY_PATH` in `/etc/spec-preview-server.env`; check the key is readable by `specs`; verify the host clock (`timedatectl`); `journalctl -u spec-preview-server -n 50` |
| Slow first request (>2 s) | cold clone of an uncached repo | Expected on the first hit for a repo; the clone is cached, subsequent requests are fast |
| Cloudflare Access loop / 403 | Lark SSO mis-configured | Verify identity provider in Cloudflare dashboard; clear browser cookies; try a fresh tab |
| SyntaxError / fail-fast on startup | wrong Node version, or missing GitHub App creds | Confirm `node --version` ≥ 18; check the boot error in `journalctl` — missing App creds throw a clear `GITHUB_APP_…` message |

## Files

Runtime modules (all installed to `/opt/spec-preview-server`; zero npm deps):

- `server.mjs` — HTTP service: routing, config, in-memory cache, request handler, fetch loop, app factory
- `github-app.mjs` — GitHub App JWT + installation-token provider (mint, cache, auto-rotate), clone-URL builder, repo-name validation
- `provision.mjs` — on-demand repo provisioning (`ensureRepo`): atomic clone-or-reuse with in-flight de-dup
- `git-show.mjs` — `gitShow` (serve from branch, else default-branch fallback) + `resolveDefaultBranch`
- `error-page.mjs` — friendly self-contained HTML pages for 410 / 404 / 503 / 500 (XSS-escaped, 飞书-reviewer facing)

Tests (`node --test`, excluded from install):

- `server.test.mjs` — unit tests for `parseRequest`, `safeComponent`, `loadConfig`, `validateRuntimeConfig`
- `server.integration.test.mjs` — end-to-end request-handler tests with injected deps
- `github-app.test.mjs` — JWT/token-provider tests
- `provision.test.mjs` — `ensureRepo` clone/scope/error-code tests
- `git-show.test.mjs` — branch-vs-default fallback + 404/410 tests
- `error-page.test.mjs` — error-page rendering + escaping tests

Deploy:

- `systemd/spec-preview-server.service` — unit file (runs as `specs`, hardened, EnvironmentFile)
- `deploy/install.sh` — idempotent EC2 setup (flag-based: `--org --app-id --installation-id --private-key [--preseed]`)

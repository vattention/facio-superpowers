import { createSign } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function buildAppJwt({ appId, privateKeyPem, now = Math.floor(Date.now() / 1000) }) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  // iat backdated 60s for clock skew; exp = iat + 600 (GitHub rejects exp-iat > 600s)
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign(privateKeyPem).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

export function createTokenProvider({ appId, privateKeyPem, installationId, fetchImpl = fetch, now = () => Math.floor(Date.now() / 1000) }) {
  let cached = null; // { token, expSec }
  let inflight = null;
  const SAFETY = 300; // refresh ~5 min before expiry
  async function mint() {
    const jwt = buildAppJwt({ appId, privateKeyPem, now: now() });
    const res = await fetchImpl(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'User-Agent': 'spec-preview-server' },
    });
    if (!res.ok) throw new Error(`installation token mint failed: ${res.status}`);
    const body = await res.json();
    const expSec = Math.floor(new Date(body.expires_at).getTime() / 1000);
    if (!body.token || Number.isNaN(expSec)) {
      throw new Error('installation token mint: malformed response');
    }
    cached = { token: body.token, expSec };
    return cached.token;
  }
  return {
    async getToken() {
      if (cached && now() < cached.expSec - SAFETY) return cached.token;
      if (!inflight) inflight = mint().finally(() => { inflight = null; });
      return inflight;
    },
  };
}

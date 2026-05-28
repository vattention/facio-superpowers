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

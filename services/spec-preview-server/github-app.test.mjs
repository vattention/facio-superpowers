import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { buildAppJwt, createTokenProvider } from './github-app.mjs';

const PEM = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' });

test('buildAppJwt: claims + verifiable RS256 signature', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' });
  const now = 1_700_000_000;
  const jwt = buildAppJwt({ appId: '123456', privateKeyPem: pem, now });
  const [h, p, sig] = jwt.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url'));
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  assert.equal(header.alg, 'RS256');
  assert.equal(payload.iss, '123456');
  assert.equal(payload.iat, now - 60);      // clock-skew backdate
  assert.equal(payload.exp, now + 540);     // exp-iat = 600s, GitHub's hard max (must NOT exceed)
  const v = createVerify('RSA-SHA256');
  v.update(`${h}.${p}`);
  assert.equal(v.verify(publicKey, Buffer.from(sig, 'base64url')), true);
});

test('createTokenProvider: mints then caches until near expiry', async () => {
  let calls = 0;
  let clock = 1000;
  const fetchImpl = async () => { calls++; return {
    ok: true, status: 201,
    json: async () => ({ token: `tok-${calls}`, expires_at: new Date((clock + 3600) * 1000).toISOString() }),
  };};
  const provider = createTokenProvider({
    appId: '1', privateKeyPem: PEM, installationId: '99',
    fetchImpl, now: () => clock,
  });
  assert.equal(await provider.getToken(), 'tok-1');
  clock += 60;                                  // still well before expiry
  assert.equal(await provider.getToken(), 'tok-1');   // cached, no 2nd call
  assert.equal(calls, 1);
  clock += 3600;                                // past expiry (minus safety window)
  assert.equal(await provider.getToken(), 'tok-2');   // refreshed
  assert.equal(calls, 2);
});

test('createTokenProvider: surfaces API failure', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, text: async () => 'bad creds' });
  const provider = createTokenProvider({ appId: '1', privateKeyPem: PEM, installationId: '99', fetchImpl });
  await assert.rejects(() => provider.getToken(), /401/);
});

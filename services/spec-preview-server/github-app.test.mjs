import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { buildAppJwt } from './github-app.mjs';

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

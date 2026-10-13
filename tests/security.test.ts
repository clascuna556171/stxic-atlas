import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { get } from 'node:http';
import { localRequestGuard } from '../server/security.ts';

test('local API rejects remote origins, DNS rebinding, cross-site requests and form posts', async () => {
  const app = express();
  app.use(localRequestGuard);
  app.all('/api/probe', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/probe`;
  try {
    for (const headers of [
      { origin: 'https://attacker.example' },
      { origin: 'null' },
      { 'sec-fetch-site': 'cross-site' },
      { origin: 'http://localhost.attacker.example:5175' },
    ]) assert.equal((await fetch(url, { headers })).status, 403, JSON.stringify(headers));
    // Node fetch normalizes Host; use HTTP directly to exercise rebinding.
    const reboundStatus = await new Promise<number | undefined>((resolve, reject) => {
      get(url, { headers: { Host: 'rebound.attacker.example' } }, (response) => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(reboundStatus, 403);
    assert.equal((await fetch(url, { method: 'POST', body: 'repoPath=secret', headers: { 'content-type': 'application/x-www-form-urlencoded' } })).status, 415);
    const response = await fetch(url, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin: 'http://localhost:5175' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

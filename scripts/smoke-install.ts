import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runGit } from '../server/repository.ts';

// Refuse an occupied port so this check cannot accidentally test another service.
const port = createServer();
await new Promise<void>((done, fail) => { port.once('error', fail); port.listen(4317, '127.0.0.1', done); });
await new Promise<void>((done) => port.close(() => done()));
const directory = await mkdtemp(join(tmpdir(), 'atlas-install-smoke-'));
const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: resolve('.'), env: { ...process.env, LOCALAPPDATA: directory }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
const stopped = once(child, 'exit');
let output = '';
child.stdout?.on('data', (data) => { output = (output + String(data)).slice(-4000); });
child.stderr?.on('data', (data) => { output = (output + String(data)).slice(-4000); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error(`Local service exited during startup: ${output}`);
    if (output.includes('Stxic Atlas API listening')) { ready = true; break; }
    await delay(100);
  }
  assert.ok(ready, `Local service did not become ready: ${output}`);
  const request = (path: string, body?: unknown) => fetch(`http://127.0.0.1:4317${path}`, { ...(body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000) });
  assert.equal((await (await request('/api/health')).json()).ok, true);
  assert.equal((await (await request('/api/demo')).json()).synthetic, true);
  const page = await request('/'); assert.equal(page.status, 200);
  assert.match(await page.text(), /id="root"/);
  const repository = join(directory, 'synthetic-checkout'); await mkdir(repository);
  await runGit(repository, ['init']);
  await writeFile(join(repository, 'a.ts'), 'export const a = 1;\n');
  await runGit(repository, ['add', '--', 'a.ts']);
  await runGit(repository, ['-c', 'user.name=Synthetic fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic install baseline']);
  await writeFile(join(repository, 'a.ts'), 'export const a = 2;\n');
  const scan = await request('/api/analyze', { repoPath: repository }); assert.equal(scan.status, 200);
  assert.equal((await scan.json()).synthetic, false);
  const preview = await request('/api/review/preview', { repoPath: repository, baseRef: 'HEAD' }); assert.equal(preview.status, 200);
  assert.match((await preview.json()).diff, /a = 2/);
  console.log('Installation smoke passed: production page, local API, synthetic Git scan, and change preview. No AI called.');
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill();
  await stopped;
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

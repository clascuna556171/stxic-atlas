import express from 'express';
import { analyzeRepository } from './analyze.js';
import type { AtlasNode, AtlasEdge } from '../src/types.js';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ollamaStatus, runReview, saveReviewFeedback } from './review.js';
import { localRequestGuard } from './security.js';
const app = express();
app.disable('x-powered-by');
app.use(localRequestGuard);
app.use(express.json({ limit: '32kb' }));
const demo = {
  repository: 'northstar/marketplace-api',
  branch: 'main',
  scannedAt: 'Just now',
  synthetic: true,
  summary: { commits: 1284, files: 86, contributors: 9, hotspots: 3 },
  nodes: [
    { id: 'checkout', label: 'checkout/', kind: 'service', x: 120, y: 106, commits: 96, churn: 412, group: 'commerce' },
    { id: 'submit', label: 'submit-order.ts', kind: 'file', x: 300, y: 74, commits: 42, churn: 211, group: 'checkout' },
    { id: 'price', label: 'price-cart.ts', kind: 'file', x: 300, y: 190, commits: 38, churn: 186, group: 'checkout' },
    { id: 'ledger', label: 'ledger.ts', kind: 'module', x: 505, y: 116, commits: 27, churn: 102, group: 'billing' },
    { id: 'money', label: 'money.ts', kind: 'file', x: 505, y: 252, commits: 31, churn: 74, group: 'shared' },
    { id: 'tax', label: 'tax-rules.ts', kind: 'file', x: 700, y: 70, commits: 19, churn: 88, group: 'billing' },
    { id: 'webhook', label: 'webhook.ts', kind: 'file', x: 700, y: 196, commits: 16, churn: 67, group: 'billing' },
    { id: 'test', label: 'checkout.spec.ts', kind: 'test', x: 300, y: 300, commits: 22, churn: 125, group: 'tests' },
  ] satisfies AtlasNode[],
  edges: [
    { from: 'checkout', to: 'submit', kind: 'contains', strength: 1, evidence: 'Source folder contains this file' },
    { from: 'checkout', to: 'price', kind: 'contains', strength: 1, evidence: 'Source folder contains this file' },
    { from: 'submit', to: 'ledger', kind: 'imports', strength: 0.9, evidence: 'Imports billing ledger' },
    { from: 'price', to: 'money', kind: 'imports', strength: 0.75, evidence: 'Imports shared currency helpers' },
    { from: 'ledger', to: 'money', kind: 'imports', strength: 0.7, evidence: 'Uses decimal arithmetic' },
    { from: 'ledger', to: 'tax', kind: 'cochange', strength: 0.78, evidence: 'Changed together in 14 commits' },
    { from: 'ledger', to: 'webhook', kind: 'cochange', strength: 0.53, evidence: 'Changed together in 8 commits' },
    { from: 'price', to: 'test', kind: 'cochange', strength: 0.68, evidence: 'Changed together in 11 commits' },
  ] satisfies AtlasEdge[],
  findings: [
    { severity: 'high', title: 'Ledger and tax rules move together', detail: '14 of the last 27 ledger changes also touched tax-rules.ts.', evidence: '14 co-change commits · 52% overlap', node: 'tax' },
    { severity: 'medium', title: 'Webhook contract shares billing history', detail: 'Webhook changes follow ledger changes in 8 commits.', evidence: '8 co-change commits · 30% overlap', node: 'webhook' },
    { severity: 'test', title: 'Checkout test coverage is close', detail: 'checkout.spec.ts changed alongside price-cart.ts in 11 commits.', evidence: '11 co-change commits', node: 'test' },
  ],
  suggestedChecks: [
    { label: 'Reconcile tax rounding at the boundary', path: 'billing/tax-rules.ts', reason: 'Historically coupled to ledger arithmetic' },
    { label: 'Verify emitted invoice webhook payload', path: 'billing/webhook.ts', reason: 'Co-changed in 8 ledger commits' },
    { label: 'Run checkout pricing regression suite', path: 'tests/checkout.spec.ts', reason: 'Known coverage for price-cart.ts' },
  ],
};

app.get('/api/demo', (_req, res) => res.json(demo));

app.get('/api/review/status', async (_req, res) => {
  res.json(await ollamaStatus());
});

let reviewRunning = false;
app.post('/api/review', async (req, res) => {
  if (reviewRunning) { res.status(429).json({ error: 'A local review is already running. Wait for it to finish before starting another.' }); return; }
  reviewRunning = true;
  try {
    const result = await runReview({ repoPath: req.body?.repoPath, baseRef: req.body?.baseRef, model: req.body?.model, intent: req.body?.intent });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not review this change.';
    res.status(400).json({ error: message.includes('ENOENT') ? 'Folder or Git was not found. Check the repository path.' : message });
  } finally { reviewRunning = false; }
});

app.post('/api/review/feedback', (req, res) => {
  try {
    res.json(saveReviewFeedback({ reviewId: req.body?.reviewId, findingId: req.body?.findingId, vote: req.body?.vote, agents: req.body?.agents }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Could not save this feedback.' });
  }
});

app.post('/api/analyze', async (req, res) => {
  try { res.json(await analyzeRepository(req.body?.repoPath)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Could not analyze this repository.' }); }
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown local API endpoint.' }));
app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error.status === 413 ? 413 : 400;
  res.status(status).json({ error: status === 413 ? 'The request exceeds the local payload limit.' : 'Send a valid JSON request.' });
});
const productionBuild = resolve('dist');
if (existsSync(resolve(productionBuild, 'index.html'))) {
  app.use(express.static(productionBuild));
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) return res.sendFile(resolve(productionBuild, 'index.html'));
    next();
  });
}
app.listen(4317, '127.0.0.1', () => console.log('Stxic Atlas API listening on http://127.0.0.1:4317'));


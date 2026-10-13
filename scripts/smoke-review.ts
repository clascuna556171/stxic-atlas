import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { runGit } from '../server/repository.ts';

// A reproducible synthetic checkout; never touches a user's existing Git history or feedback.
const directory = resolve('.test-data', `smoke-${Date.now()}`);
const repository = join(directory, 'synthetic-checkout');
await mkdir(repository, { recursive: true });
process.env.LOCALAPPDATA = directory;
const { runReview, ollamaStatus, closeReviewStore } = await import('../server/review.ts');
try {
  const status = await ollamaStatus();
  if (!status.available) throw new Error(status.reason);
  const model = process.argv[2] || status.models.find((name) => name.includes('coder')) || status.models[0];
  await runGit(repository, ['init']);
  await writeFile(join(repository, 'total.ts'), 'export function total(subtotal: number, taxRate: number) {\n  return subtotal * (1 + taxRate);\n}\n');
  await runGit(repository, ['add', '--', 'total.ts']);
  await runGit(repository, ['-c', 'user.name=Synthetic fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic checkout baseline']);
  await writeFile(join(repository, 'total.ts'), 'export function total(subtotal: number, taxRate: number, discount = 0) {\n  const tax = subtotal * taxRate;\n  return subtotal - discount + tax;\n}\n');
  console.log(`Reviewing a synthetic checkout with local model ${model}…`);
  const report = await runReview({ repoPath: repository, model, intent: 'Apply the discount before tax so tax is based on the discounted subtotal.' });
  const path = join(directory, 'report.json');
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ fixture: 'Synthetic smoke checkout', path, repository, decision: report.decision, agentsPassed: report.metrics.passed, chair: report.chair.status, findings: report.findings.length, totalTokens: report.metrics.totalTokens, elapsedMs: report.elapsedMs }));
  if (report.metrics.passed !== 5 || report.chair.status !== 'complete') process.exitCode = 1;
} finally { closeReviewStore(); }

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { analyzeRepository } from '../server/analyze.ts';
import { readRepositoryFile, repositoryRoot, runGit } from '../server/repository.ts';
import { atlasData, reviewResult, reviewStatus } from '../src/api.ts';
import { reviewDemo } from '../src/reviewDemo.ts';

const temporary = await mkdtemp(join(tmpdir(), 'stxic-atlas-test-'));
process.env.LOCALAPPDATA = temporary;
const { runReview, saveReviewFeedback, closeReviewStore } = await import('../server/review.ts');
after(async () => {
  // Only remove this test's freshly generated temporary folder.
  assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + sep));
  closeReviewStore();
  await rm(temporary, { recursive: true, force: true });
});
const root = join(temporary, 'repository');
await mkdir(root);
await runGit(root, ['init']);
await writeFile(join(root, 'a.ts'), "import { b } from './b.js';\nexport const a = b;\n");
await writeFile(join(root, 'b.ts'), 'export const b = 1;\n');
await runGit(root, ['add', '--', 'a.ts', 'b.ts']);
await runGit(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic initial commit']);
await writeFile(join(root, 'a.ts'), "import { b } from './b.js';\nexport const a = b + 1;\n");
await writeFile(join(root, 'b.ts'), 'export const b = 2;\n');
await runGit(root, ['add', '--', 'a.ts', 'b.ts']);
await runGit(root, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic paired change']);
await writeFile(join(root, 'a.ts'), "import { b } from './b.js';\nexport const a = b + 2;\n");

test('real Git history counts changes and separates imports from co-change evidence', async () => {
  const data = await analyzeRepository(root);
  assert.equal(data.summary.commits, 2);
  assert.equal(data.summary.contributors, 1);
  assert.equal(data.nodes.find((node) => node.id === 'a.ts')?.commits, 2);
  assert.equal(data.edges.filter((edge) => edge.kind === 'cochange').length, 1);
  assert.match(data.edges.find((edge) => edge.kind === 'cochange')!.evidence, /2 commits/);
  assert.equal(data.edges.filter((edge) => edge.kind === 'imports').length, 1);
  assert.ok(data.findings.some((finding) => finding.title === 'a.ts imports b.ts'));
  assert.equal(atlasData(data).synthetic, false);
});
test('repository roots, traversal, file size and symlinked directories are bounded', async () => {
  await assert.rejects(repositoryRoot('.'), /absolute/);
  await mkdir(join(root, 'child'));
  await assert.rejects(repositoryRoot(join(root, 'child')), /root folder/);
  await assert.rejects(readRepositoryFile(root, '../outside.ts', 1000), /outside/);
  await assert.rejects(readRepositoryFile(root, 'a.ts', 2), /bounded/);
  const outside = join(temporary, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'secret.ts'), 'private');
  await symlink(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(readRepositoryFile(root, 'linked/secret.ts', 1000), /Symlinks/);
  await unlink(join(root, 'linked'));
});
test('malformed API payloads fail before rendering, and the labeled demo is valid', () => {
  assert.throws(() => atlasData({ nodes: [] }), /incomplete/);
  assert.throws(() => reviewStatus({ available: true, models: null }), /Invalid/);
  assert.throws(() => reviewResult({ findings: [] }), /incomplete/);
  assert.equal(reviewResult(reviewDemo).synthetic, true);
  assert.throws(() => reviewResult({ ...reviewDemo, chair: { status: 'unknown', elapsedMs: 0 } }), /incomplete/);
  assert.throws(() => reviewResult({ ...reviewDemo, findings: [{ ...reviewDemo.findings[0], line: -1 }] }), /incomplete/);
});

function mockModel(mode: 'valid' | 'chair-fails' | 'specialist-malformed' | 'no-findings' | 'chair-malformed' | 'chair-incomplete') {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    if (String(_url).endsWith('/api/tags')) return Response.json({ models: [{ name: 'fixture-model' }] });
    const body = JSON.parse(String(options?.body));
    const chair = body.messages[0].content.includes('skeptical chair');
    if (chair && mode === 'chair-fails') return new Response('', { status: 500 });
    const finding = { severity: 'high', category: 'correctness', file: 'a.ts', line: 2, title: 'Synthetic fixture finding', comment: 'Fixture explanation', confidence: 0.6 };
    const payload = chair ? mode === 'chair-malformed' ? {} : { changeSummary: 'Synthetic fixture summary', purposeSummary: 'Not provided.', votes: mode === 'chair-incomplete' ? [] : [{ id: 'finding-1', verdict: 'supported', reason: 'Fixture evidence' }] }
      : mode === 'specialist-malformed' ? {} : { findings: mode === 'no-findings' ? [] : [finding, { ...finding, file: 'not-changed.ts' }] };
    return Response.json({ message: { content: JSON.stringify(payload) }, prompt_eval_count: 10, eval_count: 5 });
  };
  return () => { globalThis.fetch = original; };
}
for (const mode of ['valid', 'chair-fails', 'specialist-malformed', 'no-findings', 'chair-malformed', 'chair-incomplete'] as const) {
  test(`local review workflow: ${mode}`, async () => {
    const restore = mockModel(mode);
    try {
      const report = await runReview({ repoPath: root, model: 'fixture-model' });
      assert.equal(report.synthetic, false);
      assert.equal(report.purposeSource, 'unprovided');
      assert.equal(report.purposeSummary, 'Not provided.');
      reviewResult(report);
      if (mode === 'valid') {
        assert.equal(report.findings.length, 1);
        assert.equal(report.findings[0].confidence, 0.6);
        assert.equal(report.findings[0].line, 2);
        assert.equal(report.metrics.totalTokens, 90);
        assert.equal(report.decision, 'request-changes');
        const vote = { reviewId: report.reviewId, findingId: report.findings[0].id, vote: 'useful', agents: ['invented'] };
        const first = saveReviewFeedback(vote);
        assert.equal(first.useful, 5);
        assert.deepEqual(saveReviewFeedback(vote), first);
        const changed = saveReviewFeedback({ ...vote, vote: 'incorrect' });
        assert.equal(changed.useful, 0);
        assert.equal(changed.incorrect, 5);
      } else if (mode === 'no-findings') assert.equal(report.decision, 'looks-clear');
      else assert.equal(report.decision, 'partial-review');
    } finally { restore(); }
  });
}
test('synthetic or invented findings cannot alter persistent reviewer weights', () => {
  assert.throws(() => saveReviewFeedback({ reviewId: reviewDemo.reviewId, findingId: 'demo-tax', vote: 'useful', agents: ['security'] }), /Synthetic/);
});
test('an omitted untracked file makes otherwise clean review incomplete', async () => {
  await writeFile(join(root, 'notes.txt'), 'Synthetic unsupported file');
  const restore = mockModel('no-findings');
  try {
    const report = await runReview({ repoPath: root, model: 'fixture-model' });
    assert.equal(report.decision, 'partial-review');
    assert.ok(report.untrackedOmitted.includes('notes.txt'));
  } finally { restore(); }
});
test('truncated source coverage can never produce a complete clean review', async () => {
  await unlink(join(root, 'notes.txt'));
  await writeFile(join(root, 'a.ts'), 'export const fixture = 1;\n' + '// Synthetic padding\n'.repeat(2500));
  const restore = mockModel('no-findings');
  try {
    const report = await runReview({ repoPath: root, model: 'fixture-model' });
    assert.equal(report.diff.length, 38000);
    assert.equal(report.diffTruncated, true);
    assert.equal(report.decision, 'partial-review');
  } finally { restore(); }
});
test('option-like and shell-like refs are rejected before local inference', async () => {
  await assert.rejects(runReview({ repoPath: root, baseRef: '--output=private', model: 'fixture-model' }), /simple Git ref/);
  await assert.rejects(runReview({ repoPath: root, baseRef: 'HEAD;echo injected', model: 'fixture-model' }), /simple Git ref/);
});

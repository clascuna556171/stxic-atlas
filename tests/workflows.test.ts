import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, unlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { analyzeRepository } from '../server/analyze.ts';
import { readRepositoryFile, repositoryRoot, runGit } from '../server/repository.ts';
import { atlasData, changePreview, reviewResult, reviewStatus } from '../src/api.ts';
import { reviewDemo } from '../src/reviewDemo.ts';

const temporaryRoot = await realpath(tmpdir());
const temporary = await mkdtemp(join(temporaryRoot, 'stxic-atlas-test-'));
process.env.LOCALAPPDATA = temporary;
const { previewChanges, runReview, saveReviewFeedback, closeReviewStore } = await import('../server/review.ts');
const { explainChanges, prepareDisclosure, ollamaStatus } = await import('../server/review.ts');
const { connectCloud, cloudStatus, disconnectCloud } = await import('../server/ai.ts');
after(async () => {
  // Only remove this test's freshly generated temporary folder.
  assert.ok(resolve(temporary).startsWith(resolve(temporaryRoot) + sep));
  closeReviewStore();
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
  assert.equal(await repositoryRoot(join(root, 'child')), root);
  await assert.rejects(readRepositoryFile(root, '../outside.ts', 1000), /outside/);
  await assert.rejects(readRepositoryFile(root, 'a.ts', 2), /bounded/);
  const outside = join(temporary, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'secret.ts'), 'private');
  await symlink(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(readRepositoryFile(root, 'linked/secret.ts', 1000), /Symlinks/);
  await unlink(join(root, 'linked'));
  assert.equal(await repositoryRoot(`"${root}"`), root);
  await assert.rejects(repositoryRoot('https://github.com/example/project'), /folder on your computer/);
  await assert.rejects(repositoryRoot(join(temporary, 'missing')), /folder could not be found/);
  await assert.rejects(repositoryRoot(temporary), /not a Git project/);
});

test('change preview explains current edits and latest commit without contacting AI', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Preview must not call a model.'); };
  try {
    const edits = changePreview(await previewChanges({ repoPath: `"${root}"`, baseRef: 'HEAD' }));
    assert.deepEqual(edits.files.map((file) => file.path), ['a.ts']);
    assert.match(edits.diff, /b \+ 2/);
    const latest = await previewChanges({ repoPath: root, baseRef: 'HEAD^' });
    assert.equal(latest.files.length, 2);
    await assert.rejects(previewChanges({ repoPath: root, baseRef: 'nonexistent-version' }), /saved version was not found/);
    assert.throws(() => changePreview({ files: null }), /incomplete/);
  } finally { globalThis.fetch = original; }
});

test('new Git projects with staged code can scan before their first commit', async () => {
  const fresh = join(temporary, 'new-project');
  await mkdir(fresh);
  await runGit(fresh, ['init']);
  await writeFile(join(fresh, 'hello.ts'), 'export const hello = 1;\n');
  await runGit(fresh, ['add', '--', 'hello.ts']);
  const map = await analyzeRepository(fresh);
  assert.equal(map.summary.commits, 0);
  assert.equal(map.nodes[0].id, 'hello.ts');
  await assert.rejects(previewChanges({ repoPath: fresh, baseRef: 'HEAD^' }), /at least two saved commits/);
});
test('malformed API payloads fail before rendering, and the labeled demo is valid', () => {
  assert.throws(() => atlasData({ nodes: [] }), /incomplete/);
  assert.throws(() => reviewStatus({ available: true, models: null }), /Invalid/);
  assert.throws(() => reviewResult({ findings: [] }), /incomplete/);
  assert.equal(reviewResult(reviewDemo).synthetic, true);
  assert.throws(() => reviewResult({ ...reviewDemo, chair: { status: 'unknown', elapsedMs: 0 } }), /incomplete/);
  assert.throws(() => reviewResult({ ...reviewDemo, findings: [{ ...reviewDemo.findings[0], line: -1 }] }), /incomplete/);
});

function mockModel(mode: 'valid' | 'chair-fails' | 'specialist-malformed' | 'no-findings' | 'chair-malformed' | 'chair-incomplete' | 'uncited' | 'invalid-only' | 'mixed-invalid') {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    if (String(_url).endsWith('/api/tags')) return Response.json({ models: [{ name: 'fixture-model' }] });
    const body = JSON.parse(String(options?.body));
    assert.equal(body.think, false, 'Request a final answer without spending the response budget on hidden reasoning.');
    const chair = body.messages[0].content.includes('skeptical chair');
    if (chair && mode === 'chair-fails') return new Response('', { status: 500 });
    const finding = { severity: 'high', category: 'correctness', file: 'a.ts', line: mode === 'uncited' ? 999 : 2, title: 'Synthetic fixture finding', comment: 'Fixture explanation', confidence: 0.6 };
    const payload = chair ? mode === 'chair-malformed' ? {} : { changeSummary: 'Synthetic fixture summary', purposeSummary: 'Not provided.', votes: mode === 'chair-incomplete' ? [] : [{ id: 'finding-1', verdict: 'supported', reason: 'Fixture evidence' }] }
      : mode === 'specialist-malformed' ? {} : { findings: mode === 'no-findings' ? [] : mode === 'invalid-only' ? [null, { ...finding, file: 'not-changed.ts' }] : mode === 'mixed-invalid' ? [finding, { ...finding, file: 'not-changed.ts' }] : [finding] };
    return Response.json({ message: { content: JSON.stringify(payload) }, prompt_eval_count: 10, eval_count: 5 });
  };
  return () => { globalThis.fetch = original; };
}
for (const mode of ['valid', 'chair-fails', 'specialist-malformed', 'no-findings', 'chair-malformed', 'chair-incomplete', 'uncited', 'invalid-only', 'mixed-invalid'] as const) {
  test(`local review workflow: ${mode}`, async () => {
    const restore = mockModel(mode);
    try {
      const report = await runReview({ repoPath: root, model: 'fixture-model' });
      assert.equal(report.synthetic, false);
      assert.equal(report.purposeSource, 'unprovided');
      assert.equal(report.purposeSummary, 'Not provided.');
      reviewResult(report);
      if (mode === 'chair-incomplete') {
        assert.equal(report.changeSummary, 'Synthetic fixture summary');
        assert.equal(report.changeSummarySource, 'model');
        assert.equal(report.chair.status, 'failed');
      }
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
      } else if (mode === 'uncited') { assert.equal(report.findings[0].line, null); assert.equal(report.decision, 'partial-review'); }
      else if (mode === 'invalid-only' || mode === 'mixed-invalid') {
        assert.equal(report.decision, 'partial-review');
        assert.equal(report.findings.length, mode === 'invalid-only' ? 0 : 1);
        assert.ok(report.agents.every((agent) => agent.rejectedFindings === (mode === 'invalid-only' ? 2 : 1)));
        assert.throws(() => reviewResult({ ...report, agents: [{ ...report.agents[0], rejectedFindings: -1 }] }), /incomplete/);
      }
      else if (mode === 'no-findings') assert.equal(report.decision, 'looks-clear');
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

test('quick explanation uses one local request and rejects unsupported citations', async () => {
  await writeFile(join(root, 'a.ts'), "import { b } from './b.js';\nexport const a = b + 2;\n");
  const original = globalThis.fetch;
  let chats = 0;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith('http://127.0.0.1:11434/'));
    if (String(url).endsWith('/tags')) return Response.json({ models: [{ name: 'fixture' }, { name: 'remote:cloud', remote_host: 'https://ollama.com' }] });
    chats++;
    assert.equal(JSON.parse(String(init?.body)).think, false);
    return Response.json({ message: { content: JSON.stringify({ whatChanged: 'The calculation adds two instead of one.', whyItMatters: 'The returned result increases by one.', checks: [{ text: 'Check the result.', file: 'a.ts', line: 2 }, { text: 'Invented.', file: 'outside.ts', line: 2 }] }) } });
  };
  try {
    assert.deepEqual((await ollamaStatus()).models, ['fixture']);
    const result = await explainChanges({ repoPath: root, model: 'fixture' });
    assert.equal(chats, 1); assert.equal(result.provider, 'local');
    assert.equal(result.checks.length, 1); assert.equal(result.partial, true);
  } finally { globalThis.fetch = original; }
});

test('cloud consent binds code, intent, model and action; disconnect removes credentials', async () => {
  const original = globalThis.fetch;
  let chats = 0;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith('https://ollama.com/'), 'cloud must not fall back to local or another host');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer synthetic-test-key');
    assert.equal(init?.redirect, 'error');
    if (String(url).endsWith('/tags')) return Response.json({ models: [{ name: 'fixture' }] });
    chats++;
    return Response.json({ message: { content: JSON.stringify({ whatChanged: 'Calculation changed.', whyItMatters: 'The result changes.', checks: [] }) } });
  };
  try {
    const status = await connectCloud('synthetic-test-key');
    assert.equal(status.available, true); assert.ok(!JSON.stringify(status).includes('synthetic-test-key'));
    const input = { repoPath: root, model: 'fixture', provider: 'cloud', intent: 'Synthetic intent' };
    const disclosure = await prepareDisclosure({ ...input, mode: 'explain' });
    assert.equal(chats, 0); assert.ok(disclosure.content.includes('Synthetic intent'));
    await assert.rejects(explainChanges(input), /cloud preview again/);
    await assert.rejects(explainChanges({ ...input, intent: 'Changed', disclosureDigest: disclosure.digest }), /cloud preview again/);
    await assert.rejects(runReview({ ...input, disclosureDigest: disclosure.digest }), /cloud preview again/);
    await writeFile(join(root, 'consent.ts'), 'export const changedAfterPreview = true;');
    try { await assert.rejects(explainChanges({ ...input, disclosureDigest: disclosure.digest }), /cloud preview again/); }
    finally { await unlink(join(root, 'consent.ts')); }
    assert.equal(chats, 0);
    const result = await explainChanges({ ...input, disclosureDigest: disclosure.digest });
    assert.equal(result.provider, 'cloud'); assert.equal(chats, 1);
    assert.ok(!JSON.stringify(result).includes('synthetic-test-key'));
    disconnectCloud(); assert.equal(cloudStatus().available, false);
    await assert.rejects(explainChanges({ ...input, disclosureDigest: disclosure.digest }), /Connect Ollama Cloud/);
    assert.equal(chats, 1);
  } finally { disconnectCloud(); globalThis.fetch = original; }
});

test('cloud provider errors are sanitized and never trigger local fallback', async () => {
  const original = globalThis.fetch;
  let chats = 0;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).startsWith('https://ollama.com/'));
    if (String(url).endsWith('/tags')) return Response.json({ models: [{ name: 'fixture' }] });
    chats++;
    return new Response('secret echo synthetic-test-key', { status: 401 });
  };
  try {
    await connectCloud('synthetic-test-key');
    const input = { repoPath: root, model: 'fixture', provider: 'cloud' };
    const disclosure = await prepareDisclosure({ ...input, mode: 'explain' });
    await assert.rejects(explainChanges({ ...input, disclosureDigest: disclosure.digest }), /Cloud authorization failed/);
    assert.equal(chats, 1);
  } finally { disconnectCloud(); globalThis.fetch = original; }
});

test('deeper cloud review uses the confirmed context for six requests and labels its provider', async () => {
  const original = globalThis.fetch;
  let chats = 0;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith('https://ollama.com/'));
    if (String(url).endsWith('/tags')) return Response.json({ models: [{ name: 'fixture' }] });
    chats++;
    const request = JSON.parse(String(init?.body));
    const context = JSON.parse(request.messages[1].content);
    assert.ok(context.diff.includes('export const a = b + 2'));
    return Response.json({ message: { content: JSON.stringify(context.proposedFindings ? { changeSummary: 'The return value increases.', purposeSummary: 'Not provided.', votes: [] } : { summary: 'Synthetic mock.', findings: [] }) } });
  };
  try {
    await connectCloud('synthetic-test-key');
    const input = { repoPath: root, model: 'fixture', provider: 'cloud' };
    const consent = await prepareDisclosure({ ...input, mode: 'review' });
    const report = await runReview({ ...input, disclosureDigest: consent.digest });
    assert.equal(report.provider, 'cloud'); assert.equal(report.decision, 'looks-clear');
    assert.equal(report.metrics.passed, 5); assert.equal(report.chair.status, 'complete'); assert.equal(chats, 6);
    assert.equal(reviewResult(report).provider, 'cloud');
  } finally { disconnectCloud(); globalThis.fetch = original; }
});

test('malformed quick explanations fail without discarding factual preview', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).endsWith('/tags') ? Response.json({ models: [{ name: 'fixture' }] }) : Response.json({ message: { content: '{"whatChanged":"Changed","checks":[]}' } });
  try { await assert.rejects(explainChanges({ repoPath: root, model: 'fixture' }), /incomplete explanation/); assert.ok((await previewChanges({ repoPath: root })).diff.includes('b + 2')); }
  finally { globalThis.fetch = original; }
});

test('Flutter projects scan Dart imports and generated exports do not hide source changes', async () => {
  const dartRoot = join(temporary, 'flutter-project');
  await mkdir(join(dartRoot, 'lib'), { recursive: true });
  await runGit(dartRoot, ['init']);
  await writeFile(join(dartRoot, 'pubspec.yaml'), 'name: fixture_app\n');
  await writeFile(join(dartRoot, 'lib', 'main.dart'), "import 'package:fixture_app/helper.dart';\nimport 'local.dart';\nvoid main() { helper(); local(); }\n");
  await writeFile(join(dartRoot, 'lib', 'helper.dart'), 'void helper() {}\n');
  await writeFile(join(dartRoot, 'lib', 'local.dart'), 'void local() {}\n');
  await runGit(dartRoot, ['add', '--', 'pubspec.yaml', 'lib']);
  await runGit(dartRoot, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic Flutter project']);
  const map = await analyzeRepository(join(dartRoot, 'lib'));
  assert.equal(map.summary.files, 3);
  assert.ok(map.edges.some((edge) => edge.kind === 'imports' && edge.from === 'lib/main.dart' && edge.to === 'lib/helper.dart'));
  assert.ok(map.edges.some((edge) => edge.kind === 'imports' && edge.from === 'lib/main.dart' && edge.to === 'lib/local.dart'));
  await mkdir(join(dartRoot, 'brag-output-synthetic'), { recursive: true });
  for (let index = 0; index < 25; index++) await writeFile(join(dartRoot, 'brag-output-synthetic', `${index}.json`), '{}');
  await mkdir(join(dartRoot, 'dist-landing'), { recursive: true });
  await writeFile(join(dartRoot, 'dist-landing', 'bundle.js'), 'const generated = true;');
  await mkdir(join(dartRoot, '.vercel'), { recursive: true });
  await writeFile(join(dartRoot, '.vercel', 'project.json'), '{}');
  await writeFile(join(dartRoot, 'lib', 'new.dart'), 'const newValue = 2;\n');
  const preview = await previewChanges({ repoPath: dartRoot });
  assert.deepEqual(preview.files.map((file) => file.path), ['lib/new.dart']);
  assert.equal(preview.generatedExcluded?.length, 27);
  assert.equal(preview.untrackedOmitted.length, 0);
  assert.ok(preview.diff.includes('const newValue = 2'));
});

test('cloud account block stops deeper review after one request with actionable error', async () => {
  const original = globalThis.fetch;
  let chats = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/tags')) return Response.json({ models: [{ name: 'fixture' }] });
    chats++; return new Response('private provider error body', { status: 402 });
  };
  try {
    await connectCloud('synthetic-test-key');
    const input = { repoPath: root, model: 'fixture', provider: 'cloud' };
    const preview = await prepareDisclosure({ ...input, mode: 'review' });
    assert.ok(preview.files.includes('a.ts'));
    await assert.rejects(runReview({ ...input, disclosureDigest: preview.digest }), /blocked.*402.*usage allowance/);
    assert.equal(chats, 1, 'no further specialists or final review after account denial');
  } finally { disconnectCloud(); globalThis.fetch = original; }
});

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, Check, CircleAlert, CircleHelp, Clock3, Cpu, Database, FileDiff, LoaderCircle, MessageSquareText, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ChangePreview, ReviewFinding, ReviewResult, ReviewStatus } from './types';
import { reviewDemo } from './reviewDemo';
import { changePreview, readResponse, reviewResult, reviewStatus } from './api';
import { downloadText } from './download';

type Props = { repoPath: string; onRepoPathChange: (path: string) => void };
type FeedbackVote = 'useful' | 'incorrect';

const agentDescriptions: Record<string, string> = {
  security: 'Could this expose data or allow unwanted access?',
  architecture: 'Will the parts still work together?',
  quality: 'Does the changed code behave correctly?',
  tests: 'What behavior still needs a test?',
  performance: 'Could this make the app slower?',
};

function decisionLabel(decision: ReviewResult['decision']) {
  return ({ 'request-changes': 'Request changes', 'review-findings': 'Review findings', 'looks-clear': 'No findings', 'partial-review': 'Partial review' })[decision];
}

function severityLabel(severity: ReviewFinding['severity']) { return severity.toUpperCase(); }

function diffExcerpt(diff: string, file: string, targetLine: number | null) {
  const lines = diff.replace(/\r\n/g, '\n').split('\n');
  const headerIndex = lines.findIndex((line) => line === `+++ b/${file}`);
  if (headerIndex < 0) return [];
  const rows: { number: number | null; marker: string; text: string; kind: 'added' | 'removed' | 'context' }[] = [];
  let newLine = 0;
  for (let index = headerIndex + 1; index < lines.length && !lines[index].startsWith('diff --git '); index += 1) {
    const row = lines[index];
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { newLine = Number(hunk[1]); continue; }
    if (row.startsWith('+++ ') || row.startsWith('--- ') || row.startsWith('\\')) continue;
    if (row.startsWith('+')) rows.push({ number: newLine++, marker: '+', text: row.slice(1), kind: 'added' });
    else if (row.startsWith('-')) rows.push({ number: null, marker: '−', text: row.slice(1), kind: 'removed' });
    else if (row.startsWith(' ')) rows.push({ number: newLine++, marker: ' ', text: row.slice(1), kind: 'context' });
  }
  let center = targetLine ? rows.findIndex((row) => row.number === targetLine) : 0;
  if (center < 0) center = 0;
  return rows.slice(Math.max(0, center - 3), Math.min(rows.length, center + 5));
}

export default function ReviewPanel({ repoPath, onRepoPathChange }: Props) {
  const [status, setStatus] = useState<ReviewStatus>({ available: false, models: [], reason: 'Checking local Ollama…' });
  const [baseRef, setBaseRef] = useState('HEAD');
  const [comparison, setComparison] = useState('HEAD');
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [checkingChanges, setCheckingChanges] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [intent, setIntent] = useState('');
  const [model, setModel] = useState('');
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Record<string, FeedbackVote>>({});
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');
  const [checkingModels, setCheckingModels] = useState(false);

  useEffect(() => {
    void refreshModels();
  }, []);
  useEffect(() => { setPreview(null); }, [repoPath, baseRef]);
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const start = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function refreshModels() {
    setCheckingModels(true);
    try {
      const response = await fetch('/api/review/status');
      const next = reviewStatus(await readResponse(response));
      setStatus(next);
      setModel((current) => current && next.models.includes(current) ? current : next.models.find((name) => name.startsWith('qwen3.5:9b')) ?? next.models.find((name) => name.includes('coder')) ?? next.models[0] ?? '');
    } catch {
      setStatus({ available: false, models: [], reason: 'Could not reach the local review service.' });
    } finally { setCheckingModels(false); }
  }

  const additions = useMemo(() => result?.files.reduce((sum, file) => sum + file.additions, 0) ?? 0, [result]);
  const deletions = useMemo(() => result?.files.reduce((sum, file) => sum + file.deletions, 0) ?? 0, [result]);

  async function checkChanges() {
    if (!repoPath.trim() || (comparison === 'custom' && !baseRef.trim())) { setError('Enter your project folder and, for Advanced comparison, a branch or commit name.'); return null; }
    setCheckingChanges(true); setError('');
    try {
      const payload = changePreview(await readResponse(await fetch('/api/review/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repoPath, baseRef }) })));
      setPreview(payload);
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not check your edits.');
      return null;
    } finally { setCheckingChanges(false); }
  }

  async function run(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      const changes = await checkChanges();
      if (!changes || !changes.files.length || !changes.diff.trim()) return;
      const response = await fetch('/api/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repoPath, baseRef, intent, model }) });
      const payload = reviewResult(await readResponse(response));
      setResult(payload);
      setFeedback({});
      setNotice(`Review complete · ${payload.metrics.passed}/${payload.metrics.totalAgents} specialist passes`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not review these changes.');
    } finally { setBusy(false); }
  }

  async function rateFinding(finding: ReviewFinding, vote: FeedbackVote) {
    if (!result || saving) return;
    if (result.synthetic) {
      setFeedback((current) => ({ ...current, [finding.id]: vote }));
      setNotice('Example feedback only · reviewer weights are unchanged.');
      return;
    }
    setSaving(finding.id); setError('');
    try {
      const response = await fetch('/api/review/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewId: result.reviewId, findingId: finding.id, vote, agents: finding.agents }) });
      const payload = await readResponse(response) as { useful?: unknown; incorrect?: unknown };
      if (!payload || !Number.isInteger(payload.useful) || !Number.isInteger(payload.incorrect) || Number(payload.useful) < 0 || Number(payload.incorrect) < 0) throw new Error('The local service returned incomplete feedback totals.');
      setFeedback((current) => ({ ...current, [finding.id]: vote }));
      setResult((current) => current ? { ...current, metrics: { ...current.metrics, usefulFeedback: Number(payload.useful), incorrectFeedback: Number(payload.incorrect) } } : current);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save feedback.'); }
    finally { setSaving(''); }
  }

  function downloadReport() {
    if (!result) return;
    downloadText(JSON.stringify(result, null, 2), `stxic-atlas-review-${result.repository}.json`, 'application/json');
  }
  function downloadReadableReport() {
    if (!result) return;
    downloadText([
      `Stxic Atlas · ${result.repository}`, result.synthetic ? 'SYNTHETIC EXAMPLE — fictional code and findings' : 'Local AI review — verify concerns against the code',
      `Result: ${decisionLabel(result.decision)}`, `Compared with: ${result.baseRef}`, '',
      'What changed', result.changeSummary, '', 'Why', result.purposeSummary, '',
      'Possible problems', ...result.findings.map((finding) => `${finding.severity.toUpperCase()}: ${finding.title}\n${finding.file}${finding.line ? `:${finding.line}` : ''}\n${finding.comment}\nSuggested fix: ${finding.suggestedFix ?? 'Inspect this change.'}\nFinal check: ${finding.chairVerdict} — ${finding.chairReason}\n`),
      result.findings.length ? '' : 'No findings returned. This does not guarantee the change is safe.',
      `Completed checks: ${result.metrics.passed}/${result.metrics.totalAgents}; final check: ${result.chair.status}`,
      result.diffTruncated ? 'Only part of the change was reviewed.' : '',
      result.untrackedOmitted.length ? `New files omitted: ${result.untrackedOmitted.join(', ')}` : '',
    ].join('\n'), `stxic-atlas-review-${result.repository}.txt`);
  }

  return <section className="review-workspace" aria-labelledby="review-heading">
    <div className="review-intro">
      <div><h2 id="review-heading">What changed?</h2><p>Check your edits first. AI can then explain risks and point to the code behind each concern.</p></div>
      <div className={`ollama-state ${status.available ? 'ready' : 'offline'}`}><span className="state-dot" /><Cpu size={15} /><span>{status.available ? 'LOCAL MODEL READY' : 'MODEL UNAVAILABLE'}</span></div>
    </div>

    <form className="review-setup" onSubmit={(event) => { event.preventDefault(); void checkChanges(); }}>
      <div className="review-setup-heading"><div><span className="eyebrow">CHANGE INPUT</span><h3>Choose what to review</h3></div><button type="button" className="text-action" disabled={busy} onClick={() => { setResult(structuredClone(reviewDemo)); setPreview(null); setFeedback({}); setError(''); setNotice('Synthetic review loaded. No model was run.'); }}>Explore example review<ArrowRight size={14} /></button></div>
      <div className="review-fields">
        <label className="review-path-field"><span>Project folder</span><input aria-label="Project folder" required disabled={busy || checkingChanges} value={repoPath} onChange={(event) => onRepoPathChange(event.target.value)} placeholder="C:\path\to\repository" autoComplete="off" /><small>Paste the folder address from File Explorer, not a GitHub link.</small></label>
        <label className="review-base-field"><span>Changes to check</span><select aria-label="Changes to check" disabled={busy || checkingChanges} value={comparison} onChange={(event) => { setComparison(event.target.value); setBaseRef(event.target.value === 'custom' ? 'main' : event.target.value); }}><option value="HEAD">Current edits</option><option value="HEAD^">Latest saved commit + edits</option><option value="custom">Advanced comparison</option></select><small>Current edits compares with the latest Git save.</small>{comparison === 'custom' && <input required disabled={busy || checkingChanges} aria-label="Branch or commit to compare" value={baseRef} onChange={(event) => setBaseRef(event.target.value)} placeholder="main or a commit ID" />}</label>
        <label className="review-model-field"><span>AI on this computer</span><select aria-label="AI on this computer" value={model} onChange={(event) => setModel(event.target.value)} disabled={busy || !status.models.length}>{status.models.length ? status.models.map((name) => <option value={name} key={name}>{name}</option>) : <option value="">No local AI installed</option>}</select><button className="text-action" type="button" onClick={refreshModels} disabled={checkingModels || busy}>{checkingModels ? 'Checking AI…' : 'Refresh AI list'}</button></label>
      </div>
      <label className="review-intent-field"><span>WHAT IS THIS CHANGE FOR? <small>OPTIONAL</small></span><textarea value={intent} onChange={(event) => setIntent(event.target.value)} maxLength={1200} rows={2} placeholder="Example: Add discount support to checkout so returning customers see a reduced subtotal before tax." /></label>
      <div className="review-submit-row"><p><ShieldCheck size={14} /> Your code stays on this computer. Checking edits does not need AI.</p><button className="copy-button check-changes-button" type="button" disabled={busy || checkingChanges || !repoPath.trim()} onClick={() => { void checkChanges(); }}>{checkingChanges ? 'Checking edits…' : 'Check changes'}</button><button className="run-review-button" type="button" onClick={(event) => { void run(event); }} disabled={busy || checkingChanges || !status.available || !model || !repoPath.trim()}>{busy ? <><LoaderCircle className="spin" size={15} />Explaining changes… {elapsed}s</> : <>Explain with AI<ArrowRight size={15} /></>}</button></div>
      {!repoPath.trim() && <p className="setup-guidance">Paste a project folder above to check your own edits, or choose Explore example review to try this without setup.</p>}
      {preview && <div className="change-preview" role="status"><strong>{preview.files.length ? `${preview.files.length} changed file${preview.files.length === 1 ? '' : 's'} found` : 'No edits found for this comparison'}</strong><p>{preview.files.length ? 'These are the files AI will inspect. This list comes from Git, not AI.' : 'If you already saved your work as a Git commit, choose Latest saved commit + edits. Otherwise edit a tracked file and check again.'}</p>{preview.files.length > 0 && <ul>{preview.files.map((file) => <li key={file.path}><code>{file.path}</code><span>+{file.additions} / −{file.deletions}</span></li>)}</ul>}{preview.diffTruncated && <p>The change is too large to review fully. AI will see only part of it.</p>}{preview.untrackedOmitted.length > 0 && <p>{preview.untrackedOmitted.length} new file(s) could not be included.</p>}<details><summary>View code changes</summary><pre>{preview.diff || 'No code changes to show.'}</pre></details></div>}
      {/\b(?:0\.5|1|1\.5|2|3)b\b/i.test(model) && <p className="setup-guidance">This is a small AI model. It runs quickly but can misread code. Inspect every concern; a larger model may give a better explanation.</p>}
      {status.available && <p className="setup-guidance">AI suggestions can be wrong, even after the final check. They help you decide what to inspect; they do not approve the change.</p>}
      {!status.available && <div className="ollama-help" role="status"><CircleHelp size={15} /><span>{status.reason} Start Ollama and install a chat model, then refresh the model list.</span><button type="button" onClick={refreshModels} disabled={checkingModels}>{checkingModels ? 'Checking…' : 'Refresh'}</button></div>}
      {error && <div className="review-error" role="alert"><CircleAlert size={15} />{error}</div>}
    </form>

    <div className="swarm-layout">
      <aside className="agent-rail" aria-label="Specialist review agents">
        <div className="rail-head"><span>REVIEWERS</span><span>WEIGHT</span></div>
        {(result?.agents ?? [
          { id: 'security', name: 'Security', weight: 1.4, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
          { id: 'architecture', name: 'Architecture', weight: 1.2, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
          { id: 'quality', name: 'Quality', weight: 1, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
          { id: 'tests', name: 'Tests', weight: 1.1, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
          { id: 'performance', name: 'Performance', weight: 1, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
        ]).map((agent, index) => <div className={`agent-card ${agent.status === 'complete' ? 'agent-done' : ''}`} key={agent.id}>
          <span className="agent-index">0{index + 1}</span><div className="agent-copy"><strong>{agent.name}</strong><small>{agentDescriptions[agent.id]}</small></div><span className="agent-weight">{agent.weight.toFixed(1)}×</span>
          {busy ? <LoaderCircle className="spin agent-status-pending" size={15} /> : agent.status === 'complete' ? <Check className="agent-status-done" size={16} /> : result ? <CircleAlert className="agent-status-error" size={15} /> : <span className="agent-status-idle" />}
          {result && <div className="agent-result">{agent.status === 'complete' ? `${agent.findings} finding${agent.findings === 1 ? '' : 's'} · ${Math.round(agent.elapsedMs / 1000)}s · ${(agent.promptTokens + agent.responseTokens).toLocaleString()} tokens` : agent.error}</div>}
        </div>)}
        <div className="chair-card"><div className="chair-icon"><MessageSquareText size={15} /></div><div><strong>Final reviewer</strong><small>{result?.chair.status === 'complete' ? result.findings.length ? 'Summarized diff and challenged findings' : 'Summarized diff; no findings to challenge' : result?.chair.status === 'failed' ? 'Debate pass unavailable' : 'Checks the proposed concerns against the code'}</small></div>{result?.chair.status === 'complete' ? <Check size={15} /> : <span className="agent-status-idle" />}</div>
        <p className="agent-rail-note">Agent weights start from their review role. Your local feedback nudges them over time.</p>
      </aside>

      <div className="review-report">
        {!result && !busy && <div className="review-empty"><div className="empty-glyph"><FileDiff size={21} /></div><span className="eyebrow">READY WHEN YOU ARE</span><h3>Understand an edit before approving it.</h3><p>Paste your project folder and click Check changes. Then choose Explain with AI to see possible problems and their supporting code. You can also explore a fictional example without setting anything up.</p><div className="empty-evidence-note"><ShieldCheck size={14} />No source is uploaded. Facts from Git stay separate from model interpretation.</div></div>}
        {busy && <div className="review-running" role="status"><LoaderCircle className="spin" size={24} /><div><strong>AI is reading your changes · {elapsed}s elapsed</strong><span>Five checks run, followed by a final explanation. This can take several minutes on a local computer. You can switch to File connections and come back.</span></div></div>}
        {result && <>
          {result.synthetic && <div className="demo-banner" role="status"><strong>Synthetic review example.</strong><span>Diff, findings, votes, and agreement are illustrative. No model was run; feedback is temporary.</span></div>}
          <div className={`decision-strip decision-${result.decision}`}><div className="decision-label"><span className="eyebrow">REVIEW RESULT</span><strong>{decisionLabel(result.decision)}</strong></div><div className="decision-stat"><strong>{result.findings.length ? `${Math.round(result.confidence * 100)}%` : '—'}</strong><span>reviewer agreement</span></div><div className="decision-files"><FileDiff size={17} /><span><strong>{result.files.length} files</strong><small><i>+{additions}</i> / <b>−{deletions}</b></small></span></div></div>
          {result.decision === 'partial-review' && <div className="partial-note" role="status"><CircleAlert size={14} /><span>Incomplete review · {result.metrics.passed}/{result.metrics.totalAgents} specialists completed. {result.chair.status === 'failed' ? `Final check incomplete: ${result.chair.error ?? 'Unavailable'}. ` : ''}{result.diffTruncated ? 'The diff exceeded the review limit. ' : ''}{result.untrackedOmitted.length > 0 ? 'Some untracked files were omitted. ' : ''}Inspect the available findings and remaining changes.</span></div>}
          <div className="result-toolbar"><span>{result.repository} <i>/</i> {result.branch} <i>against</i> {result.baseRef}</span><div className="report-actions"><button type="button" onClick={downloadReadableReport}><ArrowDownToLine size={13} />Save readable report</button><button type="button" onClick={downloadReport}>Export JSON</button></div></div>
          <div className="change-brief"><div><span>{result.synthetic ? 'WHAT CHANGED · SYNTHETIC EXAMPLE' : result.changeSummarySource === 'model' ? 'WHAT CHANGED · LOCAL MODEL SUMMARY' : 'WHAT CHANGED · GIT COUNTS'}</span><p>{result.changeSummary}</p></div><div><span>{result.synthetic ? 'WHY · ILLUSTRATIVE INTENT' : result.purposeSource === 'user' ? 'WHY · YOUR NOTE' : result.purposeSource === 'git' ? 'WHY · GIT COMMIT CONTEXT' : 'WHY · NOT PROVIDED'}</span><p>{result.purposeSummary}</p>{result.purposeSource === 'user' && result.commitMessages.length > 0 && <small>Recent branch commit subjects: {result.commitMessages.join(' · ')}</small>}</div></div>
          {result.contextFiles.length > 0 && <div className="repo-context-note"><span>PROJECT DOCS INCLUDED</span><code>{result.contextFiles.join(' · ')}</code></div>}
          {result.findings.length ? <div className="review-findings">{result.findings.map((finding, index) => <FindingCard key={finding.id} finding={finding} diff={result.diff} index={index} feedback={feedback[finding.id]} saving={Boolean(saving)} onFeedback={rateFinding} />)}</div> : <div className="clear-review"><Check size={18} /><div><strong>{result.decision === 'looks-clear' ? 'No findings from this review.' : 'No findings were returned by the completed passes.'}</strong><span>A clean review is not proof that the change is bug-free. Check the diff and run your test suite.</span></div></div>}
          <details className="review-diff"><summary><FileDiff size={14} />Inspect exact Git diff <span>{result.files.length} files · {result.diff.length.toLocaleString()} chars{result.diffTruncated ? ' · truncated for review' : ''}</span></summary><pre>{result.diff}</pre></details>
          {result.untrackedOmitted.length > 0 && <div className="partial-note"><CircleHelp size={14} />Some untracked files were not included: {result.untrackedOmitted.slice(0, 5).join(', ')}</div>}
          <div className="review-metrics"><div><Clock3 size={14} /><span>REVIEW TIME</span><strong>{(result.elapsedMs / 1000).toFixed(1)}s</strong></div><div><Check size={14} /><span>PASSES</span><strong>{result.metrics.passed}/{result.metrics.totalAgents}</strong></div><div><Cpu size={14} /><span>TOKEN USAGE</span><strong>{result.metrics.totalTokens.toLocaleString()}</strong></div><div><Database size={14} /><span>FEEDBACK STORED LOCALLY</span><strong>{result.metrics.usefulFeedback + result.metrics.incorrectFeedback}</strong></div></div>
        </>}
      </div>
    </div>
    {notice && <div className="review-notice" role="status"><Check size={14} />{notice}</div>}
    <div className="review-disclosure"><ShieldCheck size={14} /><span>Local-first by design. Findings are model interpretations, not guarantees. Verify each claim against the cited diff.</span></div>
  </section>;
}

function FindingCard({ finding, diff, index, feedback, saving, onFeedback }: { finding: ReviewFinding; diff: string; index: number; feedback?: FeedbackVote; saving: boolean; onFeedback: (finding: ReviewFinding, vote: FeedbackVote) => void }) {
  const excerpt = diffExcerpt(diff, finding.file, finding.line);
  return <article className="review-finding">
    <div className="finding-topline"><span>FINDING {String(index + 1).padStart(2, '0')}</span><span className={`severity-tag severity-${finding.severity}`}>{severityLabel(finding.severity)}</span></div>
    <h3>{finding.title}</h3>
    <button className="finding-location" type="button" onClick={() => { const diff = document.querySelector<HTMLDetailsElement>('.review-diff'); if (diff) { diff.open = true; diff.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } }}><code>{finding.file}{finding.line ? `:${finding.line}` : ''}</code><ArrowRight size={12} /></button>
    {!finding.line && <p className="setup-guidance">This is a file-level concern. The model did not provide a valid changed-line citation.</p>}
    <p className="finding-comment">{finding.comment}</p>
    {excerpt.length > 0 && <div className="diff-excerpt"><div><span>RELEVANT DIFF</span><code>{finding.line ? `NEW LINE ${finding.line}` : 'CHANGE HUNK'}</code></div><pre>{excerpt.map((row, rowIndex) => <span className={`diff-code-line diff-${row.kind}`} key={`${row.number}-${rowIndex}`}><i>{row.number ?? ''}</i><b>{row.marker}</b><code>{row.text || ' '}</code></span>)}</pre></div>}
    {finding.suggestedFix && <div className="suggested-fix"><span>SUGGESTED FIX</span><p>{finding.suggestedFix}</p></div>}
    <div className="finding-proof-row"><div className="finding-agents"><span>REVIEWER VOTES</span><div>{finding.agents.map((agent) => <span className="agent-vote" key={agent}>{agent}</span>)}</div></div><div className="finding-agreement"><span>WEIGHTED AGREEMENT</span><strong>{Math.round(finding.agreement * 100)}%</strong></div><div className={`chair-verdict chair-${finding.chairVerdict}`}><span>FINAL CHECK</span><strong>{finding.chairVerdict === 'not-run' ? 'Not run' : finding.chairVerdict}</strong>{finding.chairReason && <small>{finding.chairReason}</small>}</div></div>
    <div className="finding-feedback"><span>{feedback ? `Marked ${feedback}` : 'Was this finding useful?'}</span><div><button type="button" disabled={saving} className={feedback === 'useful' ? 'selected' : ''} onClick={() => onFeedback(finding, 'useful')}><ThumbsUp size={13} />Useful</button><button type="button" disabled={saving} className={feedback === 'incorrect' ? 'selected incorrect' : ''} onClick={() => onFeedback(finding, 'incorrect')}><ThumbsDown size={13} />Incorrect</button></div></div>
  </article>;
}


import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowRight, Check, CircleAlert, CircleHelp, Clock3, Cpu, Database, FileDiff, LoaderCircle, MessageSquareText, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ReviewFinding, ReviewResult, ReviewStatus } from './types';
import { reviewDemo } from './reviewDemo';
import { readResponse, reviewResult, reviewStatus } from './api';

type Props = { repoPath: string; onRepoPathChange: (path: string) => void };
type FeedbackVote = 'useful' | 'incorrect';

const agentDescriptions: Record<string, string> = {
  security: 'Injection, access control, unsafe inputs',
  architecture: 'Contracts, boundaries, behavior',
  quality: 'Correctness and failure handling',
  tests: 'Coverage and missing edge cases',
  performance: 'Runtime and resource regressions',
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

  async function run(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true); setResult(null); setFeedback({});
    try {
      const response = await fetch('/api/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repoPath, baseRef, intent, model }) });
      const payload = reviewResult(await readResponse(response));
      setResult(payload);
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
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not save feedback.');
      setFeedback((current) => ({ ...current, [finding.id]: vote }));
      setResult((current) => current ? { ...current, metrics: { ...current.metrics, usefulFeedback: payload.useful, incorrectFeedback: payload.incorrect } } : current);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save feedback.'); }
    finally { setSaving(''); }
  }

  function downloadReport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `stxic-atlas-review-${result.repository}.json`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <section className="review-workspace" aria-labelledby="review-heading">
    <div className="review-intro">
      <div><div className="eyebrow"><span className="eyebrow-mark">02</span> LOCAL REVIEW WORKFLOW</div><h2 id="review-heading">Review swarm</h2><p>Independent specialist passes. A skeptical chair. Evidence stays on this machine.</p></div>
      <div className={`ollama-state ${status.available ? 'ready' : 'offline'}`}><span className="state-dot" /><Cpu size={15} /><span>{status.available ? 'LOCAL MODEL READY' : 'MODEL UNAVAILABLE'}</span></div>
    </div>

    <form className="review-setup" onSubmit={run}>
      <div className="review-setup-heading"><div><span className="eyebrow">CHANGE INPUT</span><h3>Choose what to review</h3></div><button type="button" className="text-action" disabled={busy} onClick={() => { setResult(structuredClone(reviewDemo)); setFeedback({}); setError(''); setNotice('Synthetic review loaded. No model was run.'); }}>Explore example review<ArrowRight size={14} /></button></div>
      <div className="review-fields">
        <label className="review-path-field"><span>LOCAL REPOSITORY</span><input required value={repoPath} onChange={(event) => onRepoPathChange(event.target.value)} placeholder="C:\path\to\repository" autoComplete="off" /></label>
        <label className="review-base-field"><span>COMPARE AGAINST</span><input required value={baseRef} onChange={(event) => setBaseRef(event.target.value)} placeholder="HEAD or main" /></label>
        <label className="review-model-field"><span>LOCAL MODEL</span><select value={model} onChange={(event) => setModel(event.target.value)} disabled={!status.models.length}>{status.models.length ? status.models.map((name) => <option value={name} key={name}>{name}</option>) : <option value="">No local model found</option>}</select></label>
      </div>
      <label className="review-intent-field"><span>WHAT IS THIS CHANGE FOR? <small>OPTIONAL</small></span><textarea value={intent} onChange={(event) => setIntent(event.target.value)} maxLength={1200} rows={2} placeholder="Example: Add discount support to checkout so returning customers see a reduced subtotal before tax." /></label>
      <div className="review-submit-row"><p><ShieldCheck size={14} /> Source and diff are sent only to Ollama on localhost. New source files are included when supported.</p><button className="run-review-button" type="submit" disabled={busy || !status.available || !model || !repoPath.trim()}>{busy ? <><LoaderCircle className="spin" size={15} />Running review…</> : <>Run local review<ArrowRight size={15} /></>}</button></div>
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
        <div className="chair-card"><div className="chair-icon"><MessageSquareText size={15} /></div><div><strong>Consensus chair</strong><small>{result?.chair.status === 'complete' ? result.findings.length ? 'Summarized diff and challenged findings' : 'Summarized diff; no findings to challenge' : result?.chair.status === 'failed' ? 'Debate pass unavailable' : 'Second-pass skeptical review'}</small></div>{result?.chair.status === 'complete' ? <Check size={15} /> : <span className="agent-status-idle" />}</div>
        <p className="agent-rail-note">Agent weights start from their review role. Your local feedback nudges them over time.</p>
      </aside>

      <div className="review-report">
        {!result && !busy && <div className="review-empty"><div className="empty-glyph"><FileDiff size={21} /></div><span className="eyebrow">READY WHEN YOU ARE</span><h3>See what changed, and what reviewers think it means.</h3><p>Run a review to compare your working tree with a Git ref. Findings will point to changed files and lines; the change intent you provide helps explain why the code changed.</p><div className="empty-evidence-note"><ShieldCheck size={14} />No source is uploaded. Facts from Git stay separate from model interpretation.</div></div>}
        {busy && <div className="review-running"><LoaderCircle className="spin" size={24} /><div><strong>Independent reviews are running</strong><span>Each specialist is reading the same bounded Git diff.</span></div></div>}
        {result && <>
          {result.synthetic && <div className="demo-banner" role="status"><strong>Synthetic review example.</strong><span>Diff, findings, votes, and agreement are illustrative. No model was run; feedback is temporary.</span></div>}
          <div className={`decision-strip decision-${result.decision}`}><div className="decision-label"><span className="eyebrow">SWARM DECISION</span><strong>{decisionLabel(result.decision)}</strong></div><div className="decision-stat"><strong>{result.findings.length ? `${Math.round(result.confidence * 100)}%` : '—'}</strong><span>average agent agreement</span></div><div className="decision-files"><FileDiff size={17} /><span><strong>{result.files.length} files</strong><small><i>+{additions}</i> / <b>−{deletions}</b></small></span></div></div>
          {result.decision === 'partial-review' && <div className="partial-note" role="status"><CircleAlert size={14} /><span>Incomplete review · {result.metrics.passed}/{result.metrics.totalAgents} specialists completed. {result.chair.status === 'failed' ? `Chair failed: ${result.chair.error ?? 'Unavailable'}. ` : ''}{result.diffTruncated ? 'The diff exceeded the review limit. ' : ''}{result.untrackedOmitted.length > 0 ? 'Some untracked files were omitted. ' : ''}Inspect the available findings and remaining changes.</span></div>}
          <div className="result-toolbar"><span>{result.repository} <i>/</i> {result.branch} <i>against</i> {result.baseRef}</span><button type="button" onClick={downloadReport}><ArrowDownToLine size={13} />Export JSON</button></div>
          <div className="change-brief"><div><span>{result.synthetic ? 'WHAT CHANGED · SYNTHETIC EXAMPLE' : result.chair.status === 'complete' ? 'WHAT CHANGED · LOCAL MODEL SUMMARY' : 'WHAT CHANGED · GIT COUNTS'}</span><p>{result.changeSummary}</p></div><div><span>{result.synthetic ? 'WHY · ILLUSTRATIVE INTENT' : result.purposeSource === 'user' ? 'WHY · YOUR NOTE' : result.purposeSource === 'git' ? 'WHY · GIT COMMIT CONTEXT' : 'WHY · NOT PROVIDED'}</span><p>{result.purposeSummary}</p>{result.purposeSource === 'user' && result.commitMessages.length > 0 && <small>Recent branch commit subjects: {result.commitMessages.join(' · ')}</small>}</div></div>
          {result.contextFiles.length > 0 && <div className="repo-context-note"><span>PROJECT DOCS INCLUDED</span><code>{result.contextFiles.join(' · ')}</code></div>}
          {result.findings.length ? <div className="review-findings">{result.findings.map((finding, index) => <FindingCard key={finding.id} finding={finding} diff={result.diff} index={index} feedback={feedback[finding.id]} saving={saving === finding.id} onFeedback={rateFinding} />)}</div> : <div className="clear-review"><Check size={18} /><div><strong>{result.decision === 'looks-clear' ? 'No findings from this review.' : 'No findings were returned by the completed passes.'}</strong><span>A clean review is not proof that the change is bug-free. Check the diff and run your test suite.</span></div></div>}
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
    <p className="finding-comment">{finding.comment}</p>
    {excerpt.length > 0 && <div className="diff-excerpt"><div><span>RELEVANT DIFF</span><code>{finding.line ? `NEW LINE ${finding.line}` : 'CHANGE HUNK'}</code></div><pre>{excerpt.map((row, rowIndex) => <span className={`diff-code-line diff-${row.kind}`} key={`${row.number}-${rowIndex}`}><i>{row.number ?? ''}</i><b>{row.marker}</b><code>{row.text || ' '}</code></span>)}</pre></div>}
    {finding.suggestedFix && <div className="suggested-fix"><span>SUGGESTED FIX</span><p>{finding.suggestedFix}</p></div>}
    <div className="finding-proof-row"><div className="finding-agents"><span>AGENT VOTES</span><div>{finding.agents.map((agent) => <span className="agent-vote" key={agent}>{agent}</span>)}</div></div><div className="finding-agreement"><span>WEIGHTED AGREEMENT</span><strong>{Math.round(finding.agreement * 100)}%</strong></div><div className={`chair-verdict chair-${finding.chairVerdict}`}><span>CHAIR PASS</span><strong>{finding.chairVerdict === 'not-run' ? 'Not run' : finding.chairVerdict}</strong>{finding.chairReason && <small>{finding.chairReason}</small>}</div></div>
    <div className="finding-feedback"><span>{feedback ? `Marked ${feedback}` : 'Was this finding useful?'}</span><div><button type="button" disabled={saving} className={feedback === 'useful' ? 'selected' : ''} onClick={() => onFeedback(finding, 'useful')}><ThumbsUp size={13} />Useful</button><button type="button" disabled={saving} className={feedback === 'incorrect' ? 'selected incorrect' : ''} onClick={() => onFeedback(finding, 'incorrect')}><ThumbsDown size={13} />Incorrect</button></div></div>
  </article>;
}


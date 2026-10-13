import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Check, CircleAlert, CircleHelp, Clock3, Cpu, Database, FileDiff, LoaderCircle, MessageSquareText, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { AIProvider, Disclosure, Explanation, ChangePreview, ReviewFinding, ReviewResult, ReviewStatus } from './types';
import { reviewDemo } from './reviewDemo';
import { disclosure, explanation, changePreview, readResponse, reviewResult, reviewStatus } from './api';
import { downloadText } from './download';
import ProjectPicker, { rememberProject } from './ProjectPicker';
import CloudConnection from './CloudConnection';

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
  const [provider, setProvider] = useState<AIProvider>('local');
  const [cloud, setCloud] = useState<ReviewStatus>({ available: false, models: [], reason: '' });
  const [cloudModel, setCloudModel] = useState('');
  const [brief, setBrief] = useState<Explanation | null>(null);
  const [pending, setPending] = useState<Disclosure | null>(null);
  const [consent, setConsent] = useState(false);
  const [activeMode, setActiveMode] = useState<'explain' | 'review'>('explain');
  const cloudDialog = useRef<HTMLDialogElement>(null);
  const briefSection = useRef<HTMLElement>(null);
  const selectedStatus = provider === 'local' ? status : cloud;
  const [baseRef, setBaseRef] = useState('HEAD');
  const [comparison, setComparison] = useState('HEAD');
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [checkingChanges, setCheckingChanges] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [intent, setIntent] = useState('');
  const [model, setModel] = useState('');
  const selectedModel = provider === 'local' ? model : cloudModel;
  const inputIdentity = useRef('');
  inputIdentity.current = JSON.stringify([repoPath, baseRef]);
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
  useEffect(() => { setPreview(null); setBrief(null); setResult(null); setNotice(''); setError(''); setFeedback({}); }, [repoPath, baseRef]);
  useEffect(() => { setPending(null); setConsent(false); }, [repoPath, baseRef, intent, provider, selectedModel]);
  useEffect(() => {
    const dialog = cloudDialog.current;
    if (pending && dialog && !dialog.open) dialog.showModal();
    else if (!pending && dialog?.open) dialog.close();
  }, [pending]);
  useEffect(() => {
    if (provider !== 'cloud') return;
    let cancelled = false;
    fetch('/api/cloud/status').then(readResponse).then(reviewStatus).then((value) => { if (!cancelled) setCloud(value); }).catch(() => { if (!cancelled) setError('Could not check the cloud connection. Try switching back to local AI.'); });
    return () => { cancelled = true; };
  }, [provider]);
  useEffect(() => { setCloudModel((current) => cloud.models.includes(current) ? current : cloud.models[0] || ''); }, [cloud]);
  useEffect(() => {
    if (!brief || !briefSection.current || briefSection.current.offsetParent === null) return;
    briefSection.current.focus({ preventScroll: true });
    briefSection.current.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [brief]);
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
    const expectedInput = inputIdentity.current;
    if (!repoPath.trim() || (comparison === 'custom' && !baseRef.trim())) { setError('Enter your project folder and, for Advanced comparison, a branch or commit name.'); return null; }
    setCheckingChanges(true); setError('');
    try {
      const payload = changePreview(await readResponse(await fetch('/api/review/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repoPath, baseRef }) })));
      if (expectedInput !== inputIdentity.current) return null;
      setPreview(payload);
      rememberProject(repoPath);
      return payload;
    } catch (caught) {
      if (expectedInput === inputIdentity.current) setError(caught instanceof Error ? caught.message : 'Could not check your edits.');
      return null;
    } finally { setCheckingChanges(false); }
  }

  async function run(mode: 'explain' | 'review', approved?: Disclosure) {
    const expectedInput = inputIdentity.current;
    setError(''); setNotice(''); setBusy(true); setActiveMode(mode);
    try {
      const changes = await checkChanges();
      if (expectedInput !== inputIdentity.current || !changes || !changes.files.length || !changes.diff.trim()) return;
      const input = { repoPath, baseRef, intent, model: selectedModel, provider };
      if (provider === 'cloud' && !approved) {
        const value = disclosure(await readResponse(await fetch('/api/review/disclosure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, mode }) })));
        if (expectedInput !== inputIdentity.current) return;
        setConsent(false); setPending(value); return;
      }
      setPending(null);
      const response = await fetch(mode === 'explain' ? '/api/review/explain' : '/api/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, disclosureDigest: approved?.digest }) });
      if (mode === 'explain') {
        const payload = explanation(await readResponse(response));
        if (expectedInput !== inputIdentity.current) return;
        setBrief(payload);
        setNotice('Explanation ready. A deeper review is available below.');
      } else {
        const payload = reviewResult(await readResponse(response));
        if (expectedInput !== inputIdentity.current) return;
        setResult(payload); setFeedback({});
        setNotice(`Review complete · ${payload.metrics.passed}/${payload.metrics.totalAgents} specialist passes`);
      }
    } catch (caught) {
      if (expectedInput === inputIdentity.current) setError(caught instanceof Error ? caught.message : 'Could not explain these changes.');
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
      `Stxic Atlas · ${result.repository}`, result.synthetic ? 'SYNTHETIC EXAMPLE — fictional code and findings' : `${result.provider === 'cloud' ? 'Cloud' : 'Local'} AI review — verify concerns against the code`,
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
      <div className={`ollama-state ${selectedStatus.available ? 'ready' : 'offline'}`}><span className="state-dot" /><Cpu size={15} /><span>{provider === 'cloud' ? cloud.available ? 'CLOUD KEY SAVED' : 'CLOUD NOT CONNECTED' : status.available ? 'LOCAL MODEL READY' : 'MODEL UNAVAILABLE'}</span></div>
    </div>

    <form className="review-setup" onSubmit={(event) => { event.preventDefault(); void checkChanges(); }}>
      <div className="review-setup-heading"><div><span className="eyebrow">CHANGE INPUT</span><h3>Choose what to review</h3></div><button type="button" className="text-action" disabled={busy} onClick={() => { setResult(structuredClone(reviewDemo)); setBrief(null); setPreview(null); setFeedback({}); setError(''); setNotice('Synthetic review loaded. No model was run.'); }}>Explore example review<ArrowRight size={14} /></button></div>
      <ProjectPicker onChoose={onRepoPathChange} disabled={busy || checkingChanges} />
      <div className="ai-choice"><label><span>Where AI runs</span><select aria-label="Where AI runs" disabled={busy || checkingChanges} value={provider} onChange={(event) => setProvider(event.target.value as AIProvider)}><option value="local">On this computer · private</option><option value="cloud">Ollama Cloud · optional</option></select></label><p>{provider === 'local' ? status.available ? 'Local AI is ready. Your source stays on this computer.' : 'Local AI needs Ollama and an installed model. You can still check changes without it.' : 'Cloud runs only after you confirm the code preview. Scanning stays local.'}</p></div>
      {provider === 'cloud' && <CloudConnection status={cloud} onStatus={setCloud} disabled={busy || checkingChanges} />}
      <div className="review-fields">
        <label className="review-path-field"><span>Project folder</span><input aria-label="Project folder" required disabled={busy || checkingChanges} value={repoPath} onChange={(event) => onRepoPathChange(event.target.value)} placeholder="C:\path\to\repository" autoComplete="off" /><small>Paste the folder address from File Explorer, not a GitHub link.</small></label>
        <label className="review-base-field"><span>Changes to check</span><select aria-label="Changes to check" disabled={busy || checkingChanges} value={comparison} onChange={(event) => { setComparison(event.target.value); setBaseRef(event.target.value === 'custom' ? 'main' : event.target.value); }}><option value="HEAD">Current edits</option><option value="HEAD^">Latest saved commit + edits</option><option value="custom">Advanced comparison</option></select><small>Current edits compares with the latest Git save.</small>{comparison === 'custom' && <input required disabled={busy || checkingChanges} aria-label="Branch or commit to compare" value={baseRef} onChange={(event) => setBaseRef(event.target.value)} placeholder="main or a commit ID" />}</label>
        {provider === 'local' && <label className="review-model-field"><span>Local AI model</span><select aria-label="AI on this computer" value={model} onChange={(event) => setModel(event.target.value)} disabled={busy || !status.models.length}>{status.models.length ? status.models.map((name) => <option value={name} key={name}>{name}</option>) : <option value="">No local AI installed</option>}</select><button className="text-action" type="button" onClick={refreshModels} disabled={checkingModels || busy}>{checkingModels ? 'Checking AI…' : 'Refresh AI list'}</button></label>}
        {provider === 'cloud' && <label className="review-model-field"><span>Cloud model</span><select aria-label="Cloud model" value={cloudModel} disabled={busy || !cloud.available} onChange={(event) => setCloudModel(event.target.value)}>{cloud.models.length ? cloud.models.map((name) => <option value={name} key={name}>{name}</option>) : <option value="">Connect a key first</option>}</select></label>}
      </div>
      <label className="review-intent-field"><span>WHAT IS THIS CHANGE FOR? <small>OPTIONAL</small></span><textarea disabled={busy || checkingChanges} value={intent} onChange={(event) => setIntent(event.target.value)} maxLength={1200} rows={2} placeholder="Example: Add discount support to checkout so returning customers see a reduced subtotal before tax." /></label>
      <div className="review-submit-row"><p><ShieldCheck size={14} /> Checking edits stays on this computer. AI uses the connection you choose.</p><button className="copy-button check-changes-button" type="button" disabled={busy || checkingChanges || !repoPath.trim()} onClick={() => { void checkChanges(); }}>{checkingChanges ? 'Checking edits…' : 'Check changes'}</button><button className="run-review-button" type="button" onClick={() => { void run('explain'); }} disabled={busy || checkingChanges || !selectedStatus.available || !selectedModel || !repoPath.trim()}>{busy ? <><LoaderCircle className="spin" size={15} />Explaining changes… {elapsed}s</> : <>Explain with AI<ArrowRight size={15} /></>}</button></div>
      {!repoPath.trim() && <p className="setup-guidance">Paste a project folder above to check your own edits, or choose Explore example review to try this without setup.</p>}
      {preview && <div className="change-preview" role="status"><strong>{preview.files.length ? `${preview.files.length} changed file${preview.files.length === 1 ? '' : 's'} found` : 'No edits found for this comparison'}</strong><p>{preview.files.length ? 'These are the files AI will inspect. This list comes from Git, not AI.' : 'If you already saved your work as a Git commit, choose Latest saved commit + edits. Otherwise edit a tracked file and check again.'}</p>{preview.files.length > 0 && <ul>{preview.files.map((file) => <li key={file.path}><code>{file.path}</code><span>+{file.additions} / −{file.deletions}</span></li>)}</ul>}{preview.diffTruncated && <p>The change is too large to review fully. AI will see only part of it.</p>}{preview.untrackedOmitted.length > 0 && <p>{preview.untrackedOmitted.length} new file(s) could not be included.</p>}<details><summary>View code changes</summary><pre>{preview.diff || 'No code changes to show.'}</pre></details></div>}
      {/\b(?:0\.5|1|1\.5|2|3)b\b/i.test(model) && <p className="setup-guidance">This is a small AI model. It runs quickly but can misread code. Inspect every concern; a larger model may give a better explanation.</p>}
      {status.available && <p className="setup-guidance">AI suggestions can be wrong, even after the final check. They help you decide what to inspect; they do not approve the change.</p>}
      {provider === 'local' && !status.available && <div className="ollama-help" role="status"><CircleHelp size={15} /><span>{status.reason} Start Ollama and install a chat model, then refresh the model list.</span><button type="button" onClick={refreshModels} disabled={checkingModels}>{checkingModels ? 'Checking…' : 'Refresh'}</button></div>}
      {error && <div className="review-error" role="alert"><CircleAlert size={15} />{error}</div>}
    </form>

    {brief && <section ref={briefSection} tabIndex={-1} className="quick-explanation" aria-label="Change explanation">
      <div className="brief-heading"><h3>Your change, explained</h3><span>{brief.repository} · {brief.provider === 'cloud' ? 'Ollama Cloud' : 'Local AI'} · {(brief.elapsedMs / 1000).toFixed(1)}s</span><button type="button" onClick={() => downloadText([`Stxic Atlas · ${brief.repository}`, `${brief.provider} AI interpretation — not a full review`, 'What changed', brief.whatChanged, 'Why it matters', brief.whyItMatters, 'What to check', ...brief.checks.map((item) => `${item.text} (${item.file}:${item.line})`), brief.partial ? 'Incomplete coverage or invalid citations: inspect the remaining diff.' : 'Verify AI claims against the code.'].join('\n'), 'stxic-explanation.txt')}>Save explanation</button></div>
      <h4>What changed?</h4><p>{brief.whatChanged}</p><h4>Why does it matter?</h4><p>{brief.whyItMatters}</p><h4>What should I check?</h4>
      {brief.checks.length ? <ul>{brief.checks.map((item) => <li key={item.file + item.line + item.text}><p>{item.text}</p><details><summary>{item.file}:{item.line} · inspect supporting code</summary><pre>{diffExcerpt(brief.diff, item.file, item.line).map((row) => `${row.number ?? ''} ${row.marker} ${row.text}`).join('\n')}</pre></details></li>)}</ul> : <p>No checks with valid changed-line citations were returned. Inspect the diff and run the project's tests.</p>}
      <details className="review-diff"><summary>Inspect the explanation’s exact code changes</summary><pre>{brief.diff}</pre></details><p className="setup-guidance">{brief.partial ? 'Incomplete explanation: some changes or citations could not be included. ' : ''}AI interpretation can be wrong. This explanation does not approve the change.</p>
    </section>}
    <div className="deeper-action"><div><h3>Need a deeper check?</h3><p>Five reviewers look for possible problems, then a final reviewer checks their evidence.</p></div><button type="button" disabled={busy || checkingChanges || !selectedStatus.available || !selectedModel || !repoPath.trim()} onClick={() => { void run('review'); }}>Run deeper review</button></div>
    <div className={`swarm-layout ${!result && (!busy || activeMode === 'explain') ? 'explanation-first' : ''}`}>
      {(result || busy && activeMode === 'review') && <aside className="agent-rail" aria-label="Specialist review agents">
        <div className="rail-head"><span>REVIEWERS</span><span>WEIGHT</span></div>
        {(result?.agents ?? [
          { id: 'security', name: 'Security', weight: 1.4, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
          { id: 'architecture', name: 'Architecture', weight: 1.2, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
          { id: 'quality', name: 'Quality', weight: 1, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
          { id: 'tests', name: 'Tests', weight: 1.1, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
          { id: 'performance', name: 'Performance', weight: 1, status: 'failed', findings: 0, elapsedMs: 0, promptTokens: 0, responseTokens: 0 },
        ]).map((agent, index) => <div className={`agent-card ${agent.status === 'complete' ? 'agent-done' : ''}`} key={agent.id}>
          <span className="agent-index">0{index + 1}</span><div className="agent-copy"><strong>{agent.name}</strong><small>{agentDescriptions[agent.id]}</small></div><span className="agent-weight">{agent.weight.toFixed(1)}×</span>
          {busy && activeMode === 'review' ? <LoaderCircle className="spin agent-status-pending" size={15} /> : agent.status === 'complete' ? <Check className="agent-status-done" size={16} /> : result ? <CircleAlert className="agent-status-error" size={15} /> : <span className="agent-status-idle" />}
          {result && <div className="agent-result">{agent.status === 'complete' ? `${agent.findings} finding${agent.findings === 1 ? '' : 's'} · ${Math.round(agent.elapsedMs / 1000)}s · ${(agent.promptTokens + agent.responseTokens).toLocaleString()} tokens` : agent.error}</div>}
        </div>)}
        <div className="chair-card"><div className="chair-icon"><MessageSquareText size={15} /></div><div><strong>Final reviewer</strong><small>{result?.chair.status === 'complete' ? result.findings.length ? 'Summarized diff and challenged findings' : 'Summarized diff; no findings to challenge' : result?.chair.status === 'failed' ? 'Debate pass unavailable' : 'Checks the proposed concerns against the code'}</small></div>{result?.chair.status === 'complete' ? <Check size={15} /> : <span className="agent-status-idle" />}</div>
        <p className="agent-rail-note">Agent weights start from their review role. Your local feedback nudges them over time.</p>
      </aside>}

      <div className="review-report">
        {!result && !brief && !busy && <div className="review-empty"><div className="empty-glyph"><FileDiff size={21} /></div><span className="eyebrow">READY WHEN YOU ARE</span><h3>Understand an edit before approving it.</h3><p>Choose your project folder and click Check changes. Explain with AI gives a short explanation and suggested checks. Run deeper review when you want more detail. You can also explore a fictional example without setting anything up.</p><div className="empty-evidence-note"><ShieldCheck size={14} />Git facts stay separate from AI interpretation. Cloud use requires your confirmation.</div></div>}
        {busy && <div className="review-running" role="status"><LoaderCircle className="spin" size={24} /><div><strong>AI is reading your changes · {elapsed}s elapsed</strong><span>{activeMode === 'explain' ? 'One AI pass explains the change. This is not a full review.' : 'Five checks run, followed by a final review. This can take several minutes.'} You can switch to File connections and come back.</span></div></div>}
        {result && <>
          {result.synthetic && <div className="demo-banner" role="status"><strong>Synthetic review example.</strong><span>Diff, findings, votes, and agreement are illustrative. No model was run; feedback is temporary.</span></div>}
          <div className={`decision-strip decision-${result.decision}`}><div className="decision-label"><span className="eyebrow">REVIEW RESULT</span><strong>{decisionLabel(result.decision)}</strong></div><div className="decision-stat"><strong>{result.findings.length ? `${Math.round(result.confidence * 100)}%` : '—'}</strong><span>reviewer agreement</span></div><div className="decision-files"><FileDiff size={17} /><span><strong>{result.files.length} files</strong><small><i>+{additions}</i> / <b>−{deletions}</b></small></span></div></div>
          {result.decision === 'partial-review' && <div className="partial-note" role="status"><CircleAlert size={14} /><span>Incomplete review · {result.metrics.passed}/{result.metrics.totalAgents} specialists completed. {result.chair.status === 'failed' ? `Final check incomplete: ${result.chair.error ?? 'Unavailable'}. ` : ''}{result.diffTruncated ? 'The diff exceeded the review limit. ' : ''}{result.untrackedOmitted.length > 0 ? 'Some untracked files were omitted. ' : ''}Inspect the available findings and remaining changes.</span></div>}
          <div className="result-toolbar"><span>{result.synthetic ? 'Synthetic example' : result.provider === 'cloud' ? 'Cloud AI' : 'Local AI'} · {result.repository} <i>/</i> {result.branch} <i>against</i> {result.baseRef}</span><div className="report-actions"><button type="button" onClick={downloadReadableReport}><ArrowDownToLine size={13} />Save readable report</button><button type="button" onClick={downloadReport}>Export JSON</button></div></div>
          <div className="change-brief"><div><span>{result.synthetic ? 'WHAT CHANGED · SYNTHETIC EXAMPLE' : result.changeSummarySource === 'model' ? 'WHAT CHANGED · AI INTERPRETATION' : 'WHAT CHANGED · GIT COUNTS'}</span><p>{result.changeSummary}</p></div><div><span>{result.synthetic ? 'WHY · ILLUSTRATIVE INTENT' : result.purposeSource === 'user' ? 'WHY · YOUR NOTE' : result.purposeSource === 'git' ? 'WHY · GIT COMMIT CONTEXT' : 'WHY · NOT PROVIDED'}</span><p>{result.purposeSummary}</p>{result.purposeSource === 'user' && result.commitMessages.length > 0 && <small>Recent branch commit subjects: {result.commitMessages.join(' · ')}</small>}</div></div>
          {result.contextFiles.length > 0 && <div className="repo-context-note"><span>PROJECT DOCS INCLUDED</span><code>{result.contextFiles.join(' · ')}</code></div>}
          {result.findings.length ? <div className="review-findings">{result.findings.map((finding, index) => <FindingCard key={finding.id} finding={finding} diff={result.diff} index={index} feedback={feedback[finding.id]} saving={Boolean(saving)} onFeedback={rateFinding} />)}</div> : <div className="clear-review"><Check size={18} /><div><strong>{result.decision === 'looks-clear' ? 'No findings from this review.' : 'No findings were returned by the completed passes.'}</strong><span>A clean review is not proof that the change is bug-free. Check the diff and run your test suite.</span></div></div>}
          <details className="review-diff"><summary><FileDiff size={14} />Inspect exact Git diff <span>{result.files.length} files · {result.diff.length.toLocaleString()} chars{result.diffTruncated ? ' · truncated for review' : ''}</span></summary><pre>{result.diff}</pre></details>
          {result.untrackedOmitted.length > 0 && <div className="partial-note"><CircleHelp size={14} />Some untracked files were not included: {result.untrackedOmitted.slice(0, 5).join(', ')}</div>}
          <div className="review-metrics"><div><Clock3 size={14} /><span>REVIEW TIME</span><strong>{(result.elapsedMs / 1000).toFixed(1)}s</strong></div><div><Check size={14} /><span>PASSES</span><strong>{result.metrics.passed}/{result.metrics.totalAgents}</strong></div><div><Cpu size={14} /><span>TOKEN USAGE</span><strong>{result.metrics.totalTokens.toLocaleString()}</strong></div><div><Database size={14} /><span>FEEDBACK STORED LOCALLY</span><strong>{result.metrics.usefulFeedback + result.metrics.incorrectFeedback}</strong></div></div>
        </>}
      </div>
    </div>
    {notice && <div className="review-notice" role="status"><Check size={14} />{notice}</div>}
    <dialog ref={cloudDialog} className="cloud-dialog" aria-labelledby="cloud-dialog-title" onCancel={() => setPending(null)} onClose={() => setPending(null)}>
      {pending && <><h2 id="cloud-dialog-title">Send this change to cloud AI?</h2><p>Destination: Ollama Cloud · model: {pending.model}. {pending.mode === 'explain' ? 'One explanation request.' : 'Five specialist requests and one final review. The final request also includes generated findings.'} Your account's usage limits and charges apply.</p><p>This is the exact repository context included in the requests, alongside Stxic's review instructions. It may contain private code or secrets. Nothing has been sent yet.</p><pre tabIndex={0}>{pending.content}</pre><label className="consent-label"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I have inspected this context and agree to send it to Ollama Cloud.</label><div className="dialog-actions"><button type="button" onClick={() => setPending(null)}>Cancel</button><button type="button" disabled={!consent || busy} onClick={() => { void run(pending.mode, pending); }}>Send and {pending.mode === 'explain' ? 'explain' : 'review'}</button></div></>}
    </dialog>
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


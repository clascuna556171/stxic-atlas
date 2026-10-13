import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Check, CircleHelp, Command, Download, FileCode2, GitBranch, LoaderCircle, Map, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import type { AtlasData, AtlasNode } from './types';
import ReviewPanel from './ReviewPanel';
import Logo from './Logo';
import AppearanceControl from './AppearanceControl';
import UseGuide from './UseGuide';
import ProjectPicker, { rememberProject } from './ProjectPicker';
import { downloadText } from './download';
import { atlasData, readResponse } from './api';
import { applyAppearance, readAppearance, type Appearance } from './theme';

  type SignalView = 'all' | 'dependencies' | 'history';

function App() {
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);
  useEffect(() => {
    applyAppearance(appearance);
    try { localStorage.setItem('stxic-atlas-appearance', appearance); } catch { /* Optional local preference. */ }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyAppearance(appearance);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [appearance]);
  const [data, setData] = useState<AtlasData | null>(null);
  const [selectedId, setSelectedId] = useState('ledger');
  const [signalView, setSignalView] = useState<SignalView>('all');
  const [repoPath, setRepoPath] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<'impact' | 'review'>('impact');
  const helpDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = helpDialog.current;
    if (showHelp && dialog && !dialog.open) dialog.showModal();
    else if (!showHelp && dialog?.open) dialog.close();
  }, [showHelp]);

  useEffect(() => {
    void loadDemo();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      document.querySelector<HTMLInputElement>('.search-box input')?.focus();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const selected = data?.nodes.find((node) => node.id === selectedId) ?? data?.nodes[0];
  const connected = useMemo(() => {
    if (!data || !selected) return [];
    return data.edges.filter((edge) => (edge.from === selected.id || edge.to === selected.id) && (signalView === 'all' || (signalView === 'history' ? edge.kind === 'cochange' : edge.kind !== 'cochange')));
  }, [data, selected, signalView]);
  const visibleNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.filter((node) => node.label.toLowerCase().includes(search.toLowerCase()) || node.group.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  async function analyze(event?: FormEvent) {
    event?.preventDefault();
    const folderPath = repoPath.trim().replace(/^"(.*)"$/, '$1');
    if (!folderPath) {
      setError('Paste the address of your project folder from File Explorer.');
      document.getElementById('repo-path')?.focus();
      return;
    }
    setError(''); setBusy(true);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repoPath: folderPath }) });
      const result = atlasData(await readResponse(response));
      setData(result);
      setRepoPath(result.repoPath ?? folderPath);
      rememberProject(result.repoPath ?? folderPath);
      setSelectedId(result.nodes[0]?.id ?? '');
      setNotice(`Analysis ready · ${result.summary.files} source files indexed`);
      setSearch('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not analyze this repository.');
    } finally { setBusy(false); }
  }

  async function loadDemo() {
    setBusy(true); setError('');
    try {
      const result = atlasData(await readResponse(await fetch('/api/demo')));
      setData(result); setSelectedId('ledger'); setSearch(''); setSignalView('all'); setRepoPath(''); setNotice('Sample repository loaded');
    } catch { setError('Could not reach the local analysis service. Start the app, then retry.'); }
    finally { setBusy(false); }
  }
  function useDemo() { void loadDemo(); }

  function downloadReport() {
    if (!data || !selected) return;
    const related = data.edges.filter((edge) => edge.from === selected.id || edge.to === selected.id);
    const report = {
      title: `Change impact: ${selected.label}`,
      repository: data.repository,
      generatedAt: new Date().toISOString(),
      data: data.synthetic ? 'Synthetic example' : 'Local Git history',
      target: selected.id,
      signals: related.map((edge) => ({ file: edge.from === selected.id ? edge.to : edge.from, relationship: edge.kind, evidence: edge.evidence })),
      findings: data.findings.filter((finding) => related.some((edge) => edge.from === finding.node || edge.to === finding.node)),
    };
    downloadText(JSON.stringify(report, null, 2), `change-impact-${selected.label}.json`, 'application/json');
    setNotice('Evidence report downloaded');
  }

  async function copySummary() {
    if (!data || !selected) return;
    const signals = connected.map((edge) => `- ${edge.from === selected.id ? edge.to : edge.from}: ${edge.evidence}`).join('\n');
    const text = `Change impact · ${data.repository}\nTarget: ${selected.id}\n${data.synthetic ? 'Synthetic sample evidence' : 'Local repository evidence'}\n\nRelated files\n${signals || '- No related signals found'}`;
    try { await navigator.clipboard.writeText(text); }
    catch { setNotice('Clipboard unavailable. Use Export evidence to save the report.'); return; }
    setCopied(true); setNotice('Impact summary copied'); window.setTimeout(() => setCopied(false), 1800);
  }

  if (!data) return <main className="loading-screen"><div className="loading-mark"><Map size={24} /></div>{error ? <><p role="alert">{error}</p><button className="scan-button" onClick={useDemo} disabled={busy}>Retry connection</button></> : <><LoaderCircle className="spin" size={20} /><span>Opening the atlas…</span></>}</main>;
  const target = selected as AtlasNode;
  const relatedIds = new Set(connected.flatMap((edge) => [edge.from, edge.to]));
  const mapEdges = data.edges.filter((edge) => {
    if (signalView === 'dependencies') return edge.kind === 'imports' || edge.kind === 'contains';
    if (signalView === 'history') return edge.kind === 'cochange';
    return true;
  });
  const findings = data.findings.filter((finding) => !selected || finding.node === selected.id || connected.some((edge) => edge.from === finding.node || edge.to === finding.node));
  const selectedIncident = new Set(connected.map((edge) => edge.from === target.id ? edge.to : edge.from)).size;
  const reviewRepoName = repoPath.trim().replace(/[\\/]+$/, '').split(/[\\/]/).at(-1);

  return <div className="app-shell">
    <a className="skip-link" href="#top">Skip to workspace</a>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Stxic Atlas home" onClick={() => setActiveWorkspace('impact')}>
        <Logo />
        <span className="brand-name">stxic<span>atlas</span></span>
      </a>
      <div className="top-divider" />
      <div className="repo-switcher"><GitBranch size={15} /><span>{activeWorkspace === 'impact' ? data.repository : reviewRepoName || 'Choose local repository'}</span></div>
      <div className="top-spacer" />
      <span className="local-pill"><span className="local-dot" />LOCAL WORKSPACE</span>
      <AppearanceControl value={appearance} onChange={setAppearance} />
      <button className="icon-button help-button" aria-label="About Stxic Atlas" onClick={() => setShowHelp(true)}><CircleHelp size={18} /></button>
    </header>

    <main id="top" className="main-wrap" tabIndex={-1}>
      <section className="page-intro">
        <div className="intro-title-group">
          <div className="title-line"><h1>{activeWorkspace === 'impact' ? 'Understand your project' : 'Explain your changes'}</h1></div>
          <p>{activeWorkspace === 'impact' ? 'See which files depend on each other, so you know what else to check.' : 'See what you edited, get a plain explanation, then check further if needed.'}</p>
        </div>
        {activeWorkspace === 'impact' && <form className="repo-form" onSubmit={analyze}>
          <label htmlFor="repo-path" className="sr-only">Local Git repository folder path</label>
          <ProjectPicker onChoose={setRepoPath} disabled={busy} /><div className="repo-input-wrap"><Command size={15} /><input id="repo-path" value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="Paste a local repository path" autoComplete="off" /><button type="submit" className="scan-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <><span>Scan project</span><ArrowRight size={15} /></>}</button></div>
          <p className="folder-hint">Open your project in File Explorer and copy the folder address. It must have Git history.</p>
          {error && <div className="form-error" role="alert">{error}</div>}
        </form>}
      </section>

      {activeWorkspace === 'impact' && <><div className="repo-meta-row">
        <div className="repo-meta"><span className="repo-stamp">{data.synthetic ? 'DEMO REPOSITORY' : 'LOCAL REPOSITORY'}</span><span className="meta-slash">/</span><span className="branch-label"><GitBranch size={13} />{data.branch}</span><span className="meta-slash">/</span><span className="scanned-at">Scanned {Number.isNaN(Date.parse(data.scannedAt)) ? data.scannedAt : new Date(data.scannedAt).toLocaleString()}</span></div>
        <div className="meta-actions">{!data.synthetic && <button className="text-action" onClick={useDemo} disabled={busy}>Use sample</button>}<button className="text-action" onClick={copySummary}><span>{copied ? <Check size={14} /> : <FileCode2 size={14} />}</span>{copied ? 'Copied' : 'Copy summary'}</button><button className="text-action" onClick={downloadReport}><Download size={14} />Export evidence</button></div>
      </div>
      {data.synthetic && <div className="demo-banner"><span className="demo-asterisk">✳</span><span><strong>Using a synthetic sample.</strong> Findings below are illustrative, not from a real company or codebase.</span><button onClick={useDemo}>Reset sample</button></div>}</>}

      <nav className="workspace-tabs" aria-label="Stxic Atlas workspace">
        <button className={activeWorkspace === 'impact' ? 'active' : ''} aria-current={activeWorkspace === 'impact' ? 'page' : undefined} onClick={() => setActiveWorkspace('impact')}><Map size={14} />File connections</button>
        <button className={activeWorkspace === 'review' ? 'active' : ''} aria-current={activeWorkspace === 'review' ? 'page' : undefined} onClick={() => setActiveWorkspace('review')}><ShieldCheck size={14} />AI change review</button>
      </nav>
      <UseGuide />

      {activeWorkspace === 'impact' ? <>
      <div className="getting-started"><div><strong>{data.synthetic ? 'Start with the example' : 'Your project is ready'}</strong><p>{data.synthetic ? 'Click a file below to see its connections. The example is fictional and needs no setup.' : 'Choose a file below, or review your recent edits with AI.'}</p></div><button className="copy-button" onClick={() => setActiveWorkspace('review')}>{data.synthetic ? 'Open change review' : 'Review my changes'}<ArrowRight size={16} /></button></div>

      <section className="stats-strip" aria-label="Repository overview">
        <div className="stat-cell"><span className="stat-label">SAVED CHANGES</span><strong>{data.summary.commits.toLocaleString()}</strong><span className="stat-note">recent history examined</span></div>
        <div className="stat-cell"><span className="stat-label">SOURCE FILES</span><strong>{data.summary.files}</strong><span className="stat-note">tracked in this view</span></div>
        <div className="stat-cell"><span className="stat-label">CONTRIBUTORS</span><strong>{data.summary.contributors}</strong><span className="stat-note">in analyzed history</span></div>
        <div className="stat-cell stat-risk"><span className="stat-label">FILES TO CHECK</span><strong>{selectedIncident + 1} files</strong><span className="stat-note">{selectedIncident} connected evidence links</span></div>
      </section>

      <section className="atlas-section" aria-labelledby="atlas-heading">
        <div className="section-head">
          <div><h2 id="atlas-heading">File connections</h2><p>Choose a file. Solid lines show which files it uses; dashed lines show shared change history.</p></div>
          <div className="map-controls"><div className="view-tabs" role="group" aria-label="Signals to show">
            {(['all', 'dependencies', 'history'] as const).map((view) => <button key={view} aria-pressed={signalView === view} className={signalView === view ? 'active' : ''} onClick={() => setSignalView(view)}>{view === 'all' ? 'All signals' : view === 'dependencies' ? 'Uses other files' : 'Changed together'}</button>)}
          </div><label className="search-box"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter files" placeholder="Find a file" /><kbd>/</kbd></label></div>
        </div>

        <div className="atlas-board">
          <div className="board-axis axis-top"><span>FILE RELATIONSHIPS</span><span>SELECT A NODE TO INSPECT EVIDENCE</span></div>
          <div className="graph-viewport">
            <svg className="graph-svg" viewBox="0 0 900 540" role="group" aria-label="Interactive code impact map. Select a file to inspect its connections.">
              <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path className="graph-grid" d="M 24 0 L 0 0 0 24" fill="none" strokeWidth=".55" opacity=".55" /></pattern><marker id="arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path className="graph-arrow" d="M0 0 L8 4 L0 8 z" /></marker></defs>
              <rect x="0" y="0" width="900" height="540" fill="url(#grid)" />
              {mapEdges.map((edge) => {
                const from = data.nodes.find((node) => node.id === edge.from); const to = data.nodes.find((node) => node.id === edge.to); if (!from || !to || !visibleNodes.includes(from) || !visibleNodes.includes(to)) return null;
                const active = edge.from === selected?.id || edge.to === selected?.id;
                const quiet = selected && !active;
                const midX = (from.x + to.x) / 2; const midY = (from.y + to.y) / 2 - 10;
                return <g key={`${edge.from}-${edge.to}`} className={quiet ? 'edge quiet' : 'edge'}>
                  <path className={`edge-line ${edge.kind} ${active ? 'active' : ''}`} d={`M ${from.x + 76} ${from.y + 23} C ${midX} ${midY}, ${midX} ${midY}, ${to.x + 76} ${to.y + 23}`} strokeWidth={active ? 2.3 : 1.25} markerEnd={edge.kind !== 'cochange' ? 'url(#arrow)' : undefined} />
                  {active && <g className="edge-label" transform={`translate(${midX - 62},${midY - 5})`}><rect width="124" height="20" rx="2" /><text x="62" y="13" textAnchor="middle">{edge.kind === 'imports' ? 'IMPORT' : edge.kind === 'contains' ? 'SOURCE FOLDER' : `${edge.evidence.match(/\d+/)?.[0] ?? 'PAST'} JOINT COMMITS`}</text></g>}
                </g>;
              })}
              {visibleNodes.map((node) => {
                const isTarget = node.id === selected?.id; const isRelated = relatedIds.has(node.id); const dim = !!selected && !isTarget && !isRelated;
                return <g key={node.id} className={`map-node ${isTarget ? 'is-target' : ''} ${isRelated ? 'is-related' : ''} ${dim ? 'is-dim' : ''}`} transform={`translate(${node.x}, ${node.y})`} role="button" tabIndex={0} aria-label={`${node.id}, ${node.commits} commits`} aria-pressed={isTarget} onClick={() => setSelectedId(node.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(node.id); } }}>
                  <rect className="node-plate" width="154" height="48" rx="2" />
                  <path className="node-corner" d="M0 12V0h12" />
                  {isTarget && <path className="target-cap" d="M0 0h154v4H0z" />}
                  <text className="node-kind" x="10" y="18">{node.kind === 'test' ? 'TEST FILE' : node.kind === 'service' ? 'SERVICE' : node.kind === 'module' ? 'MODULE' : 'SOURCE FILE'}</text>
                  <text className="node-name" x="10" y="36">{node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label}</text>
                  <circle className="node-dot" cx="141" cy="14" r="3" />
                </g>;
              })}
            </svg>
            {visibleNodes.length === 0 && <div className="empty-map">No tracked files match “{search}”. <button onClick={() => setSearch('')}>Clear search</button></div>}
          </div>
          <div className="board-footer"><div className="map-legend"><span><i className="legend-dot selected-dot" />selected</span><span><i className="legend-line import-line" />structure & imports</span><span><i className="legend-line history-line" />historical co-change</span></div><span className="scale-note">SIGNALS ARE EVIDENCE, NOT A GUARANTEE</span></div>
        </div>
      </section>

      <section className="detail-grid">
        <article className="detail-panel target-panel">
          <div className="panel-kicker"><span className="panel-index">A</span><span>FOCUS FILE</span><span className="panel-rule" /></div>
          <div className="target-title"><div className="file-glyph"><FileCode2 size={18} /></div><div><h3>{selected?.label}</h3><p>{selected?.group} <span>·</span> {selected?.commits} commits in history</p></div></div>
          <div className="focus-stat-row"><div><span>Change frequency</span><b>{selected?.commits ?? 0} commits</b></div><div><span>Connected signals</span><b>{selectedIncident} files</b></div></div>
          <div className="selected-note"><span className="note-marker">i</span><p>{selected?.kind === 'test' ? 'A test file helps show which behavior has known coverage. A missing link does not prove a behavior is untested.' : 'Impact signals show direct imports and files that changed alongside this target. Use them as a review guide, not as a prediction.'}</p></div>
          <button className="copy-button" onClick={copySummary}><FileCode2 size={15} />{copied ? 'Summary copied' : 'Copy review summary'}<ArrowRight size={14} /></button>
        </article>

        <article className="detail-panel evidence-panel">
          <div className="panel-kicker"><span className="panel-index">B</span><span>RELATED EVIDENCE</span><span className="panel-rule" /><span className="evidence-count">{connected.length} SIGNALS</span></div>
          <div className="evidence-list">
            {connected.length ? connected.map((edge) => {
              const otherId = edge.from === target.id ? edge.to : edge.from; const other = data.nodes.find((node) => node.id === otherId);
              return <button className="evidence-row" key={`${edge.from}-${edge.to}`} onClick={() => { setSearch(''); setSelectedId(otherId); }}>
                <span className={`evidence-mark ${edge.kind}`} aria-hidden="true">{edge.kind === 'cochange' ? <Activity size={13} /> : <ArrowDownRight size={14} />}</span>
                <span className="evidence-copy"><strong>{other?.id ?? otherId}</strong><small>{edge.evidence}</small></span>
                <span className={`signal-tag ${edge.kind}`}>{edge.kind === 'imports' ? 'IMPORT' : edge.kind === 'contains' ? 'CONTAINS' : 'HISTORY'}</span>
                <ArrowRight className="row-arrow" size={14} />
              </button>;
            }) : <div className="empty-evidence">No connections for this file with the selected filter. Try All signals or another file.</div>}
          </div>
          <div className="evidence-footnote"><ShieldCheck size={14} /><span>Every link can be traced to code structure or a shared commit.</span></div>
        </article>
      </section>

      <section className="signals-section">
        <div className="section-head signals-heading"><div><h2>Review signals</h2><p>Evidence to bring into your next code review.</p></div><span className="signals-count">{findings.length} FINDINGS IN FOCUS</span></div>
        <div className="signals-table">
          <div className="table-head"><span>OBSERVATION</span><span>SUPPORTING EVIDENCE</span><span>OPEN</span></div>
          {findings.length ? findings.map((finding, index) => <button className="finding-row" key={`${finding.node}-${index}`} onClick={() => { setSearch(''); setSelectedId(finding.node); }}>
            <span className="finding-main"><span className={`finding-severity ${finding.severity}`}>{finding.severity === 'high' ? <TriangleAlert size={14} /> : finding.severity === 'test' ? <Check size={14} /> : <Activity size={14} />}</span><span><strong>{finding.title}</strong><small>{finding.detail}</small></span></span>
            <span className="finding-evidence">{finding.evidence}</span><ArrowUpRight className="finding-open" size={15} />
          </button>) : <div className="table-empty">Choose another file or switch to all signals to see related review evidence.</div>}
        </div>
      </section>

      {data.suggestedChecks.length > 0 && <section className="check-section">
        <div className="check-title"><span className="panel-index">C</span><div><h2>Suggested checks</h2><p>Practical follow-ups grounded in the same evidence.</p></div></div>
        <div className="check-list">{data.suggestedChecks.map((check) => <div className="check-row" key={check.path}><span className="check-box" aria-hidden="true"><CircleHelp size={12} /></span><div><strong>{check.label}</strong><small>{check.path} <span>·</span> {check.reason}</small></div><ArrowRight size={14} /></div>)}</div>
      </section>}

      <section className="connect-repo"><div className="connect-graphic" aria-hidden="true"><span /><span /><span /><span /><i /><i /></div><div><h2>Use your own project</h2><p>Paste your project folder above to see real file connections. A Git project is a folder that tracks saved code changes.</p></div><form className="connect-form" onSubmit={analyze}><label className="sr-only" htmlFor="repo-path-bottom">Local Git repository folder path</label><input id="repo-path-bottom" value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="C:\path\to\your\repository" /><button type="submit" disabled={busy}>{busy ? 'Scanning…' : 'Scan project'}<ArrowRight size={15} /></button></form></section>
      </> : null}
      <div hidden={activeWorkspace !== 'review'}><ReviewPanel repoPath={repoPath} onRepoPathChange={setRepoPath} /></div>

      <footer className="footer"><div className="footer-mark"><Logo />STXIC ATLAS</div><span>Scanning stays local <i>·</i> Cloud AI is your choice.</span><span className="footer-build">Built to make the evidence visible.</span></footer>
    </main>

    {notice && <div className="toast" role="status"><Check size={15} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14} /></button></div>}
    <dialog ref={helpDialog} className="help-sheet" aria-labelledby="help-title" onCancel={() => setShowHelp(false)} onClose={() => setShowHelp(false)}><button className="close-sheet" aria-label="Close" onClick={() => setShowHelp(false)}><X size={17} /></button><h2 id="help-title">Understand a project change.</h2><p>Stxic reads the saved history and code in an app or website project. It helps you see what changed and what else to check before you approve it.</p><ol className="help-steps"><li>Choose your project folder with Browse folders.</li><li>Open AI change review and click Check changes. Already saved your work? Choose Latest saved version.</li><li>Explain with AI gives a short explanation. Run deeper review checks for possible problems.</li></ol><p>Git means your project’s saved-version history. If a folder has no Git history, ask its developer for the project checkout. You can try Explore example review without setup.</p><p>File connections shows which files use each other or have changed together. Links are clues, not proof of a problem. AI answers can be wrong.</p><p>Light and Dark change the screen colors. Auto follows your device. Local AI keeps code on this computer; cloud AI asks before sending it.</p><button className="guide-done" onClick={() => setShowHelp(false)}>Got it</button></dialog>
  </div>;
}

export default App;


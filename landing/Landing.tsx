import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Copy, FileCode2, GitBranch, GitCommitHorizontal, Github, HardDrive, Minus, Plus, ShieldCheck } from 'lucide-react';
import Logo from '../src/Logo';
import AppearanceControl from '../src/AppearanceControl';
import { applyAppearance, readAppearance, type Appearance } from '../src/theme';
import { reviewDemo } from '../src/reviewDemo';

const repository = 'https://github.com/clascuna556171/stxic-atlas';
const installCommands = `git clone ${repository}.git\ncd stxic-atlas\nnpm ci\nnpm run dev`;
const files = [
  { id: 'cart', name: 'cart.ts', path: 'checkout/cart.ts', kind: 'CHECKOUT', x: 5, y: 11 },
  { id: 'totals', name: 'totals.ts', path: 'checkout/totals.ts', kind: 'CALCULATION', x: 37, y: 39 },
  { id: 'money', name: 'money.ts', path: 'shared/money.ts', kind: 'SHARED', x: 5, y: 70 },
  { id: 'test', name: 'totals.test.ts', path: 'tests/totals.test.ts', kind: 'TEST', x: 69, y: 11 },
  { id: 'receipt', name: 'receipt.ts', path: 'billing/receipt.ts', kind: 'BILLING', x: 69, y: 70 },
];
const edges = [
  { from: 'cart', to: 'totals', kind: 'imports', evidence: 'cart.ts imports the total calculation.', curve: 'M103 61 C103 150 282 70 282 156' },
  { from: 'totals', to: 'money', kind: 'imports', evidence: 'totals.ts imports the money utility.', curve: 'M282 156 C282 230 103 180 103 262' },
  { from: 'totals', to: 'test', kind: 'history', evidence: 'These files changed together in 8 example commits.', curve: 'M282 156 C282 70 461 150 461 61' },
  { from: 'receipt', to: 'totals', kind: 'imports', evidence: 'receipt.ts imports the total calculation.', curve: 'M461 262 C461 180 282 230 282 156' },
];
type Signal = 'all' | 'imports' | 'history';

function ExampleMap() {
  const [selected, setSelected] = useState('totals');
  const [signal, setSignal] = useState<Signal>('all');
  const current = files.find((file) => file.id === selected)!;
  const shown = edges.filter((edge) => signal === 'all' || edge.kind === signal);
  const related = shown.filter((edge) => edge.from === selected || edge.to === selected);
  const linked = new Set(related.flatMap((edge) => [edge.from, edge.to]));

  return <section className="example-map" id="example" aria-labelledby="example-title">
    <div className="example-heading"><span id="example-title"><GitBranch size={15} aria-hidden="true" />File connections</span><span className="sample-label">Synthetic example</span></div>
    <div className="example-tools"><span>Choose a file to follow its connections.</span><div className="signal-controls" role="group" aria-label="Example connection type">{(['all', 'imports', 'history'] as const).map((type) => <button key={type} aria-pressed={signal === type} onClick={() => setSignal(type)}>{type === 'all' ? 'All' : type === 'imports' ? 'Imports' : 'History'}</button>)}</div></div>
    <div className="connection-field" role="group" aria-label="Synthetic file connection map">
      <svg className="connections" viewBox="0 0 560 340" preserveAspectRatio="none" aria-hidden="true">
        {shown.map((edge) => <path key={`${edge.kind}-${edge.from}-${edge.to}`} d={edge.curve} className={`${edge.kind} ${related.includes(edge) ? 'connected' : 'quiet'}`} />)}
      </svg>
      {files.map((file) => <button key={file.id} className={`file-node ${selected === file.id ? 'selected' : ''} ${linked.has(file.id) ? '' : 'unconnected'}`} style={{ left: `${file.x}%`, top: `${file.y}%` }} aria-label={`Select ${file.path}`} aria-pressed={selected === file.id} onClick={() => setSelected(file.id)}><small>{file.kind}</small><span><FileCode2 size={14} aria-hidden="true" /><span>{file.id === 'test' ? <>totals.<wbr />test.ts</> : file.name}</span></span></button>)}
      <span className="field-caption">Illustrative checkout project</span>
    </div>
    <div className="example-legend"><span><i className="import-line" />Source import</span><span><i className="history-line" />Changed together</span></div>
    <div className="connection-evidence" aria-live="polite" aria-atomic="true">
      <div className="evidence-title"><code>{current.path}</code><span>{related.length} connection{related.length === 1 ? '' : 's'}</span></div>
      {related.length ? <ul>{related.map((edge) => {
        const other = files.find((file) => file.id === (edge.from === selected ? edge.to : edge.from))!;
        return <li key={`${edge.kind}-${edge.from}-${edge.to}`}><button onClick={() => setSelected(other.id)} aria-label={`Follow connection to ${other.path}`}><span>{edge.kind === 'imports' ? <ArrowUpRight size={14} aria-hidden="true" /> : <GitCommitHorizontal size={14} aria-hidden="true" />}<code>{other.name}</code></span><span>{edge.kind === 'imports' ? 'Source import' : '8 example commits'}<ArrowRight size={13} aria-hidden="true" /></span></button><p>{edge.evidence}</p></li>;
      })}</ul> : <p className="empty-connections">No {signal === 'all' ? '' : `${signal} `}connections in this example. Choose All or another file.</p>}
    </div>
    <p className="example-note">Fictional files and history. Connections suggest where to look; they don’t predict a bug.</p>
  </section>;
}

function ReviewExample() {
  const [view, setView] = useState<'explanation' | 'evidence'>('explanation');
  const finding = reviewDemo.findings[0];
  return <div className="review-example">
    <div className="review-example-heading"><span><FileCode2 size={16} aria-hidden="true" /><code>checkout/totals.ts</code></span><span className="sample-label">Synthetic walkthrough · no AI run</span></div>
    <div className="review-switch" role="group" aria-label="Review example view"><button aria-pressed={view === 'explanation'} onClick={() => setView('explanation')}>Plain explanation</button><button aria-pressed={view === 'evidence'} onClick={() => setView('evidence')}>Inspect the diff<ArrowUpRight size={14} aria-hidden="true" /></button></div>
    {view === 'explanation' ? <div className="example-explanation">
      <p className="example-intent"><span>Stated intent</span>Apply discounts before calculating tax.</p>
      <h3>{finding.title}</h3><p>{reviewDemo.changeSummary}</p>
      <div className="calculation-example" aria-label="Synthetic calculation comparison"><div><span>Example code returns</span><strong>90</strong></div><ArrowRight size={22} aria-hidden="true" /><div><span>Stated intent expects</span><strong>88</strong></div><p>100 subtotal − 20 discount, with 10% tax.</p></div>
      <p className="citation"><GitBranch size={14} aria-hidden="true" />Supporting change: <code>checkout/totals.ts:4</code></p>
    </div> : <div className="example-diff"><p>Exact synthetic diff cited by the example finding. Added lines have a +; removed lines have a −.</p><pre tabIndex={0} aria-label="Synthetic checkout change diff"><code>{reviewDemo.diff.split('\n').map((line, index) => <span key={index} className={line.startsWith('+') && !line.startsWith('+++') ? 'added' : line.startsWith('-') && !line.startsWith('---') ? 'removed' : ''}>{line || ' '}</span>)}</code></pre><p><strong>Inspect before you act.</strong> Real AI findings can be wrong; a partial review stays marked incomplete.</p></div>}
  </div>;
}

export default function Landing() {
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    applyAppearance(appearance);
    try { localStorage.setItem('stxic-atlas-appearance', appearance); } catch { /* Optional browser preference. */ }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyAppearance(appearance);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [appearance]);
  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 5000);
    return () => window.clearTimeout(timer);
  }, [copyState]);
  async function copyCommands() {
    try { await navigator.clipboard.writeText(installCommands); setCopyState('copied'); }
    catch { setCopyState('failed'); }
  }

  return <div className="landing-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="brand" href="#main" aria-label="Stxic Atlas home"><Logo /><span>stxic<span>atlas</span></span></a>
      <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href={repository}>Source code<ArrowUpRight size={13} aria-hidden="true" /></a></nav>
      <AppearanceControl value={appearance} onChange={setAppearance} />
      <a className="header-action" href="#get-started">Run locally<ArrowRight size={15} aria-hidden="true" /></a>
    </header>
    <main id="main" tabIndex={-1}>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy"><p className="eyebrow"><span />LOCAL-FIRST CODE EXPLORER</p>
          <h1 id="hero-title">A small change.<br />A wider <span>impact.</span></h1>
          <p className="hero-description">That file you changed has connections. See what it uses, what changed alongside it, and what deserves a closer look.</p>
          <div className="hero-actions"><a className="primary-action" href="#example">Explore an example<ArrowUpRight size={17} aria-hidden="true" /></a><a className="secondary-action" href="#get-started">Use your own project<ArrowRight size={16} aria-hidden="true" /></a></div>
          <p className="hero-boundary"><HardDrive size={16} aria-hidden="true" />Repository scanning stays on your computer.</p>
          <div className="hero-footnote"><span>THE QUESTION BEHIND THE MAP</span><p>“If I change this,<br />what else should I check?”</p><a href="#how-it-works" aria-label="Learn how Stxic Atlas works"><ArrowDown size={19} aria-hidden="true" /></a></div>
        </div>
        <ExampleMap />
      </section>

      <section className="evidence-section" id="how-it-works" aria-labelledby="evidence-heading">
        <div className="section-intro"><h2 id="evidence-heading">Follow the connection.<br />Know its source.</h2><p>A connection is useful when you can explain why it’s there. Stxic keeps facts from your repository separate from AI interpretation.</p></div>
        <div className="evidence-methods">
          <article><div className="method-title"><ArrowUpRight aria-hidden="true" /><h3>What the source connects</h3></div><p>Relative imports reveal direct file dependencies in the current checkout.</p><span className="method-origin"><i className="import-line" />Source evidence · deterministic</span></article>
          <article><div className="method-title"><GitCommitHorizontal aria-hidden="true" /><h3>What the history connects</h3></div><p>Shared commits reveal files that repeatedly changed together in recent Git history.</p><span className="method-origin"><i className="history-line" />Git evidence · deterministic</span></article>
          <article><div className="method-title"><ShieldCheck aria-hidden="true" /><h3>What AI suggests checking</h3></div><p>An optional explanation or deeper review proposes concerns tied to changed code.</p><span className="method-origin">Model interpretation · inspect the diff</span></article>
        </div>
        <p className="scope-note">The map uses bounded history and pattern-based import detection. Missing connections don’t prove there’s no impact.</p>
      </section>

      <section className="review-section" aria-labelledby="review-title"><div className="review-copy"><span className="section-label">FROM CONNECTIONS TO CHANGES</span><h2 id="review-title">Understand the edit.<br />Then check deeper.</h2><p>Start with the changed files. Ask for a plain explanation when you need one. A deeper review is a separate step.</p><ol className="workflow"><li><span><GitBranch size={17} aria-hidden="true" /></span><div><h3>Check changes</h3><p>Preview your Git diff. No model needed.</p></div></li><li><span><FileCode2 size={17} aria-hidden="true" /></span><div><h3>Explain with AI</h3><p>What changed, why it matters, and what to check.</p></div></li><li><span><ShieldCheck size={17} aria-hidden="true" /></span><div><h3>Run deeper review</h3><p>Five specialist passes, followed by a skeptical final reviewer. Inspect each finding against the diff.</p></div></li></ol></div><ReviewExample /></section>

      <section className="privacy-section" aria-labelledby="privacy-title"><div><HardDrive size={26} aria-hidden="true" /><h2 id="privacy-title">Your project.<br />Your computer.</h2></div><div className="privacy-copy"><p>Scanning and change previews run locally. Local Ollama is the default for AI; there’s no automatic cloud fallback.</p><p>Ollama Cloud is optional. You choose it, connect your own key, and confirm the exact outgoing context before each AI action.</p><p className="public-boundary">This public page is a synthetic demo. It doesn’t read your folders, call a model, or connect to your local workspace.</p></div></section>

      <section className="setup-section" id="get-started" aria-labelledby="setup-title"><div className="setup-copy"><span className="section-label">TAKE IT TO YOUR OWN REPOSITORY</span><h2 id="setup-title">Make the next change<br />easier to explain.</h2><p>Run Stxic Atlas locally, choose a Git project, and follow the evidence.</p><p className="requirements">You’ll need Node.js 22.13 or newer and Git. AI is optional; local AI also needs Ollama and an installed chat model.</p><a className="secondary-action" href={`${repository}#run-locally`}>Read the setup guide<ArrowUpRight size={16} aria-hidden="true" /></a></div><div className="setup-terminal"><div className="terminal-heading"><span>Local setup</span><button onClick={copyCommands}>{copyState === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copyState === 'copied' ? 'Copied' : 'Copy commands'}</button></div><pre tabIndex={0} aria-label="Local installation commands"><code>{installCommands}</code></pre><div className="terminal-foot"><ArrowUpRight size={15} aria-hidden="true" /><span>Then open <code>http://127.0.0.1:5175</code></span></div><p className="copy-status" role="status">{copyState === 'failed' ? 'Clipboard unavailable. Select and copy the commands above.' : copyState === 'copied' ? 'Setup commands copied to clipboard.' : ''}</p></div></section>

      <section className="faq-section" aria-labelledby="faq-title"><h2 id="faq-title">A few useful details.</h2><div className="faq-list">{[
        ['Can I try it without installing anything?', 'Yes. Use the synthetic file map and review walkthrough on this page. To inspect your own repository, run the local app. The public site has no repository access.'],
        ['Do I need AI to use the file map?', 'No. Source imports and shared Git history are deterministic signals. You can scan a repository and preview changes without an AI model or cloud account.'],
        ['Which projects can it inspect?', 'Tracked source files in Flutter/Dart, JavaScript, TypeScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, Vue, and Svelte contribute to the map. Import detection focuses on JavaScript/TypeScript-style relative imports and relative/local-package Dart imports. It is bounded and pattern-based.'],
        ['Does feedback train the model?', 'No. Explicit useful or incorrect ratings adjust bounded specialist weights for future reviews. Review metadata and feedback are stored in a local SQLite database; models and prompts are not trained or rewritten.'],
      ].map(([question, answer]) => <details key={question}><summary>{question}<Plus className="faq-plus" size={18} aria-hidden="true" /><Minus className="faq-minus" size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>
    </main>
    <footer className="site-footer"><a className="brand" href="#main" aria-label="Back to Stxic Atlas home"><Logo /><span>stxic<span>atlas</span></span></a><p>Built to make the evidence visible.</p><a href={repository}><Github size={16} aria-hidden="true" />View on GitHub<ArrowUpRight size={13} aria-hidden="true" /></a></footer>
  </div>;
}

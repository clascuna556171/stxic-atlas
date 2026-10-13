import { useEffect, useRef, useState } from 'react';
import { readResponse } from './api';
const storageKey = 'stxic-atlas-recent-projects';
function readRecent(): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(value) ? value.filter((path): path is string => typeof path === 'string' && path.length < 2048).slice(0, 5) : []; } catch { return []; }
}
export function rememberProject(path: string) {
  try { localStorage.setItem(storageKey, JSON.stringify([path.trim().replace(/^"(.*)"$/, '$1'), ...readRecent().filter((item) => item !== path.trim().replace(/^"(.*)"$/, '$1'))].slice(0, 5))); window.dispatchEvent(new Event('stxic-projects')); } catch { /* Recent projects are optional. */ }
}
export default function ProjectPicker({ onChoose, disabled = false }: { onChoose: (path: string) => void; disabled?: boolean }) {
  const [recent, setRecent] = useState(readRecent);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  useEffect(() => { const update = () => setRecent(readRecent()); window.addEventListener('stxic-projects', update); window.addEventListener('storage', update); return () => { window.removeEventListener('stxic-projects', update); window.removeEventListener('storage', update); }; }, []);
  async function browse() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPicking(true); setError('');
    try {
      const value = await readResponse(await fetch('/api/project/pick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })) as { repoPath?: unknown };
      if (value.repoPath === null) return;
      if (typeof value.repoPath !== 'string') throw new Error('The folder selection was incomplete. Paste the folder address instead.');
      rememberProject(value.repoPath); onChoose(value.repoPath);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not open the folder window.'); }
    finally { inFlight.current = false; setPicking(false); }
  }
  return <div className="project-picker">
    <button type="button" disabled={disabled || picking} onClick={browse}>{picking ? 'Choose in the folder window…' : 'Browse folders'}</button>
    {recent.length > 0 && <><label><span className="sr-only">Recent projects</span><select aria-label="Recent projects" value="" disabled={disabled || picking} onChange={(event) => onChoose(event.target.value)}><option value="">Recent projects</option>{recent.map((path) => <option key={path} value={path}>{path}</option>)}</select></label><button type="button" disabled={disabled} onClick={() => { try { localStorage.removeItem(storageKey); } catch { /* Optional storage. */ } window.dispatchEvent(new Event('stxic-projects')); }}>Forget recent</button></>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

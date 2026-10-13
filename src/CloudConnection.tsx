import { useRef, useState } from 'react';
import type { ReviewStatus } from './types';
import { readResponse, reviewStatus } from './api';
export default function CloudConnection({ status, onStatus, disabled }: { status: ReviewStatus; onStatus: (value: ReviewStatus) => void; disabled: boolean }) {
  const [key, setKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  async function connect() {
    if (inFlight.current) return;
    inFlight.current = true;
    const candidate = key; setKey(''); setConnecting(true); setError('');
    try { onStatus(reviewStatus(await readResponse(await fetch('/api/cloud/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: candidate }) })))); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not connect.'); }
    finally { inFlight.current = false; setConnecting(false); }
  }
  async function disconnect() {
    if (inFlight.current) return;
    inFlight.current = true;
    setConnecting(true); setError('');
    try { onStatus(reviewStatus(await readResponse(await fetch('/api/cloud/disconnect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })))); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not disconnect.'); }
    finally { inFlight.current = false; setConnecting(false); }
  }
  return <div className="cloud-connection">
    <p>Cloud AI sends selected code and project notes to Ollama. Your key needs account access and an available usage allowance. <a href="https://ollama.com/settings/keys" target="_blank" rel="noreferrer">Get an API key</a> · <a href="https://ollama.com/settings" target="_blank" rel="noreferrer">Check your cloud account</a> · <a href="https://ollama.com/privacy" target="_blank" rel="noreferrer">Provider privacy policy</a></p>
    {status.available ? <div><strong>Key saved for this local server session.</strong><button type="button" disabled={disabled || connecting} onClick={disconnect}>Disconnect and clear key</button></div> : <div><label><span>Ollama Cloud API key</span><input type="password" autoComplete="off" spellCheck={false} value={key} disabled={disabled || connecting} onChange={(event) => setKey(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (key.trim() && !disabled && !connecting) void connect(); } }} /></label><button type="button" disabled={disabled || connecting || !key.trim()} onClick={connect}>{connecting ? 'Connecting…' : 'Connect cloud key'}</button></div>}
    <small>The key stays in local server memory until disconnected or the server restarts. It is never saved in browser storage, reports, or Git. Account authorization is confirmed when the first AI request runs.</small>
    {error && <p role="alert">{error}</p>}
  </div>;
}

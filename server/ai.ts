import type { AIProvider } from '../src/types.js';

let cloudKey = '';
let cloudModels: string[] = [];
export function disconnectCloud() { cloudKey = ''; cloudModels = []; }
export function cloudStatus() { return { available: !!cloudKey && cloudModels.length > 0, models: [...cloudModels], reason: cloudKey ? '' : 'Connect your Ollama Cloud key to continue.' }; }
export async function connectCloud(value: unknown) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate || candidate.length > 512 || /\s/.test(candidate)) throw new Error('Enter a valid Ollama Cloud API key.');
  // Fetch the catalog without repository data. Public catalogs may not verify authorization.
  const response = await fetch('https://ollama.com/api/tags', { headers: { Authorization: `Bearer ${candidate}` }, signal: AbortSignal.timeout(15_000), redirect: 'error' });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'The cloud key was rejected. Check the key and account access.' : `Could not connect to Ollama Cloud (${response.status}). Try again.`);
  const data = await response.json() as { models?: { name?: unknown }[] };
  const models = Array.isArray(data.models) ? data.models.flatMap((item) => typeof item?.name === 'string' && /^[\w.:/-]{1,120}$/.test(item.name) && !item.name.includes('embed') ? [item.name] : []) : [];
  if (!models.length) throw new Error('Ollama Cloud returned no usable models. Try again later.');
  cloudKey = candidate; cloudModels = models;
  return cloudStatus();
}
export function validateProvider(value: unknown): AIProvider {
  if (value === undefined || value === 'local') return 'local';
  if (value === 'cloud') return 'cloud';
  throw new Error('Choose local AI or Ollama Cloud.');
}
export function checkCloudModel(model: string) {
  if (!cloudKey || !cloudModels.includes(model)) throw new Error('Connect Ollama Cloud and choose an available model.');
}
export async function chatRequest(provider: AIProvider, body: unknown) {
  if (provider === 'cloud' && !cloudKey) throw new Error('The cloud connection was cleared. Connect again.');
  try {
    const response = await fetch(provider === 'cloud' ? 'https://ollama.com/api/chat' : 'http://127.0.0.1:11434/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json', ...(provider === 'cloud' ? { Authorization: `Bearer ${cloudKey}` } : {}) },
      signal: AbortSignal.timeout(210_000), redirect: 'error', body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Cloud authorization failed. Reconnect your key.' : `AI service returned ${response.status}. Check model availability or your usage allowance.`);
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') throw new Error('AI took too long. Try a smaller change or another model.');
    if (error instanceof Error && error.message.startsWith('AI service') || error instanceof Error && error.message.startsWith('Cloud authorization')) throw error;
    throw new Error('Could not reach the selected AI service. Check the connection and try again.');
  }
}

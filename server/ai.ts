import type { AIProvider } from '../src/types.js';

let cloudKey = '';
let cloudModels: string[] = [];
export class AIServiceError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'AIServiceError'; }
}
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
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: 'AI could not accept the request for this model. Choose another model. Your file preview is still available.',
        401: 'Cloud authorization failed. Reconnect your key.',
        403: 'Cloud authorization failed. Check whether your account can use this model, or choose local AI.',
        402: 'Ollama Cloud blocked the AI request (402). Check your account’s usage allowance or plan, choose another available model, or use local AI. Checking files does not require cloud access.',
        429: 'AI is receiving too many requests. Wait a little before trying again. Your file preview is still available.',
        404: 'That AI model is no longer available. Refresh the model list or choose another model.',
      };
      throw new AIServiceError(response.status, messages[response.status] || `AI service returned ${response.status}. Try again later or choose another model.`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') throw new AIServiceError(504, 'AI took too long. Try a smaller change or another model.');
    if (error instanceof AIServiceError) throw error;
    throw new AIServiceError(503, 'Could not reach the selected AI service. Check the connection and try again.');
  }
}

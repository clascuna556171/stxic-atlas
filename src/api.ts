import type { AtlasData, ReviewResult, ReviewStatus } from './types';

export async function readResponse(response: Response): Promise<unknown> {
  const payload = await response.json().catch(() => { throw new Error('The local service returned an unreadable response.'); });
  if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'The local request failed.');
  return payload;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
export function atlasData(value: unknown): AtlasData {
  if (!object(value) || !object(value.summary) || typeof value.repository !== 'string' || typeof value.branch !== 'string' || typeof value.scannedAt !== 'string' || typeof value.synthetic !== 'boolean' || !Array.isArray(value.nodes) || !value.nodes.length || !Array.isArray(value.edges) || !Array.isArray(value.findings) || !Array.isArray(value.suggestedChecks)
    || !['commits', 'files', 'contributors', 'hotspots'].every((key) => object(value.summary) && typeof value.summary[key] === 'number')
    || !value.nodes.every((node) => object(node) && ['id', 'label', 'group'].every((key) => typeof node[key] === 'string') && ['x', 'y', 'commits'].every((key) => typeof node[key] === 'number'))
    || !value.edges.every((edge) => object(edge) && ['from', 'to', 'kind', 'evidence'].every((key) => typeof edge[key] === 'string'))
    || !value.findings.every((finding) => object(finding) && ['severity', 'title', 'detail', 'evidence', 'node'].every((key) => typeof finding[key] === 'string')))
    throw new Error('The local service returned an incomplete impact map.');
  const nodes = value.nodes;
  if (!value.suggestedChecks.every((check) => object(check) && ['label', 'path', 'reason'].every((key) => typeof check[key] === 'string'))
    || !value.nodes.every((node) => ['service', 'module', 'file', 'test'].includes(node.kind) && ['x', 'y', 'commits', 'churn'].every((key) => Number.isFinite(node[key])))
    || !value.edges.every((edge) => ['imports', 'cochange', 'contains'].includes(edge.kind) && nodes.some((node: AtlasData['nodes'][number]) => node.id === edge.from) && nodes.some((node: AtlasData['nodes'][number]) => node.id === edge.to)))
    throw new Error('The local service returned an incomplete impact map.');
  return value as unknown as AtlasData;
}
export function reviewStatus(value: unknown): ReviewStatus {
  if (!object(value) || typeof value.available !== 'boolean' || !strings(value.models) || typeof value.reason !== 'string') throw new Error('Invalid model status.');
  return value as unknown as ReviewStatus;
}
export function reviewResult(value: unknown): ReviewResult {
  if (!object(value) || typeof value.synthetic !== 'boolean' || !['reviewId', 'repository', 'branch', 'baseRef', 'diff', 'changeSummary', 'purposeSummary'].every((key) => typeof value[key] === 'string')
    || !strings(value.contextFiles) || !strings(value.commitMessages) || !strings(value.untrackedOmitted) || !object(value.metrics) || !object(value.chair)
    || !['passed', 'totalAgents', 'totalTokens', 'usefulFeedback', 'incorrectFeedback'].every((key) => object(value.metrics) && typeof value.metrics[key] === 'number')
    || typeof value.elapsedMs !== 'number' || typeof value.confidence !== 'number' || !['request-changes', 'review-findings', 'looks-clear', 'partial-review'].includes(String(value.decision))
    || !Array.isArray(value.files) || !value.files.every((file) => object(file) && typeof file.path === 'string' && typeof file.additions === 'number' && typeof file.deletions === 'number')
    || !Array.isArray(value.agents) || !value.agents.every((agent) => object(agent) && typeof agent.name === 'string' && ['weight', 'findings', 'elapsedMs', 'promptTokens', 'responseTokens'].every((key) => typeof agent[key] === 'number'))
    || !Array.isArray(value.findings) || !value.findings.every((finding) => object(finding) && ['id', 'file', 'title', 'comment', 'severity'].every((key) => typeof finding[key] === 'string') && strings(finding.agents) && typeof finding.agreement === 'number'))
    throw new Error('The local service returned an incomplete review report.');
  const agents = ['security', 'architecture', 'quality', 'tests', 'performance'];
  if (typeof value.diffTruncated !== 'boolean' || !['user', 'git', 'unprovided'].includes(String(value.purposeSource))
    || !['complete', 'failed', 'skipped'].includes(String(value.chair.status)) || !Number.isFinite(value.chair.elapsedMs)
    || !value.agents.every((agent) => agents.includes(agent.id) && ['complete', 'failed'].includes(agent.status))
    || !value.findings.every((finding) => ['critical', 'high', 'medium', 'low'].includes(finding.severity)
      && ['supported', 'questioned', 'dismissed', 'not-run'].includes(finding.chairVerdict)
      && typeof finding.chairReason === 'string' && (finding.line === null || Number.isInteger(finding.line) && finding.line > 0)
      && finding.agents.every((agent: string) => agents.includes(agent)) && Number.isFinite(finding.agreement) && finding.agreement >= 0 && finding.agreement <= 1))
    throw new Error('The local service returned an incomplete review report.');
  return value as unknown as ReviewResult;
}

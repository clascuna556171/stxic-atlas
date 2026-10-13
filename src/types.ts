export type AtlasNode = { id: string; label: string; kind: 'service' | 'module' | 'file' | 'test'; x: number; y: number; commits: number; churn: number; group: string };
export type AtlasEdge = { from: string; to: string; kind: 'imports' | 'cochange' | 'contains'; strength: number; evidence: string };
export type Finding = { severity: string; title: string; detail: string; evidence: string; node: string };
export type Check = { label: string; path: string; reason: string };
export type AtlasData = {
  repoPath?: string;
  repository: string; branch: string; scannedAt: string; synthetic: boolean;
  summary: { commits: number; files: number; contributors: number; hotspots: number };
  nodes: AtlasNode[]; edges: AtlasEdge[]; findings: Finding[]; suggestedChecks: Check[];
};

export type ReviewStatus = { available: boolean; models: string[]; reason: string };
export type AIProvider = 'local' | 'cloud';
export type Explanation = { repository: string; baseRef: string; diff: string; model: string; provider: AIProvider; whatChanged: string; whyItMatters: string; checks: { text: string; file: string; line: number }[]; partial: boolean; elapsedMs: number };
export type Disclosure = { digest: string; content: string; mode: 'explain' | 'review'; model: string; files: string[]; documents: string[]; partial: boolean };
export type ChangePreview = {
  generatedExcluded?: string[];
  repository: string; baseRef: string; branch: string; diff: string; diffTruncated: boolean;
  files: { path: string; status: string; additions: number; deletions: number }[];
  untrackedOmitted: string[]; commitMessages: string[];
};
export type ReviewFinding = {
  id: string; severity: 'critical' | 'high' | 'medium' | 'low'; category: string; title: string;
  file: string; line: number | null; comment: string; suggestedFix: string | null;
  confidence: number; agents: ('security' | 'architecture' | 'quality' | 'tests' | 'performance')[];
  agreement: number; chairVerdict: 'supported' | 'questioned' | 'dismissed' | 'not-run'; chairReason: string;
};
export type ReviewResult = {
  generatedExcluded?: string[];
  provider?: AIProvider;
  synthetic: boolean;
  reviewId: string; repository: string; branch: string; baseRef: string; model: string; intent: string;
  reviewedAt: string; elapsedMs: number;
  files: { path: string; status: string; additions: number; deletions: number }[];
  commitMessages: string[];
  contextFiles: string[];
  changeSummary: string; changeSummarySource: 'model' | 'git' | 'synthetic'; purposeSummary: string; purposeSource: 'user' | 'git' | 'unprovided';
  untrackedOmitted: string[]; diff: string; diffTruncated: boolean; findings: ReviewFinding[];
  decision: 'request-changes' | 'review-findings' | 'looks-clear' | 'partial-review'; confidence: number;
  agents: { id: 'security' | 'architecture' | 'quality' | 'tests' | 'performance'; name: string; weight: number; status: 'complete' | 'failed'; findings: number; elapsedMs: number; promptTokens: number; responseTokens: number; error?: string }[];
  chair: { status: 'complete' | 'failed' | 'skipped'; elapsedMs: number; error?: string };
  metrics: { passed: number; totalAgents: number; totalTokens: number; usefulFeedback: number; incorrectFeedback: number };
};

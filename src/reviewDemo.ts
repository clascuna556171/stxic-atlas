import type { ReviewResult } from './types';

// Everything in this report is illustrative. It never calls Ollama or saves feedback.
export const reviewDemo: ReviewResult = {
  synthetic: true, reviewId: 'synthetic-checkout-review', repository: 'synthetic/checkout-example', branch: 'demo/discounts', baseRef: 'main', model: 'Synthetic example · no model run', intent: 'Apply discounts before calculating tax.', reviewedAt: 'Synthetic example', elapsedMs: 0,
  files: [{ path: 'checkout/totals.ts', status: 'M', additions: 3, deletions: 1 }], commitMessages: [], contextFiles: [],
  changeSummary: 'The example adds a discount parameter and subtracts it from the final total, while tax still uses the original subtotal.',
  purposeSummary: 'Illustrative intent: Apply discounts before calculating tax.', purposeSource: 'user', untrackedOmitted: [], diffTruncated: false,
  diff: `diff --git a/checkout/totals.ts b/checkout/totals.ts
--- a/checkout/totals.ts
+++ b/checkout/totals.ts
@@ -1,4 +1,5 @@
-export function total(subtotal: number, taxRate: number) {
+export function total(subtotal: number, taxRate: number, discount = 0) {
   const tax = subtotal * taxRate;
+  const discounted = subtotal - discount;
+  return discounted + tax;
-  return subtotal + tax;
 }
`,
  findings: [{ id: 'demo-tax', severity: 'high', category: 'correctness', title: 'Tax still uses the subtotal before the discount', file: 'checkout/totals.ts', line: 4, comment: 'For a subtotal of 100, discount of 20, and tax rate of 10%, the example returns 90. The stated intent requires tax on 80, which gives 88. The added return value still uses tax calculated from 100.', suggestedFix: 'Calculate the discounted subtotal first, then compute tax from that value. Add a regression test for a nonzero discount.', confidence: 0.95, agents: ['architecture', 'quality', 'tests'], agreement: 0.58, chairVerdict: 'supported', chairReason: 'The example keeps tax calculated from the original subtotal, which conflicts with the illustrative intent.' }],
  decision: 'request-changes', confidence: 0.58,
  agents: [
    { id: 'security', name: 'Security', weight: 1.4, findings: 0 },
    { id: 'architecture', name: 'Architecture', weight: 1.2, findings: 1 },
    { id: 'quality', name: 'Quality', weight: 1, findings: 1 },
    { id: 'tests', name: 'Tests', weight: 1.1, findings: 1 },
    { id: 'performance', name: 'Performance', weight: 1, findings: 0 },
  ].map((agent) => ({ ...agent, id: agent.id as ReviewResult['agents'][number]['id'], status: 'complete', elapsedMs: 0, promptTokens: 0, responseTokens: 0 })),
  chair: { status: 'complete', elapsedMs: 0 }, metrics: { passed: 5, totalAgents: 5, totalTokens: 0, usefulFeedback: 0, incorrectFeedback: 0 },
};

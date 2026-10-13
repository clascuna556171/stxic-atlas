# Stxic Atlas verification — October 13, 2026

## Delivered behavior

- Corrected the impact analyzer's Git commit parsing and aligned relationship counts to the complete bounded 400-commit window.
- Separated import observations from historical co-change observations and resolved supported `.js` imports to TypeScript source.
- Added a synthetic review walkthrough with cited diff, specialist votes, chair explanation, export, and temporary feedback.
- Added connection retry, response validation, a keyboard-accessible field guide, and a return-to-sample control after local scans.
- Corrected weighted confidence averaging, included chair tokens, validated feedback against saved findings, and labeled failed/incomplete/truncated reviews as partial.
- Added bounded source reads that exclude symlinked parent directories and disabled Git text-conversion helpers for review patches.

## Checks actually run

- `npm test`: **13 passed**, covering real Git fixtures, imports and co-changes, repository roots, traversal, oversized files, symlinked directories, malformed API/model responses, incomplete chair votes, truncation, invalid refs, and feedback persistence/validation.
- `npm run build`: **passed**, including frontend/backend TypeScript and production bundling.
- Local HTTP checks: health, model discovery, repository analysis, and malformed JSON error response.
- Browser checks at desktop and 390-pixel phone widths: example loading, temporary feedback, cited diff navigation, local fixture scan, return to sample, and field guide Escape/focus restoration. The phone review page had no horizontal page overflow; long code scrolls within its own area.
- `npm run smoke:review`: **passed** against installed local `qwen2.5-coder:1.5b`, using a generated synthetic checkout and isolated feedback database. Final run: five specialists completed, chair completed with a verdict for all five proposed findings, 3,565 reported tokens, about 9.3 seconds. This verifies orchestration, not finding accuracy or model quality.

## Inspectable artifacts

- [Final actual local-model smoke report](.test-data/smoke-1791857833380/report.json)
- [Synthetic smoke checkout](.test-data/smoke-1791857833380/synthetic-checkout/total.ts)
- [Verified review screenshot](design/stxic-atlas-verified.png)

## Local data and boundaries

No hosted model, paid API, or code-upload behavior was added. Repository reads and inference stay local. Real review metadata, finding identifiers/reviewer membership, and feedback are saved in the existing local SQLite store; source/diff/finding prose is not persisted there. The smoke script saves its synthetic fixture, report, and isolated database under the ignored `.test-data/` directory. Synthetic UI feedback stays in memory.

The impact analyzer remains pattern-based and bounded. Model findings remain interpretations that require inspection; successful orchestration is not proof of accurate review. No publishing, GitHub integration, autonomous learning, or model training was added.

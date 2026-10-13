# Stxic Atlas verification — October 13, 2026

## Explanation workflow and optional cloud

- `npm test`: 22 passed. New checks cover a single local explanation call, remote-model exclusion, invalid citations, malformed explanations, cloud key clearing, source/intent/action-bound consent, six-call cloud review orchestration, sanitized authorization failures, and no provider fallback. Cloud responses and credentials in these tests are synthetic mocks.
- `npm run build`: passed after the workflow and accessibility updates; the final narrow-panel adjustment was rebuilt before publishing. `git diff --check` passed.
- Actual local browser run on the existing synthetic checkout: `qwen3.5:9b` produced an explanation and a valid changed-line check in 46.5 seconds. Code excerpt expansion and downloaded explanation text were inspected. A small-model trial took 4.4 seconds but returned invalid check citations, correctly removed and labeled incomplete. Model interpretation can still be inaccurate; neither run establishes general accuracy.
- Browser layout checks: 390px viewport / 381px page, and 310px viewport / 301px page, with no horizontal overflow. Light and dark setup, keyboard appearance selection, local/cloud switching, disabled cloud actions without a key, and password-field presentation were checked. `design/stxic-cloud-mobile.png` captures the new dark cloud setup.
- Live cloud inference was not run because no real API key was supplied. Native Windows folder-window selection/cancellation was not manually operated in this session; its static argument-based launcher, timeout, cancellation result, and repository validation were inspected. Pasted-path scanning remains available.

Privacy changes: scanning/change previews stay local. Explicitly confirmed cloud actions send the displayed bounded context to Ollama Cloud. Keys live only in local server memory until disconnect/restart; five recent successful folder paths can be stored in browser local storage and cleared through Forget recent. Quick explanations retain their diff in page memory and do not write source/prose to SQLite. Existing deeper-review metadata/feedback storage remains local. No automatic cloud fallback, source upload during scans, or hosted Git integration was added.

## Final audit update

## Usability repair update

The later usability pass added actionable folder errors, quoted path support, first-commit scan handling, a Git-only change preview, current/latest/advanced comparisons, readable reports, and an original S/branch logo. **17 automated tests passed**, including preview isolation from AI and preserving model summaries when final verdicts are incomplete. Production build and a fresh small-model smoke were rerun. A larger `qwen3.5:9b` trial completed five specialists but failed the final verdict completeness check after about four minutes; it was correctly reported partial. This observed failure motivated the independently tested summary-preservation fix. No model-accuracy claim is made.

Browser checks: actual quoted Windows scan; preview without inference; latest-commit error for a one-commit fixture; readable report download and contents; 390px review with 381px page width. `design/stxic-usable-desktop.png` shows the revised first-use screen and logo.

Final actual small-model smoke after the request/summary fixes: five specialists and chair completed, 3,798 tokens, 13.7 seconds (`.test-data/smoke-1791889183448/report.json`). Larger-model trial: `.test-data/smoke-1791888818632/report.json`, five specialists, incomplete chair votes, 241 seconds. These ignored local artifacts use fictional checkout code; model accuracy is not certified. Model findings without a valid changed-line citation cannot trigger a request-changes decision. No hosted service or new automatic upload was introduced; previews read locally and readable reports download locally.

## Earlier final audit

The latest pass added System/Light/Dark appearance, retained review state across workspace changes, improved mobile actions and text/focus accessibility, and hardened local requests and response validation. See [final audit](AUDIT.md) for findings, checks, privacy boundaries, and limitations. Latest automated run: **14 tests passed**, production build passed, dependency audit reported zero vulnerabilities, and a fresh actual-model synthetic smoke completed all five specialists and the chair (3,563 tokens, 13.4 seconds). Earlier results below describe the initial MVP verification.

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

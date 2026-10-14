# Verification — October 14, 2026

This record describes checks run against the current local app and separate landing page. Synthetic fixtures and mocked replies are distinguished from actual model inference.

## Automated checks

- `npm test`: 32 tests passed. Coverage includes Git/import history, NUL-delimited filenames, repository containment, active/unused Git clean/process filters, generated-file exclusions, feedback integrity, rejected model findings/citations, response validation, partial reviews, cloud consent, provider denial, and request lifecycle handling.
- `npm run build`: local frontend and backend TypeScript checks and production frontend build passed.
- `npm run build:landing`: separate landing TypeScript checks and static build passed.
- `npm audit`: zero reported vulnerabilities.
- `git diff --check`: passed.
- Fresh isolated Windows snapshot: `npm ci`, all 32 tests, both builds, and `smoke:install` passed using Node 24.14.0. The snapshot was removed afterward.
- Node 22.13.0 on Windows: all 32 tests and `smoke:install` passed.
- Installation smoke checked the production HTML, local health/demo API, synthetic Git scan, and change preview without AI, with temporary storage and cleanup.
- The active/unused filter regression tests were rerun after adding the explicit unused-filter fixture; both passed.

The suite uses disposable Git fixtures, mocked model replies, and an isolated SQLite store.
The [first remote release-check run](https://github.com/clascuna556171/stxic-atlas/actions/runs/38593402119)
passed all six jobs for commit `2f97d2f`: fresh installation, tests, both builds, and
installation smoke on Windows, macOS, and Linux with Node 22.13.0 and 24. The Ubuntu
Node 24 job also passed the dependency audit. This checks these workflows on the runner
environments; it is not a full browser/platform or model-accuracy certification.

## Actual local-model smoke

`npm run smoke:review -- qwen2.5-coder:1.5b` completed on a synthetic checkout using
local Ollama. Five specialists and the final reviewer completed in approximately 18 seconds;
the report retained five findings and correctly remained `partial-review` because some
model output was invalid. This verifies actual transport/orchestration and incomplete-output
handling, not accuracy or release approval. No cloud AI was called. The synthetic report,
checkout, and isolated feedback store remain under ignored `.test-data/`.

## Earlier browser and deployment checks (not repeated in this release hardening)

- Local scan, search empty-state recovery, synthetic review rendering, and help-dialog Escape/focus restoration.
- Landing keyboard file selection, import/history filters, empty-connection recovery, exact diff inspection, FAQ disclosure, clipboard setup commands, and light/dark appearance.
- Phone layouts at 390×844 and 320×740. Content fits the available width at the smallest viewport with no horizontal page overflow.
- Public landing deployment reached READY at [stxic-atlas.vercel.app](https://stxic-atlas.vercel.app). Public HTTP status was 200; `/api/health` returned 404. Production policy blocks fetch/WebSocket connections and includes anti-framing protection.
- Two current screenshots in [assets/](assets/) show only the synthetic local map and synthetic review. Historical development images are excluded from the published tree.

## Scope and limits

These checks verify implemented behavior and orchestration, not model accuracy. A complete screen-reader audit, penetration test, and large-repository benchmark were not performed. A partial model run remains incomplete; passing tests does not establish that AI findings are always correct.

The repository retains implementation, tests, reproducible build inputs, product/contributor documentation, and current showcase assets. Environment files, builds, databases, smoke artifacts, local tool settings, and one-off notes stay excluded. This cleanup does not rewrite Git history.

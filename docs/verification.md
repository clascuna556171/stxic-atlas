# Verification — October 14, 2026

This record describes checks run against the current local app and separate landing page. Synthetic fixtures and mocked replies are distinguished from actual model inference.

## Automated checks

- `npm test`: 28 tests passed. Coverage includes Git/import history, NUL-delimited filenames, repository containment, generated-file exclusions, feedback integrity, response validation, partial reviews, cloud consent, provider denial, and request lifecycle handling.
- `npm run build`: local frontend and backend TypeScript checks and production frontend build passed.
- `npm run build:landing`: separate landing TypeScript checks and static build passed.
- `npm audit`: zero reported vulnerabilities.
- `git diff --check`: passed.

The suite uses disposable Git fixtures, mocked model replies, and an isolated SQLite store. An actual Ollama inference smoke run was not repeated during this cleanup.

## Browser and deployment checks

- Local scan, search empty-state recovery, synthetic review rendering, and help-dialog Escape/focus restoration.
- Landing keyboard file selection, import/history filters, empty-connection recovery, exact diff inspection, FAQ disclosure, clipboard setup commands, and light/dark appearance.
- Phone layouts at 390×844 and 320×740. Content fits the available width at the smallest viewport with no horizontal page overflow.
- Public landing deployment reached READY at [stxic-atlas.vercel.app](https://stxic-atlas.vercel.app). Public HTTP status was 200; `/api/health` returned 404. Production policy blocks fetch/WebSocket connections and includes anti-framing protection.
- Two current screenshots in [assets/](assets/) show only the synthetic local map and synthetic review. Historical development images are excluded from the published tree.

## Scope and limits

These checks verify implemented behavior and orchestration, not model accuracy. A complete screen-reader audit, penetration test, and large-repository benchmark were not performed. A partial model run remains incomplete; passing tests does not establish that AI findings are always correct.

The repository retains implementation, tests, reproducible build inputs, product/contributor documentation, and current showcase assets. Environment files, builds, databases, smoke artifacts, local tool settings, and one-off notes stay excluded. This cleanup does not rewrite Git history.

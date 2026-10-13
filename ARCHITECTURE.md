# Stxic Atlas architecture

This describes the implementation as it exists today. For product goals and constraints see [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md); for user journeys see [USER_FLOWS.md](USER_FLOWS.md).

## Runtime

- **Frontend:** React 19 and TypeScript, bundled by Vite. `src/main.tsx` mounts `src/App.tsx`; `src/ReviewPanel.tsx` owns the review workflow UI; `src/types.ts` defines shared response shapes.
- **Backend:** Express 5 routes in `server/index.ts`, deterministic impact analysis in `server/analyze.ts`, and local-model orchestration in `server/review.ts`. `server/repository.ts` centralizes argument-based Git calls, repository-root validation, and bounded source reads that exclude symlinked path components.
- **Development:** Vite serves the UI and proxies `/api` to Express at `127.0.0.1:4317` (`vite.config.ts`). `npm run dev` starts both processes.
- **Production:** the Express service serves `dist/` when a production build exists.

## Impact-analysis data path

`App.tsx` requests `/api/demo` at startup. A local scan posts a repository path to `/api/analyze`. The server validates the Git root and uses Git commands to read recent commit metadata, tracked files, and branch information. It limits the analyzed history and source-file set, reads selected source files locally, infers supported relative imports, and counts repeated co-changes. It returns nodes, edges, summary values, and evidence for the UI map.

This analyzer is deterministic and bounded; it does not execute project code. Import extraction is pattern-based, not a complete parser, and does not cover every language's import syntax. The map only displays a subset of analyzed files.

Commit boundaries are explicitly delimited when reading history; all counted relationships use the same bounded window of up to 400 commits. Tracked paths are NUL-delimited. Imports and co-changes have separate observation labels; import observations never claim historical coupling.

## Review data path

`ReviewPanel.tsx` checks `/api/review/status`, then posts review inputs to `/api/review`. The Express route delegates to `runReview` in `server/review.ts`. That module validates the repository root and Git ref, collects a bounded Git diff and supported untracked source files, and reads a small allowlist of project documents.

The module calls Ollama's local `/api/chat` endpoint at `127.0.0.1:11434`. Five specialist requests run concurrently against the selected installed model. Structured responses are validated and restricted to changed files and lines. Findings are grouped, weighted agreement is calculated, and a chair request challenges existing findings against the diff. Failed specialist passes produce a partial review state.

Requests explicitly set `think: false` so supported models return an answer without spending the bounded output budget on optional thinking; see [Ollama's thinking API documentation](https://ollama.com/blog/thinking). The prompts ask for plain-language consequences and a before/after summary. A valid model summary and valid available verdicts survive incomplete final-review votes; the chair still fails and the decision remains partial. `changeSummarySource` labels model interpretation independently from chair completion. A request-changes decision requires a supported finding with a valid changed-line citation; file-level or questioned concerns remain inspectable as review findings.

The app records review run and per-agent metrics plus explicit finding feedback in SQLite under the user's local `.change-atlas` data directory. Feedback affects only bounded agent weights; there is no model training or automatic prompt evolution.

The frontend and backend use the review types in `src/types.ts`. Frontend response guards in `src/api.ts` reject incomplete payloads. Review patches are limited to 38,000 characters, matching the actual context sent to all reviewers. Specialist confidence is averaged using reviewer weights, while agreement divides supporting weighted confidence by all completed specialist weights. Chair token usage is included in the run total. Failed or incomplete chair responses, malformed specialist payloads, truncated diffs, and omitted untracked files prevent a complete-review decision.

`review_findings` stores finding identifiers and participating reviewer IDs. Feedback resolves that record server-side instead of trusting reviewer IDs from the browser. Stored records do not contain source code, diff text, or finding prose. The synthetic frontend report in `src/reviewDemo.ts` never writes feedback or calls a model.

`tests/workflows.test.ts` exercises disposable Git fixtures and mocked model responses with an isolated SQLite store. `scripts/smoke-review.ts` runs an actual installed model against a generated synthetic checkout; its artifacts stay under the ignored `.test-data/` directory.

## HTTP interface

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Basic service health response. |
| `GET /api/demo` | Synthetic example data. |
| `POST /api/analyze` | Analyze a local Git repository for impact signals. |
| `GET /api/review/status` | Check local Ollama and list installed chat models. |
| `POST /api/review` | Run specialist review and chair pass. |
| `POST /api/review/preview` | Collect bounded change details without calling Ollama or saving review metrics. |
| `POST /api/review/feedback` | Save a useful/incorrect vote for a finding. |

## Trust and data boundaries

`previewChanges` validates the root and comparison before collecting the same bounded patch used by review. The special `HEAD^` comparison is explicitly allowed; arbitrary Git revision expressions and option-like refs remain rejected. A preview does not require a model and does not imply a review occurred. New repositories with tracked/staged supported code can display a map before their first commit; review still requires a saved baseline. Folder paths can contain a surrounding pair of double quotes; external URLs and filesystem/Git errors produce actionable messages.

- `server/security.ts` rejects non-loopback Host/Origin headers, cross-site browser requests, and non-JSON API POSTs before parsing their payloads. Local API responses are not cached and include anti-framing and MIME-sniffing protection. Only one review request can run at a time to bound local-model resource use.
- Git invocations disable configured filesystem monitor helpers in the inspected repository. This avoids running a repository-configured helper during scans.
- Development binds explicitly to IPv4 loopback at port 5175 and fails if that port is occupied, avoiding silent port changes.
- `src/theme.ts` resolves a browser-local appearance preference and system color scheme. No theme preference or additional repository data is transmitted.

- Repository paths, source, diffs, and feedback are handled locally by the app. Review prompts go only to the local Ollama endpoint.
- Project documents and code diffs are untrusted input to the model, not instructions; the review prompt explicitly says so.
- Source files and Git output are bounded. Symlinks and oversized files are skipped in review context collection.
- Model output must be treated as fallible. Keep evidence and interpretation distinguishable in API types and UI copy.
- Never describe the current local app as providing hosted deployment, webhooks, CI integration, or GitHub comments; those are not implemented.

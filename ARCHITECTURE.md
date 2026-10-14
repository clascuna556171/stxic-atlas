# Stxic Atlas architecture

This describes the implementation as it exists today. For product goals and constraints see [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md); for user journeys see [USER_FLOWS.md](USER_FLOWS.md).

## Runtime

- **Frontend:** React 19 and TypeScript, bundled by Vite. `src/main.tsx` mounts `src/App.tsx`; `src/ReviewPanel.tsx` owns the review workflow UI; `src/types.ts` defines shared response shapes.
- **Backend:** Express 5 routes in `server/index.ts`, deterministic impact analysis in `server/analyze.ts`, and local-model orchestration in `server/review.ts`. `server/repository.ts` centralizes argument-based Git calls, repository-root validation, and bounded source reads that exclude symlinked path components.
- **Development:** Vite serves the UI and proxies `/api` to Express at `127.0.0.1:4317` (`vite.config.ts`). `npm run dev` starts both processes.
- **Local production:** the Express service serves `dist/` when a production build exists.
- **Public landing page:** `landing/` is a separate React/TypeScript entry built by `vite.landing.config.ts` into `dist-landing/`. `vercel.json` selects `npm run build:landing` and publishes only this static output. It shares the logo, appearance controls, theme helpers, types, and visibly synthetic review fixture; it never mounts the local application or requests its API. A production content security policy disallows fetch/WebSocket connections. Local fonts are bundled with the page. `.vercelignore` excludes server code, local data, test fixtures, project documents, and unused local-app source from deployment uploads.

## Impact-analysis data path

`App.tsx` requests `/api/demo` at startup. A local scan posts a repository path to `/api/analyze`. The server validates the Git root and uses Git commands to read recent commit metadata, tracked files, and branch information. It limits the analyzed history and source-file set, reads selected source files locally, infers supported relative imports, and counts repeated co-changes. It returns nodes, edges, summary values, and evidence for the UI map.

This analyzer is deterministic and bounded; it does not execute project code. Import extraction is pattern-based, not a complete parser, and does not cover every language's import syntax. The map only displays a subset of analyzed files.

Commit boundaries are explicitly delimited when reading history; all counted relationships use the same bounded window of up to 400 commits. Tracked and history paths are NUL-delimited so whitespace and quoted characters remain part of filenames. Imports and co-changes have separate observation labels; import observations never claim historical coupling.

## Review data path

`ReviewPanel.tsx` checks `/api/review/status`, then posts review inputs to `/api/review`. The Express route delegates to `runReview` in `server/review.ts`. That module validates the repository root and Git ref, collects a bounded Git diff and supported untracked source files, and reads a small allowlist of project documents.

`server/ai.ts` routes model calls to local Ollama by default, or the fixed HTTPS Ollama Cloud endpoint after explicit provider selection and verified context confirmation. It never falls back across providers. Five specialist requests use the selected model. Local passes run concurrently; cloud runs the first specialist before starting the remaining four. Structured responses are validated and restricted to changed files and lines. Findings are grouped, weighted agreement is calculated, and a chair request challenges existing findings against the diff. Failed specialist passes produce a partial review state.

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
- Git invocations disable configured filesystem monitor helpers. Before a diff, bounded configuration and tracked-file attribute checks reject active clean/process filters (including Git LFS), rather than executing helpers or silently changing their evidence. Unused configured filters do not block unrelated projects; detected filter commands are overridden to empty for the diff invocation. External diff and text conversion are disabled on all patch/stat/name queries. These checks do not change the inspected project's settings.
- Development binds explicitly to IPv4 loopback at port 5175 and fails if that port is occupied, avoiding silent port changes.
- `src/theme.ts` resolves a browser-local appearance preference and system color scheme. No theme preference or additional repository data is transmitted.

- Repository paths, source, diffs, and feedback are handled locally by the app. Local prompts go to local Ollama. Optional cloud prompts go to Ollama Cloud only after a preview digest matches the freshly collected context, model, and action.
- Project documents and code diffs are untrusted input to the model, not instructions; the review prompt explicitly says so.
- Source files and Git output are bounded. Symlinks and oversized files are skipped in review context collection.
- Model output must be treated as fallible. Keep evidence and interpretation distinguishable in API types and UI copy.
- The public landing page is a hosted introduction and synthetic walkthrough. The repository-analysis service remains local and is not publicly hosted. Webhooks, CI integration, and GitHub comments are not implemented.


## Explanation, cloud, and project selection

- `POST /api/review/explain`: one model call returning a plain explanation, bounded checks restricted to actual added lines, coverage status, and its exact diff. Does not persist source, prose, or review metrics.
- `POST /api/review/disclosure`: collects context locally and returns its readable JSON and SHA-256 digest, bound to model and explain/review mode. No inference or cloud request occurs. Both cloud inference paths recollect context and compare the digest before sending. The fixed instructions and generated chair findings are disclosed as accompanying data. Source changes outside the bounded context are never transmitted.
- `GET /api/cloud/status`, `POST /api/cloud/connect`, `POST /api/cloud/disconnect`: cloud catalog/session management. Connect reads the fixed cloud catalog with a bounded key; no repository data is sent. The catalog may be public, so a saved key does not claim verified inference authorization. Disconnect erases in-memory key/catalog. Status and exports never expose credentials. Provider errors never echo response bodies, and redirects are forbidden.
- `POST /api/project/pick`: Windows-only, one static PowerShell STA invocation via argument-based execFile displays a folder chooser; no path or ref is interpolated. Validates the returned repository root; cancellation returns null, and timeout is bounded to two minutes. Other platforms use pasted paths.
- `src/ProjectPicker.tsx` remembers at most five successful project paths in browser local storage. A Forget recent action clears them; source is not stored.
- `ReviewPanel.tsx` owns quick/deeper modes and a native cloud-confirmation dialog with Escape, focus containment, and a required unchecked consent control. Keys are cleared from the password input when submitted and retained only in server memory. Provider selection defaults to local on reload. Local tags marked as cloud/remote are excluded to prevent accidental hosted inference through the local runtime.

Cloud transport follows [Ollama's official cloud API](https://docs.ollama.com/cloud). The provider can process the approved code; local-first is not a claim that explicitly selected cloud processing remains on the machine. Quick explanation and deeper review share the single-flight API limit. Findings retain diff citations, partial-run handling, bounded reviewer feedback, and existing local-only metadata storage.

Frontend requests retain the repository/comparison identity they began with. If a project is changed from the other workspace while AI is running, late previews, disclosures, results, and errors from the old input are discarded. Changing project/comparison also clears old ready notices and feedback. The active request still finishes on the server; this is result isolation, not inference cancellation.

The final stability pass uses requestTracker.ts to track input revisions, including switching away and back to the same input. Synchronous per-operation locks block repeated clicks before React rerenders. Scan/sample requests share a lock; AI and its preview use separate locks. Feedback additionally checks the original review ID before updating visible votes or totals. Model refresh, cloud connection/disconnection, and folder browsing also reject overlapping actions. These guards do not cancel inference already sent or add automatic retries.

Long quick-explanation paragraphs show their first 55 words with an explicit ellipsis and expandable full text. The actual model response remains in page memory and readable exports; this display preview is not a new model-generated summary.


## Scan coverage and readable failures

repositoryRoot accepts a selected subfolder only when its canonical real path is contained by the Git-reported canonical root. Reads remain bounded to that root, and analyzeRepository returns repoPath so the UI can show the actual project root. Dart source and bounded relative/local package imports are mapped; up to eight package roots use bounded pubspec.yaml reads. This remains pattern-based, not a complete Dart parser.

sourceScope.ts identifies conventional generated directories and brag-output-* exports. Untracked generated paths are excluded before the 20-file source cap and returned separately as generatedExcluded. Supported Dart untracked source is included. Genuine omitted/unreadable source still produces incomplete coverage. Tracked diffs retain Git's evidence as before.

The separate landing build (`dist-landing/`) and Vercel metadata (`.vercel/`) also count as generated paths. Building or deploying this project does not consume the untracked source preview budget.

Specialist parsing preserves valid findings and counts malformed entries, invalid citations/fields, and findings beyond the eight-entry bound in optional `agents[].rejectedFindings`. Any rejection forces `partial-review`, even if all requests completed. File-level concerns remain inspectable, but an invalid claimed line also marks the run incomplete. UI, exports, and response guards preserve this distinction; no new database content is stored.

`.github/workflows/ci.yml` configures clean installation, tests, both builds, and `smoke:install` on Windows/macOS/Linux with Node 22.13.0 and 24. It has read-only repository permissions, pinned actions, no inference calls, and no deployment step. Remote results must be inspected before release.

AIServiceError carries sanitized status-specific recovery text. The first cloud specialist runs before the other four to detect account/model denial. A denied first request aborts the run; failures later in a run preserve completed specialist results. When no specialists complete, the final model call is not made. Local specialists continue to run concurrently.

Disclosure responses add filename/document lists and a partial flag for human-readable consent. Their filenames describe the comparison; the expandable content remains the exact bounded outbound context and its digest remains the send guard. AppearanceControl replaces the select with Light/Dark/Auto pressed buttons; UseGuide supplies optional plain-language help without extra persistence or network calls.

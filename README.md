# Stxic Atlas

The final stability pass prevents overlapping scan/AI/setup actions and stale results after project changes, including switching away and back. Long explanations have a short display preview with expandable full text; downloads retain the original explanation. Reloading still starts a new page session, and a running server request may finish after the page leaves it.

**See what a change touches, and why.** Stxic Atlas is a local-first repository analysis demo that combines source-level import links with historical co-change signals to make a code change's possible impact easier to inspect.

## Run locally

Requirements: Node.js 22.13 or newer and Git. Local AI reviews also need [Ollama](https://ollama.com/) and an installed chat model.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5175/ (also reachable as http://localhost:5175/). Development uses a fixed loopback port and reports an error if it is occupied. The sample repository is synthetic and is available immediately. To analyze your own checkout, use **Browse folders** (Windows) or enter its absolute folder path in **Scan project**. The app reads tracked files and recent Git metadata on your machine; repository source is not sent to a service.

Use **Appearance** in the header to choose Light, Dark, or Auto. Auto follows your operating system; the preference is saved only in this browser. Switching between Impact map and AI change review preserves review inputs, results, feedback, and an in-progress request for the current page session.

The local API rejects non-loopback hostnames, remote origins, cross-site requests, and form POSTs. It accepts JSON requests from the local workspace, permits only one running review, and disables repository-configured Git filesystem-monitor helpers. These boundaries protect a local developer tool; the app is not designed to be exposed as a public repository-analysis service.

For a walkthrough without a model, open **AI change review → Explore example review**. This loads an explicitly synthetic discount/tax change with a finding, cited diff, specialist votes, and chair explanation. Example feedback is temporary and never changes the saved reviewer weights. Exports retain the `synthetic` flag.

To use **AI change review**, install and start Ollama, then download a local model. For example:

```sh
ollama pull qwen3.5:9b
```

Open the **AI change review** tab, enter your repository root, choose a base ref (defaults to `HEAD`), and optionally describe the change's purpose. The review compares the working tree with that ref and includes supported untracked source files. It supplies `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, and `docs/architecture.md` when present, and shows which documents were included. Five focused deeper-review passes use the selected model, followed by a final reviewer. Cloud checks access through the first pass before starting the other four. The findings, changed lines, model votes, weighted agreement, elapsed time, and Ollama token counts are shown together. Feedback adjusts agent weights gradually based on past ratings; feedback is stored in SQLite under `~/.change-atlas/feedback.sqlite` (Windows: `%LOCALAPPDATA%\.change-atlas\feedback.sqlite`).

Local AI sends context only to Ollama on `127.0.0.1:11434`. Optional Ollama Cloud sends the displayed, bounded code and context to `https://ollama.com/api/chat` only after explicit confirmation. Local inference still uses your computer's memory and processing time. The model's review is an interpretation, not proof: inspect the cited diff and run the project's own checks. Review runs also record latency and token usage, but the app does not train models, evolve prompts automatically, post GitHub comments, or provide a GitHub webhook/CI integration.

Each review sends at most 38,000 diff characters to every specialist and the chair. Oversized diffs, omitted untracked files, malformed specialist responses, or failed/incomplete chair responses produce **Partial review**, even when the completed passes return no findings. Token usage includes the chair. Feedback can only refer to saved findings; the server derives the participating reviewers from its own records.

## Checking edits without AI

Open **AI change review**, paste your project folder, and select **Check changes**. This uses Git only and lists changed files and line counts. **Current edits** compares with the latest commit; **Latest saved version** compares with its parent and needs at least two commits. **Advanced comparison** accepts a simple branch or commit ID. If there are no changes, the screen explains what to try next. Quoted Windows folder paths are accepted; GitHub URLs, missing folders, and folders without Git produce specific guidance.

Choose **Explain with AI** for one plain-language explanation: what changed, why it matters, and up to three suggested checks with valid changed-line citations. This is not a full review. Choose **Run deeper review** for five specialist passes and a final reviewer. Adding the intended behavior in the optional note helps the model understand your change. The larger installed `qwen3.5:9b` model is preferred when available; other installed models remain selectable. Small models may misread code. The elapsed timer indicates waiting time, not percent complete. Reports can be saved as readable text or JSON. AI can be wrong even when all passes complete.

## Checks

```sh
npm test
npm run build
```

The automated suite creates isolated synthetic Git repositories and checks import/history evidence, file boundaries, model-response failures, and SQLite feedback. It mocks model responses and does not require Ollama or write into your normal feedback database.

To verify the actual installed local model:

```sh
npm run smoke:review
# Optionally select a model explicitly:
npm run smoke:review -- qwen2.5-coder:1.5b
```

The smoke check creates a synthetic checkout and isolated feedback database under `.test-data/`, runs the five specialists and chair, and saves `report.json`. It leaves that checkout for inspection and exits unsuccessfully if any pass fails. The fixture is synthetic; the model responses are an actual local run. `.test-data/` is excluded from Git.

## What it demonstrates

- An interactive relationship map for source files.
- Structural links inferred from relative imports.
- Historical links inferred when files change in the same commits.
- A review view that lets you inspect the evidence behind a connection.
- A local-first AI review workflow with optional, explicitly confirmed Ollama Cloud with five specialist passes, weighted findings, a skeptical consensus-chair pass, and SQLite-backed feedback.
- A Git-diff review that labels user-provided intent and commit-message context separately from model interpretations.
- JSON export and a copyable review summary.
- A React and TypeScript interface backed by a Node.js service.

## Project documentation

- [Project context](PROJECT_CONTEXT.md)
- [Product definition](PRODUCT.md)
- [Design guide](DESIGN.md)
- [User flows](USER_FLOWS.md)
- [Architecture](ARCHITECTURE.md)
- [Contributor and coding-agent rules](AGENTS.md)
- [Verification results](VERIFICATION.md)
- [Final security and interface audit](AUDIT.md)

## How to read the signals

`IMPORT` is a relative source import found in the current checkout. `HISTORY` means two tracked source files appeared in the same commit at least twice in the analyzed commit window. A relationship suggests where to investigate; it does not predict a bug or prove that another file will break.

The starter analyzer inspects at most 400 recent commits and 140 tracked source files, displaying up to 28 of the most frequently touched files in its map. Very wide commits are limited to 60 analyzed source files when forming co-change pairs. Source reads are limited to 250,000 bytes for impact analysis and 150,000 bytes for untracked review files. Symlinks, including symlinked parent directories, are skipped. Co-change detection is deterministic and explainable. It does not execute repository code or upload source. The initial local analyzer focuses on relative JavaScript/TypeScript-style imports, including `.js` specifiers resolving to TypeScript source, plus relative/local-package Dart imports; other supported languages contribute file-level history. The review workflow is a local LLM aid; it can miss defects or return false positives, and incomplete agent runs are labeled as partial.

## Inspiration and distinction

This project takes cues from [Repo Visualizer](https://github.com/Jany-M/repo-visualizer), which makes repository evolution visible, and [git-history-ui](https://github.com/beingmartinbmc/git-history-ui), which brings local Git history into a browser. Stxic Atlas narrows the experience to a different job: inspect the evidence around one proposed change, combining current imports with co-change history in one reviewable map.

All repository names, people, counts, and sample findings in the default experience are synthetic.


## Optional cloud AI and easier setup

Local is the default and never falls back to cloud. Select **Where AI runs → Ollama Cloud**, enter your own Ollama API key, and choose a model returned by the live cloud catalog. The key is sent to the local server and kept only in its memory, until **Disconnect and clear key** or server restart. It is not put in browser storage, reports, SQLite, or source control. Listing models confirms catalog reachability; account authorization is checked by the first inference request. Provider usage limits and charges apply; see [Ollama Cloud](https://docs.ollama.com/cloud) and its [privacy policy](https://ollama.com/privacy).

Before every cloud explanation or deeper review, a native confirmation dialog displays the exact repository context: bounded diff, branch/comparison, optional intent, recent commit subjects, and bounded allowlisted documents. Stxic's fixed review instructions accompany that context; the final deeper-review request also includes generated findings. A SHA-256 digest binds confirmation to that context, model, and action. Changed context requires another preview. No automatic cloud retries or fallback occur, and redirects are rejected. Inspect for private code or secrets before confirming.

**Browse folders** opens the Windows folder chooser and validates a Git root. Cancellation keeps the existing folder; a two-minute timeout offers a paste-path fallback. Other operating systems can paste a path. Up to five successfully checked/selected project paths are saved in this browser; **Forget recent** removes them. No project source is saved there. Explanations retain their own exact diff for inspection and can be downloaded as text. A failed new request keeps the prior report; choosing another repository or comparison clears it.


## Easier scanning and getting started

Flutter/Dart projects are supported, including relative Dart imports and local package imports identified from a bounded pubspec.yaml. Selecting a subfolder resolves to its enclosing Git project; scanning shows the canonical project folder. Git is still required and project files are never modified. Generated untracked files in build/cache directories and brag-output-* exports do not use the 20-file source preview budget. The preview labels their exclusion. Real omitted source files still make coverage incomplete.

The header has Light, Dark, and Auto buttons. Auto follows the device; appearance stays browser-local. **New here? See how to use Stxic** and the help button explain project setup, saved versions, the map, local/cloud AI, and the optional deeper check in ordinary language.

Cloud confirmation starts with filenames and project notes. **View exact data being sent** expands the original inspectable context; the consent and context-change guard remain. Cloud access/model errors (including 402) stop further review calls when the first reviewer is blocked. Check the cloud account's allowance/access or explicitly choose local AI; scans never need cloud access. A failed review with no completed checks is not shown as a green success.

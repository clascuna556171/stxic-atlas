# Stxic Atlas

**See what a change touches, and why.** Stxic Atlas is a local-first repository analysis demo that combines source-level import links with historical co-change signals to make a code change's possible impact easier to inspect.

## Run locally

Requirements: Node.js 22.13 or newer and Git. Local AI reviews also need [Ollama](https://ollama.com/) and an installed chat model.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5175/ (also reachable as http://localhost:5175/). Development uses a fixed loopback port and reports an error if it is occupied. The sample repository is synthetic and is available immediately. To analyze your own checkout, enter its absolute folder path in **Scan project**. The app reads tracked files and recent Git metadata on your machine; repository source is not sent to a service.

Use **Appearance** in the header to select System, Light, or Dark. System follows your operating system; the preference is saved only in this browser. Switching between Impact map and AI change review preserves review inputs, results, feedback, and an in-progress request for the current page session.

The local API rejects non-loopback hostnames, remote origins, cross-site requests, and form POSTs. It accepts JSON requests from the local workspace, permits only one running review, and disables repository-configured Git filesystem-monitor helpers. These boundaries protect a local developer tool; the app is not designed to be exposed as a public repository-analysis service.

For a walkthrough without a model, open **AI change review → Explore example review**. This loads an explicitly synthetic discount/tax change with a finding, cited diff, specialist votes, and chair explanation. Example feedback is temporary and never changes the saved reviewer weights. Exports retain the `synthetic` flag.

To use **AI change review**, install and start Ollama, then download a local model. For example:

```sh
ollama pull qwen3.5:9b
```

Open the **AI change review** tab, enter your repository root, choose a base ref (defaults to `HEAD`), and optionally describe the change's purpose. The review compares the working tree with that ref and includes supported untracked source files. It supplies `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, and `docs/architecture.md` when present, and shows which documents were included. Five focused passes use the same local model, followed by a skeptical chair pass. The findings, changed lines, model votes, weighted agreement, elapsed time, and Ollama token counts are shown together. Feedback adjusts agent weights gradually based on past ratings; feedback is stored in SQLite under `~/.change-atlas/feedback.sqlite` (Windows: `%LOCALAPPDATA%\.change-atlas\feedback.sqlite`).

The diff and intent are sent only to the Ollama server on `127.0.0.1:11434`; no cloud model or API key is used. Local inference still uses your computer's memory and processing time. The model's review is an interpretation, not proof: inspect the cited diff and run the project's own checks. Review runs also record latency and token usage, but the app does not train models, evolve prompts automatically, post GitHub comments, or provide a GitHub webhook/CI integration.

Each review sends at most 38,000 diff characters to every specialist and the chair. Oversized diffs, omitted untracked files, malformed specialist responses, or failed/incomplete chair responses produce **Partial review**, even when the completed passes return no findings. Token usage includes the chair. Feedback can only refer to saved findings; the server derives the participating reviewers from its own records.

## Checking edits without AI

Open **AI change review**, paste your project folder, and select **Check changes**. This uses Git only and lists changed files and line counts. **Current edits** compares with the latest commit; **Latest saved commit + edits** compares with its parent and needs at least two commits. **Advanced comparison** accepts a simple branch or commit ID. If there are no changes, the screen explains what to try next. Quoted Windows folder paths are accepted; GitHub URLs, missing folders, and folders without Git produce specific guidance.

Choose **Explain with AI** for five local reviews and a final summary. Adding the intended behavior in the optional note helps the model understand your change. The larger installed `qwen3.5:9b` model is preferred when available; other installed models remain selectable. Small models may misread code. The elapsed timer indicates waiting time, not percent complete. Reports can be saved as readable text or JSON. AI can be wrong even when all passes complete.

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
- A local-only AI review workflow with five specialist passes, weighted findings, a skeptical consensus-chair pass, and SQLite-backed feedback.
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

The starter analyzer inspects at most 400 recent commits and 140 tracked source files, displaying up to 28 of the most frequently touched files in its map. Very wide commits are limited to 60 analyzed source files when forming co-change pairs. Source reads are limited to 250,000 bytes for impact analysis and 150,000 bytes for untracked review files. Symlinks, including symlinked parent directories, are skipped. Co-change detection is deterministic and explainable. It does not execute repository code or upload source. The initial local analyzer focuses on relative JavaScript/TypeScript-style imports, including `.js` specifiers resolving to TypeScript source; other languages still contribute file-level history. The review workflow is a local LLM aid; it can miss defects or return false positives, and incomplete agent runs are labeled as partial.

## Inspiration and distinction

This project takes cues from [Repo Visualizer](https://github.com/Jany-M/repo-visualizer), which makes repository evolution visible, and [git-history-ui](https://github.com/beingmartinbmc/git-history-ui), which brings local Git history into a browser. Stxic Atlas narrows the experience to a different job: inspect the evidence around one proposed change, combining current imports with co-change history in one reviewable map.

All repository names, people, counts, and sample findings in the default experience are synthetic.

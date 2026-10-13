# Stxic Atlas project context

## What this project is

Stxic Atlas is a local-first web app for understanding the likely impact of a code change. It combines two distinct tools:

1. **Impact map:** deterministic signals from a repository's current source imports and recent Git history.
2. **AI change review:** a quick plain-language explanation followed by an optional deeper review with five specialists and a skeptical chair, using local Ollama by default or explicitly confirmed Ollama Cloud that checks proposed findings against the diff.

The product is a portfolio project for demonstrating full-stack engineering, explainable analysis, local AI orchestration, and careful handling of uncertainty.

## Who it is for

Engineers exploring an unfamiliar repository or preparing to explain a change to someone else. Recruiters and reviewers should be able to explore the synthetic example first, then understand how local repository analysis and optional local AI review work.

## Product promise

Show what evidence led to a signal. Keep scanning local; require an outgoing-context preview and confirmation before optional cloud inference. Clearly label synthetic data, deterministic facts, user-provided context, Git metadata, and model interpretations.

## Current scope

- Synthetic sample data can be explored without a repository or model.
- Impact analysis reads a local Git repository and uses bounded recent history and a limited source-file set.
- AI change review compares working-tree changes with a selected Git ref using local Ollama.
- Review feedback is stored in a local SQLite database and adjusts specialist weights within bounded limits.
- Findings can be inspected against the exact diff and exported as JSON.
- A visibly synthetic review walkthrough works without Ollama. Its feedback stays in memory and cannot tune real reviewer weights.
- Malformed responses, failed chair passes, truncated diffs, and omitted untracked files produce an incomplete review state.

## Not implemented

The original idea brief describes possible CLI, webhook, GitHub comment, CI, static-analysis-tool, prompt-evolution, and golden-dataset features. These are ideas, not current capabilities. Do not present them as implemented. The user approved optional Ollama Cloud with their own key; no other hosted integration is implemented. The app currently does not train a model or automatically rewrite prompts and heuristics.

## Documents

- [Product definition](PRODUCT.md) — audience, purpose, constraints, and principles.
- [Design guide](DESIGN.md) — visual direction and UI behavior.
- [User flows](USER_FLOWS.md) — the user journeys and their boundaries.
- [Architecture](ARCHITECTURE.md) — current runtime and data flow.
- [Contributor rules](AGENTS.md) — instructions for coding agents and contributors.
- [README](README.md) — setup and user-facing operating instructions.


## Explanation and setup

A single-pass explanation describes what changed, why it matters, and suggested checks tied to changed lines. It is separate from deeper review. Windows folder browsing, five browser-local recent paths, AI readiness, and cloud key connection controls simplify setup. Cloud keys exist only in local server memory; scans and change previews never call cloud AI.

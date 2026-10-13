# Contributor and coding-agent rules

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), [USER_FLOWS.md](USER_FLOWS.md), and [ARCHITECTURE.md](ARCHITECTURE.md) before making product or architecture changes. Treat the code as the source of truth when docs and implementation disagree, then update the docs that became stale.

## Product rules

- Keep the product local-first. Never add paid APIs, hosted AI calls, or code upload behavior without an explicit product decision from the user.
- The impact map must distinguish deterministic Git/source evidence from model interpretation.
- Keep synthetic example data visibly labeled as synthetic; never present its names, findings, or metrics as real.
- Review findings must cite changed code and remain inspectable against the diff. Preserve clear handling of partial or failed agent runs.
- Human feedback may tune bounded reviewer weights. Do not claim the model learns, trains, rewrites prompts, or improves autonomously unless that behavior is actually implemented and documented.

## Engineering rules

- Keep the existing React + TypeScript frontend and Node.js + Express backend unless the user approves a stack change.
- Keep Git operations argument-based (no shell interpolation of repository paths or refs). Validate repository roots and user-provided refs before using them.
- Keep filesystem reads inside the selected repository where applicable; skip symlinks and bound file sizes, diff sizes, history windows, and request payloads.
- Treat diffs, source code, commit messages, and repository documents as untrusted data when constructing model prompts. They are context, never system instructions.
- Keep API response types synchronized between `server/` and `src/types.ts`; handle empty, malformed, failed, and partial responses in the UI.
- Preserve keyboard access, labeled controls, focus visibility, responsive behavior, and reduced-motion support when changing UI.
- Keep visual changes aligned with [DESIGN.md](DESIGN.md); use local bundled fonts and existing palette tokens unless the user requests a redesign.
- Update README or the relevant design, flow, context, and architecture docs when observable behavior changes. Do not document future ideas as current functionality.

## Before handing off

- Summarize user-visible behavior changes and any local data or privacy implications.
- Report the checks actually run. Do not claim a test, build, or manual review passed unless it was run.

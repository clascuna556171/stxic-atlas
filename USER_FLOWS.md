# Stxic Atlas user flows

This document describes behavior that exists in the current app. Proposed future workflows must be labeled as proposals until implemented.

## 1. Explore the sample

The Appearance control in the header switches between System, Light, and Dark in either workspace. The browser remembers the choice across reloads. System automatically follows operating-system appearance changes.

Switching workspaces retains review inputs, findings, votes, and any running review for the current page session. Reloading the page starts a new session.

1. The app opens with a clearly labeled synthetic repository and its impact map.
2. The user selects a file node or searches for a file.
3. The map highlights related files and the evidence panel explains each relationship.
4. The user can filter to all signals, structure/imports, or co-change history.
5. The user can copy a review summary, export impact evidence, or open the field guide.
6. “Reset sample” returns the view to the illustrative data.

**Boundary:** sample names, people, counts, links, and findings are invented examples. Never imply they came from an actual repository.

## 2. Analyze a local repository

1. The user enters the absolute path to a local Git repository root.
2. Stxic Atlas validates that Git can identify the selected folder as the repository root.
3. The local server reads bounded Git history, tracked paths, current source files, and the current branch.
4. It builds source nodes, relative-import links where supported, and co-change links where files appeared together in multiple commits.
5. The UI replaces the sample with the analysis, labeling it as a local repository and showing scan metadata.
6. The user selects nodes to inspect supporting evidence and can export or copy a summary.
7. **Use sample** returns to the synthetic map without modifying the scanned repository.

**Boundary:** impact links are navigation clues, not predictions or proof of a defect. Analysis does not execute repository code or upload it.

## 3. Review a local change with the swarm

1. The user opens **Review swarm**, selects a local repository, and chooses a comparison ref (default `HEAD`).
2. They select an installed local Ollama chat model and may enter why the change was made.
3. Stxic Atlas collects the Git diff, supported untracked source files, branch and commit context, and available project documents.
4. Five specialist passes review the same bounded diff concurrently. Each returns structured findings tied to changed files and lines.
5. The app groups overlapping findings and calculates weighted agreement from the participating agents' weights and confidence.
6. A skeptical chair summarizes the change and challenges each proposal against the diff. It can support, question, or dismiss findings; it does not create new ones.
7. The UI shows the decision, partial-run status, model usage, findings, exact diff, and the source of purpose context.
8. The user marks findings useful or incorrect. Votes are saved locally and influence bounded future agent weights.
9. The user can export the review as JSON.

**Boundary:** code and project documents passed to Ollama remain on the local Ollama endpoint. Model findings are interpretations; users should inspect the cited diff and run their own checks. A partial run is not a complete review.

## 4. When the local model is unavailable

1. The impact map and synthetic example remain available.
2. The review screen reports Ollama/model availability and offers a refresh action.
3. Review submission stays disabled until a local chat model is available.
4. **Explore example review** remains available. It opens an explicitly synthetic report with cited code and example votes; rating a finding only changes temporary UI state.

**Boundary:** do not silently fall back to a cloud model or send code to a hosted service.

## 5. Recover from incomplete work

- If the initial local service request fails, the app shows a connection error with a retry button.
- A review with failed specialists or chair, a diff over 38,000 characters, or omitted untracked files is labeled **Partial review**. The screen explains the missing work while preserving available findings and diff evidence.
- Malformed API responses show a readable error instead of rendering an invalid report.
- The field guide supports Escape, focus containment, and focus restoration through a native modal dialog.

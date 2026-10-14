# Stxic Atlas user flows

This document describes behavior that exists in the current app. Proposed future workflows must be labeled as proposals until implemented.

## Public introduction

The Vercel landing page works without the local service. Explore an example scrolls to a visibly synthetic file map. Select a file using pointer, Enter, or Space and filter All/Imports/History to inspect its fictional connections. A no-connections state names the next action. The separate review walkthrough switches between a plain synthetic explanation and its cited synthetic diff; no model runs.

Run locally and Use your own project lead to setup commands, requirements, and the repository setup guide. Copy commands reports success or offers manual selection if the clipboard is unavailable. Native FAQ disclosures work with the keyboard. Appearance is stored only in this site's browser origin. The page does not request local API access, repository paths, credentials, or source files.

## 1. Explore the sample

The Appearance control in the header switches between Light, Dark, and Auto in either workspace. The browser remembers the choice across reloads. Auto automatically follows operating-system appearance changes.

Switching workspaces retains review inputs, findings, votes, and any running review for the current page session. Reloading the page starts a new session.

1. The app opens with a clearly labeled synthetic repository and its impact map.
2. The user selects a file node or searches for a file.
3. The map highlights related files and the evidence panel explains each relationship.
4. The user can filter to all signals, structure/imports, or co-change history.
5. The user can copy a review summary, export impact evidence, or open the field guide.
6. “Reset sample” returns the view to the illustrative data.

**Boundary:** sample names, people, counts, links, and findings are invented examples. Never imply they came from an actual repository.

## 2. Analyze a local repository

1. The user chooses Browse folders on Windows, selects a recent project, or enters the absolute path to a local Git repository root.
2. Stxic Atlas validates that Git can identify the selected folder as the repository root.
3. The local server reads bounded Git history, tracked paths, current source files, and the current branch.
4. It builds source nodes, relative-import links where supported, and co-change links where files appeared together in multiple commits.
5. The UI replaces the sample with the analysis, labeling it as a local repository and showing scan metadata.
6. The user selects nodes to inspect supporting evidence and can export or copy a summary.
7. **Use sample** returns to the synthetic map without modifying the scanned repository.

**Boundary:** impact links are navigation clues, not predictions or proof of a defect. Analysis does not execute repository code or upload it.

Change preview and AI context collection stop before diffing when tracked files use configured Git clean/process filters. The message offers a separate checkout without those filters; file connections remain available. Git settings are never changed. Unused global filters do not block an unrelated project.

## 3. Review a local change with the swarm

The screen is labeled **AI change review**. Choose Current edits, Latest saved version, or Advanced comparison. **Check changes** lists files and shows the bounded diff without AI. No-change and invalid-baseline states offer a concrete next step. **Explain with AI** performs one plain explanation; **Run deeper review** performs five specialist passes and the final reviewer. Both check the change again before starting; no edits means no inference. It shows elapsed waiting time and keeps the prior report if the request fails. **Save readable report** downloads text; **Export JSON** retains the structured data. Example loading clears any real preview to keep their sources separate.

1. The user opens **AI change review**, selects a local repository, and chooses a comparison ref (default `HEAD`).
2. They select an installed local Ollama chat model and may enter why the change was made.
3. Stxic Atlas collects the Git diff, supported untracked source files, branch and commit context, and available project documents.
4. Five specialist passes review the same bounded diff. Local passes run concurrently; cloud runs the first pass before starting the other four. Each returns structured findings tied to changed files and lines.
5. The app groups overlapping findings and calculates weighted agreement from the participating agents' weights and confidence.
6. A skeptical chair summarizes the change and challenges each proposal against the diff. It can support, question, or dismiss findings; it does not create new ones.
7. The UI shows the decision, partial-run status, model usage, findings, exact diff, and the source of purpose context.
8. The user marks findings useful or incorrect. Votes are saved locally and influence bounded future agent weights.
9. The user can export the review as JSON.

**Boundary:** local code and project documents passed to local Ollama remain on the computer. Cloud mode transmits approved context to Ollama Cloud, after the confirmation flow below. Model findings are interpretations; users should inspect the cited diff and run their own checks. A partial run is not a complete review.

## 4. When the local model is unavailable

1. The impact map and synthetic example remain available.
2. The review screen reports Ollama/model availability and offers a refresh action.
3. Local AI submission stays disabled until a local chat model is available. The user may explicitly choose and connect Ollama Cloud instead.
4. **Explore example review** remains available. It opens an explicitly synthetic report with cited code and example votes; rating a finding only changes temporary UI state.

**Boundary:** do not silently fall back to a cloud model or send code to a hosted service.

## 5. Recover from incomplete work

- If the initial local service request fails, the app shows a connection error with a retry button.
- A review with failed specialists or chair, rejected model findings/citations, a diff over 38,000 characters, or omitted untracked files is labeled **Partial review**. The screen explains the missing work while preserving available findings and diff evidence. Completed requests with rejected findings cannot produce a clean result.
- Malformed API responses show a readable error instead of rendering an invalid report.
- The field guide supports Escape, focus containment, and focus restoration through a native modal dialog.


## 6. Quick explanation and optional cloud

Choose a project → Check changes → Explain with AI. A single pass shows What changed, Why it matters, and What should I check. Each returned check must cite an added line; invalid checks are removed and the explanation is marked incomplete. Open the supporting excerpt or exact explanation diff, or save a readable explanation. Run deeper review is a separate action and preserves existing inspectable findings. Changing the project/comparison clears old results; failed requests for the same inputs preserve available reports.

Local AI is the default. To use cloud, explicitly select Ollama Cloud, connect a personal key, and choose a listed model. An explanation or deeper review first opens a native dialog showing exact outgoing repository context, destination, model, request count, and usage notice. Consent starts unchecked. Cancel/Escape sends nothing. Confirming sends only if freshly read context still matches the displayed preview. Any mismatch, provider failure, or disconnected key offers an error; there is no local/cloud fallback. Disconnect clears the server's key.

Windows folder browsing preserves the current selection when cancelled and validates a chosen Git root. A timed-out chooser offers the pasted-path alternative. Successful selections/checks populate up to five recent browser-local paths; Forget recent removes them.

If the project changes through File connections during AI work, the request finishes but its old result is not placed under the new project. Previous ready messages, findings, and votes clear with a changed project/comparison. This does not cancel inference already in progress.

Switching away and back to the original folder/comparison still invalidates the old request. Repeated clicks do not start duplicate scans or AI work. A delayed rating response cannot change a newer report's visible votes. Long explanations can be expanded with Read full explanation, and saving an explanation includes the original full paragraphs.


## 7. Scan a Flutter project and recover from cloud failure

Choose a project or a subfolder inside it. Stxic resolves and displays the Git project root, reads supported tracked source including Dart, and maps relative/local-package Dart imports where possible. Generated untracked build/cache/export outputs are labeled as intentionally excluded; they do not crowd source files out of the preview. When only generated outputs changed, the preview correctly says no source edits were found. Choose Latest saved version to inspect already committed work.

Cloud denial returns a clear account/model-access error and leaves the factual preview usable. If the first cloud reviewer is denied, remaining specialist/final calls are not started. No automatic local fallback occurs. Check the cloud account or choose local AI explicitly. A report with zero completed checks states that AI could not check the change.

The header buttons select Light/Dark/Auto with keyboard support and a visible selected state. New here? and the help dialog explain how to choose a folder, see changed files, get an explanation, and interpret file connections. Cloud confirmation lists changed filenames and included project notes, with exact context under an expandable detail. Existing consent and cancellation still apply.

# Public release checklist

This checklist separates configured checks from completed verification. See
[verification.md](verification.md) for actual results and limits.

## Implemented

- Active Git clean/process filters stop change previews before programs execute; ordinary
  projects with unused filter configuration remain supported.
- Invalid specialist output produces an incomplete report while preserving valid findings.
- Apache-2.0 LICENSE/NOTICE, contribution guidance, sanitized bug template, and security policy.
- Read-only, pinned-action CI matrix for fresh installation, tests, both builds, and
  installation smoke on Windows/macOS/Linux with Node 22.13.0 and 24. No AI or deployment.
- Reproducible `npm ci` instructions in both README and landing page.

## Before announcing a downloadable/local-app release

- [ ] Push the reviewed change and inspect all six CI matrix results. A configured workflow is not a passed run.
- [ ] Enable and verify GitHub private vulnerability reporting, or provide a working private contact.
- [x] Run a real local-model smoke check with an installed model. `qwen2.5-coder:1.5b`
  completed all passes but returned invalid output, so the report correctly stayed partial.
  This verifies orchestration and failure labeling, not finding accuracy.
- [ ] Check the updated incomplete-review text in the browser with keyboard navigation.
- [ ] Review the release notes, supported platforms, limits, and privacy boundaries.

Do not publish the local repository API. Deploy only `dist-landing/` to public hosting.
Source, diffs, and credentials must never appear in bug reports or CI artifacts.

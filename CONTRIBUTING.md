# Contributing

Read AGENTS.md and the linked product, design, flow, and architecture documents first.
Keep repository analysis local, preserve explicit cloud consent, and label synthetic fixtures.

Use Node 22.13 or newer and Git. Install the locked dependencies with `npm ci`.
Before submitting a change, run:

```sh
npm test
npm run build
npm run build:landing
npm run smoke:install
npm audit
git diff --check
```

The GitHub workflow runs fresh installations, tests, both builds, and the installation
smoke check on Windows, macOS, and Linux with Node 22.13.0 and Node 24.
Configured checks are not evidence of a passed run; inspect the actual workflow results.

Explain the observable behavior change, include a small synthetic reproduction for bugs,
and update the affected documentation. Never attach private repository code, credentials,
or unsanitized reports. Use SECURITY.md for vulnerabilities.

Contributions are provided under the project's Apache-2.0 license.

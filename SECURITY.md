# Security policy

Security fixes target the current main branch. There is no published long-term support schedule.

## Private reports

Use [GitHub private vulnerability reporting](https://github.com/clascuna556171/stxic-atlas/security/advisories/new)
when the repository's Security tab offers **Report a vulnerability**. Availability depends
on the repository setting; adding this policy does not enable it.

If that option is unavailable, open an issue asking the maintainer to enable private
reporting. Include only that request, with no vulnerability details, proof of concept,
source code, paths, keys, or logs. Wait for a private channel before sharing the report.

A private report should describe the affected commit, impact, and minimal synthetic
reproduction. Remove credentials and private project data. Response times are not guaranteed.

## Maintainer setup

Before public release, enable Private vulnerability reporting in repository
Settings → Security → Advanced Security, then verify that Report a vulnerability
is available to another GitHub account. See [GitHub's setup instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

## Boundaries

The repository service binds to loopback and is intended for local use. Do not expose it
through public hosting or a network tunnel. The separately hosted landing page has no
repository API. Local Git/source reads are bounded; active clean/process filters stop
change previews before helpers run. Explicitly chosen cloud AI can process the approved
context, while local AI remains local. Model output is fallible, including a complete review.

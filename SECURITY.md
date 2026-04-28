# Security Policy

## Reporting a Vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

To report a vulnerability:
- Use the **"Report a vulnerability"** button on the Security tab of this repository (GitHub private advisory)
- Or email: bb@cocode.dk

We will acknowledge within 5 business days and aim to release a fix within 30 days of confirmation.

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅ |
| older   | ❌ |

## Scope

This project drives a logged-in browser against linkedin.com. Out of scope for this advisory channel:

- LinkedIn-side rate-limit or anti-automation issues — report to LinkedIn directly.
- Issues that require access to a stolen `.profile/` directory (the user-data dir is gitignored and lives only on the user's machine).
- Vulnerabilities in upstream dependencies — please file with the upstream project.

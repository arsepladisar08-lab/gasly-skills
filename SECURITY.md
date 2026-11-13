# Security Policy

GASLY Skills includes example architecture and Google Apps Script boilerplate. It is not a hosted service, and copying a skill or template does not automatically make an application secure.

## Supported versions

Security fixes are generally targeted at the latest published version of GASLY Skills. Users should update to the latest source and generated packages before reporting an issue as reproducible.

## Reporting a vulnerability

Please do not publish credentials, exploitable details, private user data, or a working exploit in a public issue.

Use GitHub's private vulnerability reporting / Security Advisories for this repository when that feature is available. Otherwise, contact the repository owner through the contact options on the GitHub profile and include:

- A concise description and potential impact.
- The affected file, package, version, or generated template.
- Reproduction steps or a minimal proof of concept.
- Any suggested mitigation.

Please allow a reasonable opportunity to investigate and prepare a fix before public disclosure. Do not access, modify, or disclose data belonging to other users while testing.

## Important deployment boundary

The included CRUD boilerplate is a single-tenant baseline. It does not implement per-record tenant ownership or role-specific read filtering. Before deploying an application:

- Restrict who can access the web app.
- Configure and verify the owner identity manually in Apps Script Script Properties.
- Do not treat an admin PIN as the only security boundary for an application exposed to Anyone.
- Add server-side authentication, authorization, and read-scoped data access for multi-user or sensitive workflows.
- Keep API keys, OAuth tokens, and other secrets out of source files, Sheets shared with users, browser code, logs, and public issue reports.
- Review Apps Script deployment settings, OAuth scopes, and spreadsheet sharing permissions.

A passing local test suite does not establish production security. The project does not claim that the templates have undergone a penetration test or a live production security audit.

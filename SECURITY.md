# Security policy

## Reporting a vulnerability

Use [GitHub's private security advisory flow](https://github.com/danjonesio/docs-dot-artofinfra/security/advisories/new). That gives us a private channel to triage, fix, and coordinate disclosure before details go public.

Please don't open a regular issue or post on Discord for anything you'd describe as a security vulnerability. Public reports give attackers a head start and don't necessarily reach a maintainer any faster.

Expect a first response within 72 hours. If you don't hear back, ping the Discord (without sharing the vulnerability details) and mention you've filed an advisory.

## What's in scope

- **`@artofinfra/install` npm package.** Supply-chain integrity, malicious code execution during install, files written outside the intended target paths.
- **`docs.artofinfra.com` (the markdown content delivery).** Cross-site issues, content injection, or anything that could trick an AI agent fetching docs into doing something other than reading rules.
- **The Astro homepage at `docs.artofinfra.com/`.** Standard web vulns (XSS, etc.).
- **GitHub repository and CI flow.** Branch protection bypasses, action-of-action vulnerabilities, anything that could let an unauthorized contributor publish to npm or change deployed docs.

## What's out of scope

- **Specific rule correctness in the docs.** If a rule has a wrong command, that's a bug, not a security issue. Open a [Doc bug issue](https://github.com/danjonesio/docs-dot-artofinfra/issues/new?template=doc-bug.yml) instead. We absolutely treat content correctness as serious; it just doesn't go through the security advisory flow.
- **AI agents acting on rules in ways their operators didn't intend.** The rules are reference material; AI behaviour is the responsibility of the agent and its operator.
- **Third-party services we link to** (OpenCode session shares, Discord, the Ghost blog at artofinfra.com).

## Supported versions

- **Docs**: only the current state of `main` is supported. There's no LTS branch.
- **`@artofinfra/install`**: the most recent version published to npm. Older versions don't receive backports; users should run `npx @artofinfra/install` to get the latest.

## Coordinated disclosure

After we've shipped a fix:

1. We'll publish the GitHub advisory with credit (or anonymously, if you prefer).
2. If the issue affects the npm package, a patched version goes to the registry under a fresh version number.
3. If the issue affects deployed content or the homepage, the fix lands in a PR and ships via the normal Cloudflare deploy.
4. We'll mention the fix in the changelog / release notes (if and when we add those) but won't share exploitation details that would help opportunistic attackers chase users who haven't updated.

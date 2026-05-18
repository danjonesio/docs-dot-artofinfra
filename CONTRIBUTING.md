# Contributing

This guide covers contributions to the **content** in this repo: the markdown rules under `docs/` that AI agents fetch from `docs.artofinfra.com`. Changes to the homepage or build tooling are handled by maintainers and aren't covered here.

## Quick start

1. Fork the repo at <https://github.com/danjonesio/docs-dot-artofinfra>
2. Edit or add a markdown file under `docs/{category}/`
3. Update that category's `index.md` if you added a new file
4. Open a PR. A maintainer reviews; nothing goes public until your PR is merged.

No build step. No test suite. Just markdown.

## Repository layout (content tree)

```
docs/
├── router.md              # Skill instructions + category routing table
├── cisco/                 # ios-xe, nxos, asa
├── juniper/               # junos, srx
├── general/               # Vendor-agnostic: bgp, ospf, vxlan, acl-design, qos, hardening
├── iac/                   # terraform, ansible, nornir
├── python/                # netmiko, scrapli, jinja-templates
├── netbox/                # data-modeling, ipam, automation, custom-scripts, config-contexts
└── workflows/             # How to approach a class of task: audit, picker, diff, document, validate
```

Each category has an `index.md` listing its docs. Each topical doc is a single self-contained file. New rules go into an existing category if one fits; otherwise see "Adding a new category" below.

## What we want

- **New vendor coverage.** Arista EOS, MikroTik RouterOS, FortiGate, PAN-OS, Aruba CX, Sonic, etc.
- **Better rules in existing docs.** Real-world gotchas, edge cases, things vendor docs gloss over.
- **New workflows.** Any reusable "how to approach this kind of task" pattern.
- **Corrections.** A wrong config block, a deprecated command, a rule that doesn't apply to a specific platform version.

## What we don't want

- Reference material. Documenting every option of a feature belongs on the vendor's site, not here.
- Hedge text. "Consider using X" is useless. Either it's a rule or it isn't.
- Tutorial copy. There are a thousand "BGP for beginners" articles. This isn't that.
- Marketing language. No "leverage", no "synergy", no "industry-leading". Plain words only.

## Doc format

Every topical doc follows this structure:

````markdown
# Title

One-paragraph intro: what this is about and when to use it.

## Rule 1: Short imperative title

Explanation of the rule.

```cisco
! config example
```

## Rule 2: ...

## Dangerous patterns to avoid

- Pattern A: why it's dangerous, what to do instead
- Pattern B: ...
````

Read any existing doc (e.g. `docs/cisco/ios-xe.md`, `docs/general/bgp.md`) before writing a new one. The tone, structure, and verb choices are part of the brand.

## Conventions

- **File names**: kebab-case lowercase (`ios-xe.md`, not `IOS_XE.md` or `iosXE.md`).
- **Code fences must specify a language tag**: `cisco`, `junos`, `routeros`, `bash`, `yaml`, `python`, etc. Never a bare ```` ``` ````.
- **Keep docs short.** If a doc grows past roughly 500 lines, split into subtopics.
- **No em dashes anywhere.** Use hyphens, commas, colons, or restructure the sentence. Em dashes read as AI slop in this project's voice.
- **No emojis** in docs or commit messages.
- **Reference other docs by their full HTTPS URL** (`https://docs.artofinfra.com/cisco/ios-xe.md`), not relative paths. AI clients fetch by absolute URL.

## Content quality bar

Wrong rules here become wrong configs in real networks. Treat content like production code.

- **Self-verify networking claims** against vendor documentation or existing content before finalizing. Trace through edge cases in every config block.
- **Config blocks must be real.** Every code block must contain valid, deployable syntax. No `! TODO` stubs, no placeholder scaffolding. If a value is environment-specific, mark it clearly (e.g. `<KEY>`, `<ip>`, `${VAR}`).
- **Flag uncertainty.** If you're unsure about syntax or a behavioural claim, say so explicitly in the doc. A correct but narrow doc is better than a confident but wrong one.
- **Don't silently generalize.** A rule on IOS-XE may not apply to NX-OS. Verify per platform before reusing wording.

## Multi-file change order

When you're adding a doc, touch files in this order and confirm each before moving on:

1. Write the new doc at `docs/{category}/{topic}.md`
2. Add a one-line entry linking to it in `docs/{category}/index.md`
3. If you're adding a new category, also add a row to `docs/router.md`'s category table

This order means the doc exists before anything links to it, so previews don't 404 on you.

## Adding a new category

Most contributions fit an existing category. If you genuinely need a new one (a new vendor family, a substantively different topic), the steps are:

1. Create `docs/{newcategory}/index.md` with an intro paragraph and an empty `## Available docs` list
2. Add at least one real doc inside it (the new category shouldn't ship empty)
3. Add a row to `docs/router.md`'s category table
4. In the PR description, explain why the new category is needed and what doesn't fit existing categories

A maintainer will also update the homepage's `Coverage` section so the new category appears there. You don't need to touch that yourself.

## PR process

- Open the PR against `main`.
- **Nothing about your branch is publicly deployed.** No preview URL, no `*.pages.dev` link. Only merges to `main` ship to `docs.artofinfra.com`.
- A maintainer reviews for technical accuracy, format compliance, and tone. If the PR touches multiple files or complex config, the maintainer may pull the branch locally to test (`gh pr checkout <pr-number>` then verify in their own environment). You don't need to do anything to make that work.
- Expect requests for tightening, not rejection. Vague PRs may get questions like "is this a hard rule or a suggestion?"
- Once merged to `main`, the docs are live at `https://docs.artofinfra.com/...` within minutes. AI clients pick up the new rules on their next fetch.

If you want to preview your own changes locally before opening the PR, you can build the homepage and the docs together: `cd web && npm install && npm run dev`. Your changes appear at `http://localhost:4321/{category}/{topic}.md`. This is local-only and gives you a fast iteration loop without exposing anything publicly.

## Questions

Fastest is the Discord: <https://discord.artofinfra.com>. For longer-form discussion, especially scoping new vendor coverage where the boundaries aren't obvious, open an issue at <https://github.com/danjonesio/docs-dot-artofinfra/issues>.

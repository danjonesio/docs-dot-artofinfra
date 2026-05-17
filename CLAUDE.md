# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The canonical content for the **Art of Infra** AI skill, served at `https://docs.artofinfra.com`. A free, open-source body of opinionated networking and infrastructure best practices that AI coding assistants fetch on demand.

This is primarily a **content repository**. There is no backend, auth, database, MCP server, or test suite. Cloudflare Pages serves the markdown files directly over HTTPS, and AI clients fetch them via a small `SKILL.md` installed in the user's agent (Claude Code, Cursor, Codex, OpenCode, Amp).

The repo also has a small Astro + Tailwind build at the root that produces a marketing landing page at `docs.artofinfra.com/`. The build copies all of `docs/` through verbatim (Astro's `publicDir`), so the markdown URL structure that AI clients depend on is unchanged.

Companion to the Ghost blog at `artofinfra.com`. The blog is human-readable long-form; this repo is AI-readable short-form rules.

## How it works (request flow)

1. User installs the Art of Infra skill in their agent
2. User invokes `/artofinfra` and asks an infrastructure question
3. AI fetches `https://docs.artofinfra.com/router.md` (skill instructions and routing table)
4. Router lists categories. AI fetches the relevant category index, e.g. `https://docs.artofinfra.com/cisco/index.md`
5. Category index lists docs. AI fetches the specific doc, e.g. `https://docs.artofinfra.com/cisco/ios-xe.md`
6. AI applies the rules from the doc in its response

Three-level hierarchy:
- **Router** (`router.md`): skill instructions and category list. Changes only when adding a new category.
- **Category index** (`{category}/index.md`): list of docs in that category. Changes when adding or removing docs.
- **Doc** (`{category}/{topic}.md`): the actual opinionated rules.

URLs are full `https://docs.artofinfra.com/...` URLs. There is no custom URI scheme. The AI uses ordinary `WebFetch` (or equivalent) to retrieve them.

## Repository layout

```
/
├── README.md
├── CLAUDE.md
├── AGENTS.md                 # Pointer to this file for non-Claude agents
├── LICENSE
├── package.json              # Astro + Tailwind deps for the homepage build
├── astro.config.mjs          # publicDir: ./docs, outDir: ./dist, site URL
├── tailwind.config.mjs       # retrowave palette, fonts, animations
├── .nvmrc                    # Node version pin (20 LTS)
├── .gitignore
├── src/                      # Homepage source (Astro)
│   ├── pages/index.astro     # The landing page
│   ├── layouts/Base.astro    # Shell + meta + OG card
│   ├── components/           # Hero, TerminalDemo, HowItWorks, Coverage, Install, Footer, Header
│   └── styles/global.css     # Tailwind directives + retrowave globals
├── docs/                     # Content (Astro publicDir, copied through verbatim)
│   ├── _headers              # Cloudflare Pages: Content-Type for *.md
│   ├── _redirects            # Cloudflare Pages: /cisco -> /cisco/index.md, etc.
│   ├── router.md             # Skill instructions and category table
│   ├── cisco/                # ios-xe, nxos, asa
│   ├── juniper/              # junos, srx
│   ├── general/              # bgp, ospf, vxlan, acl-design, qos, hardening
│   ├── iac/                  # terraform, ansible, nornir
│   ├── python/               # netmiko, scrapli, jinja-templates
│   ├── netbox/               # data-modeling, ipam, automation, custom-scripts, config-contexts
│   └── workflows/            # audit, picker, diff, document, validate
├── skills/                   # Drop-in SKILL templates per agent (copy into user's project)
│   ├── claude/SKILL.md       # -> .claude/skills/artofinfra/SKILL.md
│   ├── cursor/artofinfra.mdc # -> .cursor/rules/artofinfra.mdc
│   ├── codex/SKILL.md        # -> .codex/skills/artofinfra/SKILL.md
│   ├── opencode/SKILL.md     # -> .opencode/skills/artofinfra/SKILL.md
│   └── amp/SKILL.md          # -> .amp/skills/artofinfra/SKILL.md
└── dist/                     # Build output (gitignored), published by Cloudflare Pages
```

The Cloudflare Pages project is configured with:
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20 LTS (pinned via `.nvmrc`)

`npm run build` produces `dist/index.html` (the homepage) plus a verbatim copy of every file under `docs/`: `_headers`, `_redirects`, `router.md`, and all category content. The AI fetch URL contract (`/router.md`, `/cisco/ios-xe.md`, etc.) is preserved.

## Adding a new doc

1. Pick or create a category folder under `docs/` (e.g. `docs/cisco/`)
2. Add `docs/cisco/topic.md` following the doc format below
3. Add a one-line entry to `docs/cisco/index.md` linking to it
4. If creating a new category, also add a row to `docs/router.md`'s category table and create `docs/{category}/index.md`
5. Open a PR. Cloudflare Pages preview deploys give a working URL to test against before merge

## Doc format

Every content doc follows this structure:

```markdown
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
```

Be opinionated. The product is "do this, not that," not exhaustive reference. If you find yourself documenting every option of a feature, that's reference material and belongs on the vendor's site, not here.

## Conventions

- File names are kebab-case lowercase: `ios-xe.md`, not `IOS_XE.md` or `iosXE.md`
- Every category has an `index.md` (referenced by `docs/_redirects` so `/cisco` resolves to `/cisco/index.md`)
- Code fences must specify a language tag (`cisco`, `junos`, `routeros`, `bash`, `yaml`, etc.)
- Keep docs short. If a doc grows past roughly 500 lines, split into subtopics
- No em dashes anywhere in docs or commit messages. Use hyphens, commas, or restructure
- No emojis in docs
- Always reference docs by their full HTTPS URL (`https://docs.artofinfra.com/...`)

## Content quality bar

Wrong rules in this repo become wrong rules in real networks. Treat content like production code.

- **Self-verify networking claims** against vendor documentation or existing content before finalizing. Trace through edge cases in every config block.
- **Config blocks must be real.** Every code block must contain valid, deployable syntax. No `! TODO` stubs, no placeholder scaffolding. If a value is environment-specific, mark it clearly (e.g. `<KEY>`).
- **Flag uncertainty.** If unsure about router syntax or a networking claim, say so explicitly. A correct but incomplete doc is better than a wrong config that ships.
- **Don't silently generalize** a rule from one doc to another. Vendor-specific behavior varies; what's true on IOS-XE may not be true on NX-OS.
- **Multi-file changes must be ordered.** When adding a doc: write the doc, then update `index.md`, then `router.md` (if new category), then `_headers`/`_redirects` if they exist. Confirm each file before moving on.

## Homepage development

The landing page lives at the repo root as an Astro project; the install snippets shown in the Install section are read from `skills/{agent}/SKILL.md` at build time, so updating a skill file automatically updates the homepage.

```bash
npm install         # one-time
npm run dev         # local dev server (default :4321), also serves docs/*.md verbatim
npm run build       # produces dist/
npm run preview     # serves dist/ statically for a final check
```

Theming lives in `tailwind.config.mjs` (palette: `bg`, `ink`, `neon-*`) and `src/styles/global.css` (CRT overlay, neon glow utilities, sun/grid backgrounds). Component conventions follow the project-wide UI guidelines: left-aligned heading groups by default, `font-semibold`/`font-medium` on headings (never `font-bold`), `tracking-tight` on anything larger than `text-xl`, no `text-xs` for body, body min `text-base` on mobile.

## Future: installer

Not built yet. Will be `npx @artofinfra/install` that detects the user's agent and writes the right SKILL file at the right path. Until then, the homepage's Install section is the install. Copy-paste each agent's tab into the target path it shows.

## Hard rules

- Content stays opinionated and short. Wrong rules in this repo become wrong rules in real networks.
- The Ghost blog at artofinfra.com is for long-form prose. Short, terse, opinionated rules belong here.
- The homepage tooling (Astro + Tailwind at the root) exists to serve the project's brand presence. Don't expand the build to do other things. No CMS, no dynamic backend, no application code. If a feature can be a markdown doc, it should be.

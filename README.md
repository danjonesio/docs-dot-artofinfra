# Art of Infra

Free, open-source networking and infrastructure rules for AI coding assistants. When your agent is configuring a router, writing Terraform, or chasing a BGP issue, it fetches rules from this repo and uses them in its answer.

Hosted at https://docs.artofinfra.com. Companion to the [Art of Infra blog](https://artofinfra.com).

## Install

```bash
npx @artofinfra/install
```

Interactive picker; asks which agent(s) you want and writes the matching SKILL file to the right path.

Or copy-paste manually from `skills/`:

| Agent | Path |
| --- | --- |
| Claude Code | `.claude/skills/artofinfra/SKILL.md` |
| Cursor | `.cursor/rules/artofinfra.mdc` |
| Codex | `.codex/skills/artofinfra/SKILL.md` |
| OpenCode | `.opencode/skills/artofinfra/SKILL.md` |
| Amp | `.amp/skills/artofinfra/SKILL.md` |

## Use

In your agent, invoke `/artofinfra` and ask an infra question:

```
/artofinfra how should I configure OSPF on a Cisco IOS-XE edge router?
```

The agent fetches the relevant rules and answers using them.

## How it works

No backend. `docs.artofinfra.com` is a CDN serving markdown files. The skill points the AI at `https://docs.artofinfra.com/router.md`, which lists categories. The AI follows links to category indexes and individual docs as needed.

Three levels:

- `router.md`: top-level routing table
- `{category}/index.md`: list of docs in a category
- `{category}/{topic}.md`: opinionated rules

## Community

Discord: <https://discord.artofinfra.com>. Questions, suggestions, war stories from real networks, or help with the skill itself, that's where to ask.

## Contributing

PRs welcome. Docs are short, opinionated, and config-example-driven. "Do this, not that."

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for doc format, conventions, content quality bar, and the PR process.

## License

MIT. See [`LICENSE`](LICENSE).

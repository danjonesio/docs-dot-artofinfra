# @artofinfra/install

Interactive installer for the [Art of Infra](https://docs.artofinfra.com) AI skill.

## Usage

```bash
npx @artofinfra/install
```

Asks which agent(s) you want configured, then writes the matching SKILL file to its conventional path in the current directory. One question; no auto-detection magic to guess wrong.

## What it writes, where

| Agent | Target path |
| --- | --- |
| Claude Code | `.claude/skills/artofinfra/SKILL.md` |
| Cursor | `.cursor/rules/artofinfra.mdc` |
| Codex | `.codex/skills/artofinfra/SKILL.md` |
| OpenCode | `.opencode/skills/artofinfra/SKILL.md` |
| Amp | `.amp/skills/artofinfra/SKILL.md` |

Each SKILL file is a thin bootstrap that points the agent at `https://docs.artofinfra.com/router.md`. The router lists categories and workflows; the agent fetches what it needs on demand.

## Overwrite behaviour

If a SKILL file already exists at the target path, the installer **copies the old file to `<file>.artofinfra.<timestamp>` before overwriting** so previous content is recoverable. If the new content is byte-identical to the old, the backup is removed (no-op writes leave no trace).

## Flags

| Flag | Effect |
| --- | --- |
| `--help`, `-h` | Print usage and exit |
| `--version`, `-v` | Print version and exit |

## Manual install

If you'd rather skip the CLI, source files live at <https://github.com/danjonesio/docs-dot-artofinfra/tree/main/skills>. Copy the matching `SKILL.md` (or `artofinfra.mdc` for Cursor) into the path from the table above.

## License

MIT. Source at <https://github.com/danjonesio/docs-dot-artofinfra>.

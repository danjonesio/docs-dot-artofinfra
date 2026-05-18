#!/usr/bin/env node
// Art of Infra installer.
//
// One question UX: which agent(s) do you want configured? Then writes
// the matching SKILL file to its conventional path in the current
// directory. No auto-detection, no overwrite prompts (existing files
// are backed up to <file>.artofinfra.<timestamp> before being replaced;
// if the new content matches the old, the backup is removed).
//
// Run via: npx @artofinfra/install

import * as p from '@clack/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { agents } from '../lib/skills.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// ---- Argument parsing -----------------------------------------------------

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}
if (args.includes('--version') || args.includes('-v')) {
  console.log(pkg.version);
  process.exit(0);
}
const unknown = args.find((a) => !['--help', '-h', '--version', '-v'].includes(a));
if (unknown) {
  console.error(`Unknown argument: ${unknown}`);
  console.error('Run `artofinfra-install --help` for usage.');
  process.exit(2);
}

function printHelp() {
  const list = agents.map((a) => `  ${a.id.padEnd(10)} ${a.label.padEnd(14)} ${a.target}`).join('\n');
  console.log(`@artofinfra/install ${pkg.version}

Interactive installer for the Art of Infra AI skill.

Usage:
  npx @artofinfra/install

Pick which agent(s) you want configured; the installer writes the
matching SKILL file to its conventional path in the current directory.

Existing files are backed up to <file>.artofinfra.<timestamp> before
being overwritten. If the new content is identical to the old, the
backup is removed (no-op writes leave no trace).

Flags:
  --help, -h     Show this help
  --version, -v  Show version

Agents:
${list}

After install, invoke the skill with /artofinfra in your agent.
Docs: https://docs.artofinfra.com`);
}

// ---- File writing ---------------------------------------------------------

/**
 * Write `content` to `filePath`, creating parent dirs as needed.
 * If the file already exists, it's first copied to
 * `<filePath>.artofinfra.<timestamp>` as a backup. If the new content
 * matches the old, the backup is removed (so no-op writes leave no
 * trace). Returns a small status object describing what happened.
 */
async function writeWithBackup(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const existing = await fs.readFile(filePath, 'utf8').catch(() => null);
  let backupPath = null;

  if (existing !== null) {
    backupPath = `${filePath}.artofinfra.${Date.now()}`;
    await fs.copyFile(filePath, backupPath).catch(() => {
      backupPath = null;
    });
  }

  await fs.writeFile(filePath, content);

  if (existing === content && backupPath) {
    await fs.rm(backupPath, { force: true }).catch(() => {});
    return { created: false, changed: false, backupPath: null };
  }

  return {
    created: existing === null,
    changed: existing !== content,
    backupPath,
  };
}

// ---- Main -----------------------------------------------------------------

async function main() {
  p.intro('Art of Infra installer');

  const selectedIds = await p.multiselect({
    message: 'Which agents do you want configured?',
    options: agents.map((a) => ({
      value: a.id,
      label: a.label,
      hint: a.target,
    })),
    required: true,
  });

  if (p.isCancel(selectedIds)) {
    p.cancel('Aborted.');
    process.exit(0);
  }

  const cwd = process.cwd();
  const selected = agents.filter((a) => selectedIds.includes(a.id));

  await p.tasks(
    selected.map((agent) => ({
      title: `Installing ${agent.label} skill`,
      async task() {
        const targetPath = path.join(cwd, agent.target);
        const result = await writeWithBackup(targetPath, agent.content);

        if (result.created) {
          return `${agent.label} skill installed at ${agent.target}`;
        }
        if (!result.changed) {
          return `${agent.label} skill already up to date at ${agent.target}`;
        }
        return `${agent.label} skill updated at ${agent.target} (backup: ${path.basename(result.backupPath)})`;
      },
    })),
  );

  p.outro('Done. Invoke the skill with /artofinfra in your agent.');
}

main().catch((err) => {
  console.error('Installer failed:', err.message);
  process.exit(1);
});

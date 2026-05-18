import rss from '@astrojs/rss';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

// Build-time RSS feed of every Art of Infra doc.
// Items are pulled from each category's index.md, which is the same source
// the homepage Coverage and Workflows sections use. pubDate uses the actual
// doc file's mtime so subscribers see real "what's new" timestamps.

const categories = [
  { slug: 'cisco', name: 'Cisco' },
  { slug: 'juniper', name: 'Juniper' },
  { slug: 'general', name: 'General' },
  { slug: 'iac', name: 'IaC' },
  { slug: 'python', name: 'Python' },
  { slug: 'netbox', name: 'NetBox' },
  { slug: 'workflows', name: 'Workflows' },
];

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const bulletRegex = /^- \[(.+?)\]\((.+?)\)\s*:\s*(.+)$/;

function parseIndex(content) {
  const docs = [];
  for (const rawLine of content.split('\n')) {
    const m = bulletRegex.exec(rawLine.trim());
    if (m) {
      docs.push({ title: m[1], url: m[2], description: m[3].trim() });
    }
  }
  return docs;
}

function urlToFsPath(docUrl) {
  const u = new URL(docUrl);
  // Strip the leading slash so we can join under repoRoot
  return path.join(repoRoot, u.pathname.replace(/^\//, ''));
}

export async function GET(context) {
  const items = [];

  for (const cat of categories) {
    const indexPath = path.join(repoRoot, 'docs', cat.slug, 'index.md');
    const content = fs.readFileSync(indexPath, 'utf8');
    const docs = parseIndex(content);

    for (const doc of docs) {
      const docFsPath = urlToFsPath(doc.url);
      let pubDate;
      try {
        pubDate = fs.statSync(docFsPath).mtime;
      } catch {
        // If we can't stat the file (mismatched URL), fall back to build time
        pubDate = new Date();
      }

      items.push({
        title: `${cat.name}: ${doc.title}`,
        link: doc.url,
        description: doc.description,
        pubDate,
      });
    }
  }

  // Sort newest first so subscribers see fresh additions at the top
  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'Art of Infra docs',
    description:
      'Opinionated networking and infrastructure rules for AI coding assistants. Fetched on demand by agents; subscribe here to see new docs as they land.',
    site: context.site,
    items,
    customData: '<language>en-us</language>',
  });
}

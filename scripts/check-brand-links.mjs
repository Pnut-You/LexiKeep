import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const projectRoot = new URL('../', import.meta.url);
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules', 'target']);
const textExtensions = new Set([
  '.css', '.html', '.js', '.json', '.md', '.mjs', '.rs', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yml', '.yaml',
]);
const forbiddenLink = /https?:\/\/[^\s"'<>]*(?:lexicue|skylar-deepmind)[^\s"'<>]*/gi;
const violations = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!entry.isFile() || !textExtensions.has(extname(entry.name))) continue;

    const content = await readFile(path, 'utf8');
    for (const match of content.matchAll(forbiddenLink)) {
      const line = content.slice(0, match.index).split('\n').length;
      violations.push(`${relative(projectRoot.pathname, path)}:${line} ${match[0]}`);
    }
  }
}

await scan(projectRoot.pathname);

if (violations.length > 0) {
  console.error('Found links associated with the previous project:');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Brand link check passed: no previous-project URLs found.');

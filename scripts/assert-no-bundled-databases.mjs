import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const scanRoots = [projectRoot, path.join(projectRoot, 'dist')];
const ignoredDirectories = new Set([
  '.git',
  '.turbo',
  'node_modules',
  'release',
]);
const blockedPatterns = [
  /\.sqlite$/i,
  /\.sqlite3$/i,
  /\.db$/i,
  /\.db3$/i,
  /-wal$/i,
  /-shm$/i,
];

const matches = new Set();

const shouldIgnore = (entryPath) => {
  const relativePath = path.relative(projectRoot, entryPath);
  if (!relativePath || relativePath.startsWith('..')) {
    return false;
  }

  return relativePath.split(path.sep).some((segment) => ignoredDirectories.has(segment));
};

const visit = (targetPath) => {
  if (!fs.existsSync(targetPath) || shouldIgnore(targetPath)) {
    return;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(targetPath)) {
      visit(path.join(targetPath, child));
    }
    return;
  }

  if (blockedPatterns.some((pattern) => pattern.test(path.basename(targetPath)))) {
    matches.add(path.relative(projectRoot, targetPath));
  }
};

for (const root of scanRoots) {
  visit(root);
}

if (matches.size > 0) {
  console.error('Blocked local database files detected in packaging inputs:');
  for (const match of [...matches].sort()) {
    console.error(`- ${match}`);
  }
  process.exit(1);
}

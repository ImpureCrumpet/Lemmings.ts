import { lstat, readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { findReleasePathViolations } from './release-audit-policy.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const releaseRoot = resolve(projectRoot, process.argv[2] ?? 'dist');
const requiredFiles = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'LICENSES/GPL-2.0.txt'];
async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    const status = await lstat(absolutePath);
    if (status.isSymbolicLink()) {
      throw new Error(`Release contains a symbolic link: ${relative(releaseRoot, absolutePath)}`);
    }
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

await Promise.all(requiredFiles.map(async (file) => {
  const status = await lstat(resolve(releaseRoot, file)).catch(() => undefined);
  if (!status?.isFile()) {
    throw new Error(`Release is missing required legal file: ${file}`);
  }
}));

const files = await listFiles(releaseRoot);
const violations = [];

for (const absolutePath of files) {
  const releasePath = relative(releaseRoot, absolutePath).split(sep).join('/');
  violations.push(...findReleasePathViolations(releasePath));
}

const notices = await readFile(resolve(releaseRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8');
if (!notices.includes('DOSBox DBOPL') || !notices.includes('GPL-2.0-or-later')) {
  violations.push('THIRD_PARTY_NOTICES.md does not identify the DBOPL GPL boundary');
}

if (violations.length > 0) {
  throw new Error(`Release audit failed:\n- ${violations.join('\n- ')}`);
}

console.log(`Release audit passed: ${files.length} files checked in ${releaseRoot}.`);

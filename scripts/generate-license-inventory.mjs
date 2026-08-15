import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const projectRoot = resolve(import.meta.dirname, '..');
const packagePath = resolve(projectRoot, 'package.json');
const lockPath = resolve(projectRoot, 'package-lock.json');
const outputPath = resolve(projectRoot, 'docu/DEPENDENCY-LICENSES.md');

const [packageJson, lock] = await Promise.all([
  readFile(packagePath, 'utf8').then(JSON.parse),
  readFile(lockPath, 'utf8').then(JSON.parse),
]);

function packageNameFromPath(packagePath) {
  return packagePath.slice(packagePath.lastIndexOf('node_modules/') + 'node_modules/'.length);
}

function packageRecord(name, metadata, relationship) {
  if (!metadata.version || !metadata.license) {
    throw new Error(`${name} is missing version or license metadata in package-lock.json`);
  }

  return {
    name,
    version: metadata.version,
    license: metadata.license,
    relationship,
    source: metadata.resolved ?? `https://www.npmjs.com/package/${name}`,
  };
}

const directRuntime = new Set(Object.keys(packageJson.dependencies ?? {}));
const productionByIdentity = new Map();

for (const [packagePath, metadata] of Object.entries(lock.packages)) {
  if (
    !packagePath.startsWith('node_modules/')
    || metadata.dev === true
    || metadata.devOptional === true
    || !metadata.version
  ) {
    continue;
  }

  const name = packageNameFromPath(packagePath);
  const identity = `${name}@${metadata.version}`;
  const relationship = directRuntime.has(name) ? 'direct' : 'transitive';
  const existing = productionByIdentity.get(identity);

  if (!existing || relationship === 'direct') {
    productionByIdentity.set(identity, packageRecord(name, metadata, relationship));
  }
}

const directDevelopment = Object.keys(packageJson.devDependencies ?? {}).map((name) => {
  const metadata = lock.packages[`node_modules/${name}`];
  if (!metadata) {
    throw new Error(`${name} is missing from package-lock.json`);
  }
  return packageRecord(name, metadata, 'direct development');
});

function comparePackages(left, right) {
  return left.name.localeCompare(right.name) || left.version.localeCompare(right.version);
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|');
}

function table(records) {
  const rows = records.toSorted(comparePackages).map((record) => (
    `| [${escapeCell(record.name)}](${record.source}) | ${escapeCell(record.version)} | ${escapeCell(record.license)} | ${record.relationship} |`
  ));

  return [
    '| Package | Locked version | Declared license | Relationship |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

const output = `# Dependency license inventory

This file is generated from \`package.json\` and \`package-lock.json\`. Run
\`npm run licenses:inventory\` after changing dependencies, and
\`npm run licenses:check\` to detect a stale inventory. Package links use the
locked registry source where available. License values are package metadata,
not an independent legal conclusion.

## Production installation graph

This is a conservative list of locked, non-development packages in a production
installation. A bundler may tree-shake some of them from a specific build.

${table([...productionByIdentity.values()])}

## Direct development tools

Development-only transitive packages are recorded by \`package-lock.json\` but
are not repeated here because they are not shipped in the browser build.

${table(directDevelopment)}
`;

if (process.argv.includes('--check')) {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== output) {
    throw new Error('docu/DEPENDENCY-LICENSES.md is stale; run npm run licenses:inventory');
  }
  console.log('Dependency license inventory is current.');
} else {
  await writeFile(outputPath, output);
  console.log('Updated docu/DEPENDENCY-LICENSES.md.');
}

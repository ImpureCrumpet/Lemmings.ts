import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { getReleaseVersionMetadata } from './release-version-policy.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
const tag = process.env.GITHUB_REF_NAME;
const githubOutput = process.env.GITHUB_OUTPUT;

if (!tag) {
  throw new Error('GITHUB_REF_NAME is required to validate a release');
}
if (!githubOutput) {
  throw new Error('GITHUB_OUTPUT is required to publish release metadata');
}

const metadata = getReleaseVersionMetadata(tag, packageJson.version);
await appendFile(githubOutput, `version=${metadata.version}\nprerelease=${metadata.prerelease}\n`);
console.log(`Release version validated: ${tag}${metadata.prerelease ? ' (prerelease)' : ''}.`);

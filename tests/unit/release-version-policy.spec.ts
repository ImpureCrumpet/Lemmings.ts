import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

interface ReleaseVersionMetadata {
  version: string;
  prerelease: boolean;
}

function getMetadata(tag: string, packageVersion: string): ReleaseVersionMetadata {
  const policyUrl = pathToFileURL(
    resolve(import.meta.dirname, '../../scripts/release-version-policy.mjs'),
  ).href;
  const source = [
    `import { getReleaseVersionMetadata } from ${JSON.stringify(policyUrl)};`,
    'try {',
    `  console.log(JSON.stringify(getReleaseVersionMetadata(${JSON.stringify(tag)}, ${JSON.stringify(packageVersion)})));`,
    '} catch (error) {',
    '  console.error(error instanceof Error ? error.message : error);',
    '  process.exit(1);',
    '}',
  ].join('\n');

  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', source],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.trim());
  }

  return JSON.parse(result.stdout) as ReleaseVersionMetadata;
}

describe('release version policy', () => {
  it('recognizes stable and prerelease package versions', () => {
    expect(getMetadata('v1.2.3', '1.2.3')).toEqual({
      version: '1.2.3',
      prerelease: false,
    });
    expect(getMetadata('v1.2.3-beta.1', '1.2.3-beta.1')).toEqual({
      version: '1.2.3-beta.1',
      prerelease: true,
    });
  });

  it('rejects a tag that disagrees with package.json', () => {
    expect(() => getMetadata('v1.2.4', '1.2.3')).toThrow(
      /does not match package\.json version 1\.2\.3/,
    );
  });

  it('rejects unsupported package versions', () => {
    expect(() => getMetadata('v01.2.3', '01.2.3')).toThrow(
      /not a supported semantic version/,
    );
    expect(() => getMetadata('v1.2.3-beta.01', '1.2.3-beta.01')).toThrow(
      /not a supported semantic version/,
    );
  });
});

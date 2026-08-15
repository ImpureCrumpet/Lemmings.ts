import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

function findViolations(releasePath: string): string[] {
  const policyUrl = pathToFileURL(
    resolve(import.meta.dirname, '../../scripts/release-audit-policy.mjs'),
  ).href;
  const source = [
    `import { findReleasePathViolations } from ${JSON.stringify(policyUrl)};`,
    `console.log(JSON.stringify(findReleasePathViolations(${JSON.stringify(releasePath)})));`,
  ].join('\n');

  return JSON.parse(execFileSync(
    process.execPath,
    ['--input-type=module', '--eval', source],
    { encoding: 'utf8' },
  )) as string[];
}

describe('release audit path policy', () => {
  it('rejects toolbar artwork independently of the host path separator', () => {
    expect(findViolations('assets\\classic\\TOOLBAR.PNG')).toEqual([
      'assets/classic/TOOLBAR.PNG: local toolbar artwork must not be packaged',
    ]);
  });

  it('rejects original data, source maps, temp content, and non-placeholders', () => {
    expect(findViolations('data/lemmings/ADLIB.DAT')).toHaveLength(2);
    expect(findViolations('assets/game.js.map')).toHaveLength(1);
    expect(findViolations('drafts/notes.md')).toHaveLength(1);
    expect(findViolations('data/lemmings/config.json')).toEqual([]);
    expect(findViolations('data/lemmings/README.md')).toEqual([]);
  });
});

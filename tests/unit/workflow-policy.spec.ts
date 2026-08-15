import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkflow(name: string): string {
  return readFileSync(
    resolve(import.meta.dirname, `../../.github/workflows/${name}`),
    'utf8',
  );
}

describe('GitHub workflow policy', () => {
  it('keeps every required CI gate explicit', () => {
    const workflow = readWorkflow('ci.yml');

    for (const command of [
      'npm ci',
      'npm run lint',
      'npm run test:ci',
      'npm run typecheck',
      'npm run licenses:check',
      'npm run build',
      'node scripts/audit-release.mjs dist',
    ]) {
      expect(workflow).toContain(`run: ${command}`);
    }
  });

  it('keeps release provenance, validation, and prerelease gates explicit', () => {
    const workflow = readWorkflow('release.yml');

    expect(workflow).toContain('git merge-base --is-ancestor HEAD origin/master');
    expect(workflow).toContain('node scripts/validate-release-version.mjs');
    expect(workflow).toContain('run: npm run check');
    expect(workflow).toContain('release_flags=(--prerelease --latest=false)');
  });
});

const forbiddenExtensions = new Set(['.bat', '.com', '.dat', '.exe', '.map']);
const forbiddenNames = new Set(['toolbar.png']);
const forbiddenDirectories = new Set(['draft', 'drafts', 'temp']);
const allowedDataExtensions = new Set(['.json', '.md']);

/**
 * Check one release-relative path without relying on the host platform's path
 * rules. Release paths are normally POSIX-normalized by audit-release.mjs, but
 * accepting either separator keeps this policy safe and directly testable.
 *
 * @param {string} releasePath
 * @returns {string[]}
 */
export function findReleasePathViolations(releasePath) {
  const normalizedPath = releasePath.replaceAll('\\', '/');
  const lowerPath = normalizedPath.toLowerCase();
  const extension = lowerPath.includes('.') ? lowerPath.slice(lowerPath.lastIndexOf('.')) : '';
  const segments = lowerPath.split('/');
  const fileName = segments.at(-1) ?? '';
  const violations = [];

  if (forbiddenExtensions.has(extension)) {
    violations.push(`${normalizedPath}: forbidden original-data or source-map extension`);
  }
  if (forbiddenNames.has(fileName)) {
    violations.push(`${normalizedPath}: local toolbar artwork must not be packaged`);
  }
  if (segments.some((segment) => forbiddenDirectories.has(segment))) {
    violations.push(`${normalizedPath}: draft/temp directory must not be packaged`);
  }
  if (segments[0] === 'data' && !allowedDataExtensions.has(extension)) {
    violations.push(`${normalizedPath}: only data configuration and placeholder documentation may ship`);
  }

  return violations;
}

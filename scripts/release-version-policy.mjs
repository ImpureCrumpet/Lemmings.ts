const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function getReleaseVersionMetadata(tag, packageVersion) {
  const packageMatch = semanticVersionPattern.exec(packageVersion);
  if (!packageMatch) {
    throw new Error(`package.json version is not a supported semantic version: ${packageVersion}`);
  }

  const expectedTag = `v${packageVersion}`;
  if (tag !== expectedTag) {
    throw new Error(`Release tag ${tag} does not match package.json version ${packageVersion}; expected ${expectedTag}`);
  }

  return {
    version: packageVersion,
    prerelease: packageMatch.groups?.prerelease !== undefined,
  };
}

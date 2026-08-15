# Automated checks and private releases

## Required validation

Every pull request and every push to `master` runs the `CI` workflow on Node.js
24. The branch-protection check name is `Required validation (Node 24)`. It
installs the committed lockfile with `npm ci`, then runs linting, unit tests,
type checking, the dependency-license inventory check, a production build, and
the release-content audit.

Run the same required checks locally with:

```sh
npm ci
npm run check
```

The CI workflow caches npm's download cache through `setup-node`; it never
caches `node_modules`. A JUnit test report is retained for 14 days even when a
test fails. Browser gameplay checks are deliberately not part of this fast
required job.

## Branch protection

Repository administrators should protect `master` and require the
`Required validation (Node 24)` check before merging. Also require pull
requests, dismiss stale approvals if appropriate for the team, and prevent
force pushes and deletion. These GitHub repository settings cannot be enforced
by a workflow committed to the repository.

## Dependency maintenance

Dependabot checks npm packages and GitHub Actions each Monday. Minor and patch
updates are grouped; major updates remain individual proposals and require a
normal review with a clean build and relevant gameplay evidence.

The separate `Dependency security report` workflow runs weekly and can also be
started manually. It preserves the npm advisory report for 30 days. Advisory
findings are intentionally reported without failing normal development:
severity, reachability, available fixes, and regressions should be reviewed
before changing a locked dependency.

## Version and changelog convention

Release tags use semantic versions such as `v1.2.3` or a prerelease such as
`v1.2.3-beta.1`:

- increment the major version for incompatible data, save, or supported-system
  changes;
- increment the minor version for backward-compatible user-visible features;
- increment the patch version for backward-compatible fixes and maintenance.

GitHub Releases are the project changelog. Pull requests use `user-visible`,
`compatibility`, and `licensing` labels so generated notes call out those
categories. Use `skip-changelog` only when a pull request should be omitted.

## Creating a private release

Releases are allowed only while this repository remains private. On the release
preparation branch, update both package files to the intended version, run the
checks, and commit that version change:

```sh
npm version 0.2.0 --no-git-tag-version
npm run check
git add package.json package-lock.json
git commit -m "Prepare v0.2.0 release."
```

Merge that commit to `master`, confirm CI succeeds, and create and push an
annotated tag with the same version:

```sh
git switch master
git pull --ff-only
git tag -a v0.2.0 -m "Lemmings.ts v0.2.0"
git push origin v0.2.0
```

The tag starts the `Private release` workflow from a clean checkout. A
read-only build job repeats all required checks, rejects a public repository,
requires the tagged commit to be on `master`, requires the tag to match the
version in `package.json`, audits `dist/`, makes a timestamp-normalized archive,
writes its SHA-256 checksum, and retains both as a workflow artifact. A
separate, narrowly scoped publish job receives release-write permission and
attaches those exact files to a private GitHub Release with generated notes.
Prerelease versions are explicitly marked as prereleases and cannot replace the
latest stable release.

The archive intentionally contains the browser application and legal notices
but no original Lemmings data or local toolbar replacement. A recipient must
provide legally obtained game data separately. Public releases and deployments
remain blocked by the additional gates in [DISTRIBUTION.md](DISTRIBUTION.md).

# Distribution and licensing

## Current policy

This repository is private. Local development, private builds, and copies used
by the repository owner are the current distribution target. There is no
approved public binary, hosted deployment, app-store package, or source release.

Licensing work should therefore remain incremental: retain notices, record the
origin and license of each new dependency or asset when it is added, and do not
vendor original Lemmings data. This document is an engineering policy, not legal
advice.

## Code boundaries

- Original Lemmings.ts engine and application code is offered under the MIT
  terms in the root `LICENSE`, copyright Thomas Zeugner and contributors.
- `src/game/resources/sound/DBOPL/` is a TypeScript port of DOSBox DBOPL. Its
  source headers state GPL-2.0-or-later and identify the DOSBox Team and Thomas
  Zeugner. The complete GPL v2 text is in `LICENSES/GPL-2.0.txt`.
- The AudioWorklet build includes DBOPL code. The MIT grant does not override
  those GPL terms. A future external build must be reviewed as a combined work
  and distributed with the applicable notices and corresponding source.
- npm dependency versions and declared SPDX licenses are generated in
  `docu/DEPENDENCY-LICENSES.md`.

## Original-data boundary

Original Lemmings `.DAT` files, DOS executables, decoded graphics, music, sound,
levels, and locally edited `toolbar.png` files are player-supplied data. They are
not covered by the repository license and must remain outside commits and
release artifacts. `.gitignore` excludes the expected local files, while
`npm run audit:release` independently inspects a fresh production build.

The absence of current commercial support or an informal "abandonware" label
does not grant redistribution rights. Players must provide files from a copy
they are legally entitled to use.

## Routine checks

- Run `npm run licenses:inventory` after changing `package.json` or the lockfile.
- Run `npm run licenses:check` in reviews to catch an outdated inventory.
- Run `npm run audit:release` to build the app, verify required legal notices,
  and reject DOS binaries, local toolbar art, source maps, and draft folders.
- Add every new tracked visual, audio, font, or generated asset to
  `docu/ASSET-PROVENANCE.md` when it is introduced.

## Gate before any external release

External distribution remains blocked until an owner explicitly completes all
of the following:

1. Decide and document the license for the combined browser/AudioWorklet build,
   with qualified review if needed.
2. Make the complete corresponding source for that exact build available next
   to the binary distribution and preserve the GPL and npm-package notices.
3. Resolve or replace every asset marked "review before external release" in
   the provenance inventory.
4. Audit the exact downloadable archive or deployed directory, not only the Git
   tree, and retain the successful file list with the release record.
5. Confirm that no original data, local conversions, private player data,
   source maps, drafts, or credentials are present.

Until those steps are complete, builds are private/local only.

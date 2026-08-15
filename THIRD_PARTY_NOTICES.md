# Third-party notices

## DOSBox DBOPL

The files under `src/game/resources/sound/DBOPL/` are a TypeScript port of
the DOSBox DBOPL implementation. Their source headers identify:

- Copyright (C) 2002–2015 The DOSBox Team.
- TypeScript port (2019) by Thomas Zeugner.
- License: GNU General Public License, version 2 or (at your option) any later
  version (`GPL-2.0-or-later`).

The full GPL version 2 text is included in `LICENSES/GPL-2.0.txt`. The source
code for this distributed port is the `src/game/resources/sound/DBOPL/`
directory itself. The production AudioWorklet bundle incorporates that code,
so redistributors must assess and meet the GPL requirements for the combined
distribution. The repository's MIT notice does not replace the DBOPL terms.

The previous top-level notice attributed the active emulator to Robson
Cozendey under the LGPL. That did not match the copyright and GPL notices in
the DBOPL files actually imported by `db-opl3.ts`, and has been corrected.

## Lemmings game data

Original Lemmings data files and artwork are not licensed by this repository.
They are user-supplied, ignored by Git, and must not be included in source or
release artifacts without separate permission. The placeholder README files
under `public/data/` describe the expected local layout.

Tracked visual files and their current review status are listed in
`docu/ASSET-PROVENANCE.md`. No replacement toolbar artwork is currently
vendored.

## npm packages

The exact direct development dependencies and conservative production
installation graph are generated from `package-lock.json` in
`docu/DEPENDENCY-LICENSES.md`. These packages retain their own licenses and
copyright notices. The current repository is private; preserving any additional
license texts required by a future external binary distribution is an explicit
release-gate item in `docu/DISTRIBUTION.md`.

This notice records the repository's provenance review; it is not legal
advice.

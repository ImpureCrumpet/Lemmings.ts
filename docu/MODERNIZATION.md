# Modernization audit

## What changed

The web shell has been moved from the maintenance-only Vue CLI 4 toolchain to
Vite 8. The project now uses Vue 3.5, TypeScript 6, ES modules, an ES2022 source
target, ESLint's flat configuration, Vitest, and `vue-tsc` as an explicit
build-time type check. Development and CI use Node.js 24 LTS. Production output
targets Chrome and Edge 111+, Firefox 114+, and Safari/iOS 16.4+ rather than
following Vite's moving default implicitly.

The main menu, game, and data-setup views use Vue's `<script setup>` Composition
API instead of the pre-release `vue-class-component` API. The unused generated
demo component and its placeholder test were removed and replaced with focused
tests for the engine and application behaviour.

The game engine remains deliberately framework-independent. Modernization there was kept focused:

* browser resource loading now uses `fetch` and propagates failures correctly;
* missing DOS data produces a useful UI message instead of attempting to decode an HTML fallback;
* type-only imports and exact filename casing make ES-module builds reliable across operating systems;
* timers and input listeners are cleaned up when a screen is left;
* Pointer Events provide one captured mouse, touch, and pen path;
* a fade interval leak and backward level-group navigation bug are fixed;
* a fixed-timestep `requestAnimationFrame` loop preserves the original 60 ms
  simulation tick;
* OPL playback runs in an AudioWorklet rather than a deprecated
  `ScriptProcessorNode`; and
* the canvas remains responsive while preserving crisp pixel rendering.

## Toolbar readability and asset sourcing

There are few conventional image assets to batch-process. Most graphics are decoded at runtime from the original DOS bit-plane files into `Frame` and `ImageData` objects. The readability concern is narrower: the in-game toolbar is decoded as one 320x40 image, with each action occupying a 16x23 logical-pixel button.

The game view remains at 2x nearest-neighbour scaling. The toolbar now uses 2.5x scaling, which exactly fills its existing 800x100 canvas region instead of leaving the right and bottom portions unused. This makes the actions 25 percent larger without touching simulation coordinates, terrain masks, or the original 16-pixel input grid. Canvas smoothing remains disabled.

Two external sources were evaluated:

* [carlotacb/Lemmings](https://github.com/carlotacb/Lemmings) has a conveniently separated `buttons.png`, but its buttons are still only 15x23 pixels. More importantly, its README credits Lemmini and Lemmix for some sprites without identifying which ones. The repository's MIT license is not sufficient provenance for reusing that artwork, and the sheet would not provide an actual resolution gain.
* [oklemenz/LemmingsJS](https://github.com/oklemenz/LemmingsJS) is a deployed, compiled snapshot of the same tomsoftware engine lineage rather than an independent visual source. Its code constructs the same 320x40 panel from part 6 of `MAIN.DAT`, at the same 2x display scale. The repository contains original Lemmings and Oh No! More Lemmings data files, has no repository-level license, and only credits tomsoftware. It is useful as a compatibility reference, but its bundled game data and decoded toolbar should not be copied or redistributed.
* [Lix](https://github.com/SimonN/LixD) is the safer art source. Its original sprites and menu icons are explicitly released under CC0 in [`doc/copying.txt`](https://github.com/SimonN/LixD/blob/master/doc/copying.txt), and its [`skillsinpanel.png`](https://github.com/SimonN/LixD/blob/master/data/images/skillsinpanel.png) uses larger, cleanly separated skill images. Its character and skill set differ from classic Lemmings, however, so adopting it would be a deliberate visual redesign rather than a drop-in upscale.

The best second-stage experiment is therefore a new toolbar skin based on the CC0 Lix art, with locally drawn release-rate, pause, and nuke controls and an explicit source/license notice. It should be optional until all eight classic actions are recognizable at a glance. A deterministic pixel-art filter such as Scale2x can also be tested on the existing toolbar, but it will smooth edges rather than add semantic detail.

An editable-artwork round trip is now available. Once original data is loaded, the game can export the decoded panel as a 640x80 PNG. A finished `toolbar.png` placed beside an edition's `MAIN.DAT` overrides the DOS panel; 1x through 4x integer-resolution artwork is supported. Dynamic text, counters, selection borders, display fitting, and pointer hit-testing follow the asset scale automatically. See [`TOOLBAR-ARTWORK.md`](TOOLBAR-ARTWORK.md) for the layout and workflow.

Remaining visual experiments should keep the original DOS toolbar as the
fallback, preserve the logical hit regions, and add source, author, license,
and modification details for every vendored asset. A CC0-inspired replacement
should become a default only after its eight skill actions, release-rate
controls, pause state, and Nuke action are all recognizable at a glance.

## Completed follow-on work

The original audit's highest-priority workstreams are now implemented:

1. Synthetic parser, gameplay, terrain, command, and replay regression tests.
2. A deterministic fixed-timestep animation loop.
3. AudioWorklet-based OPL playback.
4. Unified pointer input, named keyboard actions, accessible controls, and
   configurable bindings.
5. Local preferences, progress, export, reset, and recovery behaviour.
6. Clear code, asset, original-data, and private-distribution boundaries.
7. Required CI, dependency maintenance, audited private releases, and release
   documentation.
8. In-browser original-data selection, validation, reusable folder handles,
   and static self-hosting support.

## Potential next improvements

1. Profile the software pixel compositor before choosing `OffscreenCanvas`, a
   worker, WebGL, or WebGPU; the original resolution may not justify added
   complexity.
2. Add a small browser-level smoke suite for setup, routing, browser zoom, and
   the accessible toolbar while keeping binary parser coverage synthetic.
3. Test a fully project-authored or clearly licensed high-resolution toolbar
   skin against the existing editable PNG workflow.
4. Consider an installable offline shell only if it can preserve the current
   local-file privacy and permission model without caching player-supplied
   original data.

## Validation status

The required check runs linting, unit and synthetic regression tests, type
checking, dependency-license verification, a production build, and a release
content audit. Manual browser checks cover the main screen, direct game
routing, data setup, responsive canvas behaviour, accessible controls, browser
zoom, and audio. Full gameplay and sound comparisons still require legally
obtained original DOS data, which is intentionally absent from the clone and
release artifacts.

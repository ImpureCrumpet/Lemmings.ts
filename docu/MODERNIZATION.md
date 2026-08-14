# Modernization audit

## What changed

The web shell has been moved from the maintenance-only Vue CLI 4 toolchain to Vite 8. The project now uses Vue 3.5, TypeScript 6, ES modules, an ES2022 browser target, ESLint's flat configuration, Vitest, and `vue-tsc` as an explicit build-time type check.

The two active screens now use Vue's `<script setup>` Composition API instead of the pre-release `vue-class-component` API. The unused generated demo component and its placeholder test were removed and replaced with small tests for game helpers.

The game engine remains deliberately framework-independent. Modernization there was kept focused:

* browser resource loading now uses `fetch` and propagates failures correctly;
* missing DOS data produces a useful UI message instead of attempting to decode an HTML fallback;
* type-only imports and exact filename casing make ES-module builds reliable across operating systems;
* timers and input listeners are cleaned up when a screen is left;
* responsive canvas coordinates and touch-end input are corrected;
* a fade interval leak and backward level-group navigation bug are fixed;
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

Recommended implementation order:

1. Test the new 2.5x toolbar on desktop and touch screens.
2. Mock up a CC0 toolbar skin without changing the game's logical hit regions.
3. Keep the original DOS toolbar as the default fallback.
4. Add a toolbar-style setting only if the replacement is clearly easier to read.
5. Record the source, author, license, and any modifications alongside every vendored asset.

## Highest-value next improvements

1. **AudioWorklet migration.** Audio currently uses the deprecated `ScriptProcessorNode`. Moving OPL synthesis into an `AudioWorkletProcessor` will avoid main-thread audio glitches and remove a browser-compatibility risk.
2. **Deterministic game loop.** Replace `setInterval` with a fixed-timestep accumulator driven by `requestAnimationFrame`. Keep the original 60 ms simulation tick for replay compatibility while making rendering and background-tab behaviour predictable.
3. **Parser and replay tests.** Add synthetic binary fixtures for decompression, level parsing, commands, and deterministic replay. These areas carry much more regression risk than the Vue shell.
4. **Pointer Events.** The corrected mouse/touch implementation works, but a single Pointer Events path would reduce duplication and add pen support and pointer capture.
5. **Save user settings.** Persist edition, level, volume, render mode, and control preferences in local storage.
6. **Accessibility and controls.** Add keyboard equivalents, visible focus states, configurable controls, and a proper pause/menu overlay. Touch support remains incomplete.
7. **Performance profiling.** The software pixel compositor does repeated per-pixel work and buffer conversion. Profile before considering `OffscreenCanvas`, a worker, or WebGL/WebGPU; the small original resolution may make the current CPU renderer perfectly adequate.
8. **Legal/packaging clarity.** Keep original binaries outside source control, improve the data-install instructions, and distinguish engine code licensing from third-party DOSBox-derived OPL code.

## Validation status

The repository passes type checking, linting, unit tests, and a production build. Browser smoke tests cover the main screen, direct game routing, responsive canvas presence, and graceful missing-data handling. Full gameplay and audio validation still require the original DOS data files, which are intentionally absent from the clone.

# Regression testing

The automated suite is designed to test the engine without downloading or committing commercial Lemmings data. All binary files, levels, masks, terrain, and replay strings under `tests/` are small fixtures authored specifically for this project.

## Running the checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Use `npm run test:watch` while developing a regression case.

## Test layout

- `tests/fixtures/binary-fixtures.ts` builds byte-order, DAT-container, level, and odd-table inputs.
- `tests/fixtures/gameplay-fixtures.ts` creates a small in-memory level, deterministic tick advancement, stub animation data, and synthetic terrain masks.
- `tests/unit/binary-parsers.spec.ts` covers cursor behaviour, bounded views, decompression, checksums, and malformed containers.
- `tests/unit/level-parsers.spec.ts` covers level metadata, odd-table alternatives, truncation, and configured level ordering.
- `tests/unit/gameplay-state.spec.ts` covers the logical timer at 30, 60, 120, irregular, and throttled frame rates; pause and visibility lifecycle; skill inventory; release conditions; and terrain bounds.
- `tests/unit/skill-actions.spec.ts` covers permanent, timed, constructive, destructive, movement, blocker, and terminal actions.
- `tests/unit/replay.spec.ts` verifies tick-zero playback, multiple commands at one tick, canonical serialization, malformed input, and repeatable state snapshots.
- `tests/unit/audio.spec.ts` verifies device-rate command timing, exact sample boundaries, deterministic OPL output, worklet command transport, autoplay failure, volume, and disposal.

## Adding a parser regression

Build the smallest meaningful byte array with `BinaryFixtureBuilder`. Include the source filename in the `BinaryReader` so a failure assertion can verify that users receive an actionable error. Each parser should have at least one valid example and one truncated or corrupt example.

Do not copy byte ranges from an original game file into a committed fixture. Set each field explicitly and use clearly fictional names and values.

## Adding a gameplay regression

Create a level with `buildSyntheticLevel`, then add only the ground pixels required for the behaviour. Advance simulation by calling `tick()` or `advanceTicks`; tests must never wait for `setTimeout`, `setInterval`, animation frames, audio, or a real clock.

Scheduler tests use an injected `FrameScheduler` and supply synthetic animation timestamps. Keep the logical step fixed at 60 milliseconds, assert tick counts independently from render counts, and include lifecycle assertions that only one frame remains scheduled.

For a terrain-changing skill, assert representative ground pixels immediately before and after the action frame. For a state transition, assert both the returned `LemmingStateType` and any durable state such as position, inventory, survivor count, or removal status.

## Adding a replay regression

Replay commands use `tick=command` entries joined by `&`. Multiple commands at the same tick are legal and their insertion order is significant. A replay test should advance two fresh harnesses one logical tick at a time and compare the same public state snapshot after every tick.

When a command encoding or timing rule must change, preserve the old replay string as a compatibility fixture before changing the implementation.

## Audio checks

The unit suite does not require speakers or commercial `ADLIB.DAT` data. It
uses a synthetic command source for exact timing and a known OPL register
sequence for deterministic, non-silent output. Always run the production
build as part of audio work: Vite must emit a separate transpiled
`audio-worklet-processor-*.js` asset rather than embedding raw TypeScript.

Before a release, manually compare music and effects in current Chrome,
Firefox, and Safari, including repeated track changes and returning from a
background tab. Where hardware allows, cover both 44.1 kHz and 48 kHz output.
Mobile Safari and Chrome require an explicit Play tap before audio can resume.

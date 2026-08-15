# Player data, preferences, and privacy

Lemmings.ts keeps preferences and completed-level progress in the browser's
local storage. The data never leaves the browser unless the player chooses
**Export player data**. The game does not store a name, account identifier,
analytics identifier, or other personal information.

## What is saved

- Music and effects volume and mute choices.
- Default game speed, toolbar contrast, and scaled-pixel rendering preference.
- Custom keyboard bindings.
- The last playable edition and level location.
- Completed levels, best survivor totals and percentages, and shortest
  completion duration.

Settings and progress use separate, versioned records:
`lemmings.ts.settings` and `lemmings.ts.progress`. Level completion keys combine
the stable edition identifier with the level's original order-table entry, so
renaming a level does not lose its record. The saved group and list positions
are used only when they still resolve to that same stable key.

Replay data, an in-progress level, audio track previews, and canvas position
are intentionally not saved.

## Recovery and portability

Every value is validated when it is read. Unsupported, partial, or damaged
records fall back to safe defaults. If storage is unavailable or full, the
game continues with an in-memory copy for the current page session.

The Preferences and player data panel can export both records as a small JSON
file and import a previously exported file. Import validates the complete file
before replacing either record.

**Reset preferences and progress** asks for confirmation, then removes only the
two Lemmings.ts records. It does not clear other sites' or applications' data.


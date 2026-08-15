# Controls and accessibility

The canvas, accessible toolbar, and keyboard shortcuts all use the same named
actions. Skill assignments and release-rate changes continue through the
replay-aware command manager, so changing input device does not change replay
behaviour.

## Pointer controls

- Tap or click a lemming to assign the selected skill.
- Drag the game area with a mouse, touch contact, or pen to move the map.
- Use the wheel over the canvas to zoom the map.
- The canvas captures the active pointer while dragging. Extra touch contacts
  are ignored, and cancellation always ends the drag or release-rate hold.
- Double-clicking the classic Nuke panel arms Nuke; repeat within four seconds
  to confirm. The semantic Nuke button and keyboard shortcut use the same rule.

Browser zoom remains available. The game does not use a viewport rule or
gesture handler that disables accessibility zoom. Landscape orientation is
recommended on narrow touch screens so the game area and controls have more
horizontal space.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `1`–`8` | Select Climber, Floater, Bomber, Blocker, Builder, Basher, Miner, or Digger |
| `-` / `+` | Decrease / increase release rate |
| Left / Right Arrow | Select the previous / next active lemming |
| Enter | Apply the selected skill to the keyboard-selected lemming |
| `P` | Pause or resume |
| `S` | Start or resume the level |
| `X` | Cycle through 1×, 2×, and 4× speed |
| `[` / `]` | Previous / next level |
| `N` twice | Arm, then confirm Nuke within four seconds |
| Escape | Cancel an armed Nuke |

Shortcuts are ignored while typing in an input, text area, select, or editable
content. Ctrl, Command, and Alt combinations are reserved for the browser and
operating system. Shift is ignored except for `+`, which commonly shares the
equals key.

The Preferences and player data panel can remap each shortcut by listening for
a new physical key. Bindings are saved locally and can be restored to their
defaults without changing gameplay or replay behaviour.

## Accessible toolbar

The semantic toolbar mirrors the classic canvas panel. Each skill is a native
button with its name, shortcut, available count, selected state, and disabled
state. All buttons meet a 44 by 44 CSS-pixel minimum target and have visible
keyboard focus. A concise visible line reports play state, time, lemmings out,
survivors, and selected skill.

Screen-reader announcements are limited to meaningful actions such as skill
selection, pause, keyboard lemming selection, speed changes, and Nuke state.
Time and position still update visually, but are not live announcements on
every simulation tick.

## Manual review checklist

- Complete a level using only the keyboard controls.
- Check focus order and focus visibility at 100% and 200% browser zoom.
- With a screen reader, spot-check skill names, counts, selected state, game
  status, keyboard-selected lemming, and Nuke confirmation.
- On touch or pen hardware, drag the map, tap a lemming, cancel a drag, and
  verify a second contact is ignored.
- Check desktop and narrow landscape layouts in Chrome, Firefox, and Safari.

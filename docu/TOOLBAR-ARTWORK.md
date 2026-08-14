# Editable toolbar artwork

The toolbar can be exported, edited as a normal PNG, and loaded back into the
game. Repacking `MAIN.DAT` is deliberately unnecessary.

## Export and edit

1. Add your legally obtained DOS data files and open any level.
2. Select **Export toolbar PNG** below the game canvas.
3. Put the downloaded `toolbar.png` in `temp/toolbar/`. The entire `temp/`
   directory is ignored by Git, so drafts and source material remain local.
4. Edit the PNG in a raster editor such as Aseprite, GIMP, Krita, or Photoshop.
5. For the standard Lemmings edition, the local setup links
   `public/data/lemmings/toolbar.png` to the ignored working copy. Save over
   `temp/toolbar/toolbar.png` and reload the level to preview it. For another
   edition, create the equivalent local link or copy beside its `MAIN.DAT`.
6. Remove or rename the PNG to return to the DOS toolbar.

The first export is 640x80: twice the original 320x40 resolution. Existing
higher-resolution overrides export at their native size.

## Supported sizes

The PNG must use the toolbar's 8:1 aspect ratio and one of these sizes:

| Scale | Size |
| --- | --- |
| 1x | 320x40 |
| 2x (recommended) | 640x80 |
| 3x | 960x120 |
| 4x | 1280x160 |

The game fits the selected size into the 800x100 toolbar area. It scales the
dynamic counters, status text, selection border, and pointer hit-testing to the
same logical grid.

## Button map

At the recommended 640x80 size, each button is 32 pixels wide. The action row
runs from y=32 through y=79.

| Slot | X range | Action |
| ---: | ---: | --- |
| 0 | 0-31 | Release rate down |
| 1 | 32-63 | Release rate up |
| 2 | 64-95 | Climber |
| 3 | 96-127 | Floater |
| 4 | 128-159 | Bomber |
| 5 | 160-191 | Blocker |
| 6 | 192-223 | Builder |
| 7 | 224-255 | Basher |
| 8 | 256-287 | Miner |
| 9 | 288-319 | Digger |
| 10 | 320-351 | Pause |
| 11 | 352-383 | Nuke (double-click) |

Do not bake skill counts or the `Out`, `In`, and `Time` text into the artwork;
the game draws those dynamically. Preserve a dark, uncluttered background in
those regions for contrast.

PNG alpha is supported. For predictable presentation, use an opaque background
unless transparency is an intentional part of the design.

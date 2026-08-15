# Asset provenance

This inventory covers tracked images and other media. Original game graphics,
music, sound, levels, and toolbar exports decoded at runtime are not repository
assets; they come from player-supplied DOS data and are excluded from Git.

| Tracked path | Production build | Recorded origin | License/status | Modifications or action |
| --- | --- | --- | --- | --- |
| `public/favicon.ico` | Yes | Present since the original project import; exact upstream source not recorded | Review before external release; it appears derived from classic game imagery | Keep for private use; replace with project-authored artwork before external distribution unless provenance is established |
| `src/assets/logo.png` | No; currently unused | Vue scaffold logo, added during the 2021 Vue conversion | Vue project material is generally MIT, but the exact copied file was not documented when added | Remove if it remains unused, or record an authoritative source before external source distribution |
| `docu/examples/main.png` | No; documentation only | Screenshot produced by the original project using player-supplied game data | Contains rendered commercial game artwork; review before external source distribution | Keep only in the private repository unless permission or a replacement is established |
| `docu/examples/demo_01.png` | No; documentation only | Screenshot produced by the original project using player-supplied game data | Contains rendered commercial game artwork; review before external source distribution | Same as above |
| `docu/examples/demo_02.png` | No; documentation only | Screenshot produced by the original project using player-supplied game data | Contains rendered commercial game artwork; review before external source distribution | Same as above |

## Replacement toolbar template

No replacement toolbar is currently committed. When one is introduced, add a
row before merging that identifies its repository path, author, canonical
source URL, exact license/version, and every local modification. A repository's
top-level license is not enough when that repository does not establish the
provenance of the particular artwork.

Locally exported or edited `public/data/**/toolbar.png` files are deliberately
ignored. They are private working material, not distributable project assets.

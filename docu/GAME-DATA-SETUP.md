# Original game-data setup

Lemmings.ts does not include or download the original DOS game files. Players
must use files from a copy they are legally entitled to use. The setup screen
is available at `/setup` and from the main menu or any data-loading error.

## Choose a setup method

### Reusable local folder

When the browser exposes a directory picker, **Choose reusable folder** grants
read-only access to one edition directory. The directory handle is saved in
browser storage so the player does not have to choose it after every visit.
The browser can still expire or revoke access. In that case the setup screen
shows **Grant folder access again**; permission is requested only after that
button is pressed.

The stored item is a browser permission handle, not a copy uploaded to the
application. **Remove local folder** deletes that edition's handle without
changing preferences, progress, or another edition.

### Folder for this session

**Choose folder for this session** uses a folder-capable file input. It works
without persistent directory handles, but the files must be selected again
after a reload. This is the fallback for browsers or browsing modes that do not
allow reusable folder permissions.

### Manual copy / static hosting

For local development and self-hosting, copy each edition into its matching
directory and use **Check static folder**:

| Edition | Directory |
| --- | --- |
| Lemmings | `public/data/lemmings/` |
| Oh No! More Lemmings | `public/data/lemmings_ohNo/` |
| Xmas Lemmings 1991 | `public/data/lemmings_X-Mas91/` |
| Xmas Lemmings 1992 | `public/data/lemmings_X-Mas92/` |
| Holiday Lemmings 1993 | `public/data/lemmings_Holiday93/` |
| Holiday Lemmings 1994 | `public/data/lemmings_Holiday94/` |

The per-directory README lists known filenames and sizes. Preserve uppercase
runtime filenames when using static hosting: web servers on case-sensitive
systems treat `main.dat` and `MAIN.DAT` as different paths.

Production builds intentionally contain only `config.json` and placeholder
documentation. To self-host with original data, copy the files into the built
`data/<edition>/` folders after building. Do not publish that combined folder
unless you have separate permission to distribute the original game data.

## What validation means

Every supported edition has an independent manifest. The validator reports:

- a required filename that is missing or differs only by capitalization;
- a folder that appears to belong to another edition or mixes editions;
- a file that cannot be read or is actually an HTML fallback page;
- a malformed compressed Lemmings container before game creation; and
- an unexpected size compared with the currently documented DOS build.

Missing, unreadable, wrong-edition, and corrupt files prevent a ready result.
Capitalization and size differences are warnings: local selection can repair a
case difference at lookup time, and a legitimate regional build may differ in
size. No strict file hashes are currently used, so an unknown but structurally
valid build is not rejected solely because it is different.

The standard Lemmings and Oh No! manifests cover their complete known runtime
sets independently. Xmas and Holiday editions have their own smaller manifests
and do not borrow readiness from another edition.

## Privacy and recovery

- File reads happen in the browser. There is no game-data upload request or
  server endpoint in this application.
- Filenames, contents, folder handles, and validation results are not sent to
  analytics or included in error reporting. The project has neither service.
- The app logs only general loader activity for static URLs; it does not log
  local file contents or folder handles.
- Local data sources affect only the selected edition. Documentation, setup,
  preferences, and saved progress remain available when files are absent.
- The release audit rejects `.DAT`, DOS executable, local toolbar, and other
  player-supplied assets from production artifacts.

Private-browsing restrictions, enterprise policy, storage clearing, or a moved
folder can make a saved handle unavailable. Choose the folder again or use the
session/manual-copy method; no player progress is lost.

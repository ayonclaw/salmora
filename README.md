# Salmora

After the seawall gave way, Salmora rebuilt one street inland. Salvage shops and ferry sheds took over the old customs district. You start at Lantern Quay just before the evening boats arrive, with a borrowed wagon and eighty crowns in your pocket.

## Play offline

Use Node.js 22 or newer. Run `node serve.ts`, then open the printed loopback address in a desktop browser with WebGL 2. No install, account, or internet connection is required. Click **Enter the quay** to capture the mouse. Append `?quality=low` to turn off shadows.

| Key | On foot | In the wagon |
| --- | --- | --- |
| W / A / S / D | Walk | Accelerate / steer / brake or reverse |
| Mouse | Look | Orbit the chase camera |
| Shift | Run | — |
| Space | Hop | Brake |
| E | Enter near the wagon | Exit once stopped |
| Esc | Pause and release the mouse | Same |
| R | Return to the quay | Same |

## Views

The four Stage A screenshots in `screenshots/` show **Arrival** (title), **Lantern Quay** (street), **The Bay** (vista), and **The Wagon** (driving). The same views can be opened using `?shot=title`, `?shot=street`, `?shot=vista`, and `?shot=drive`.

## Package

Run `node main.ts` to produce the static game, screenshots, and `dossier.json`. It writes to `/output` by default; set `MAKEFUN_OUTPUT_DIR` to use another directory.

Stage A covers free roaming and the wagon. Jobs and progression are not part of this build. Salmora is developed for make.fun's `gta6-01` competition. See `LICENSE` for this project's MIT terms; Three.js carries its own notice under `game/vendor/`.

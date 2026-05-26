# Fairy Guild Defense

A cheerful isometric Phaser minigame where a chosen village defender protects a fairy-tale village from waves of mischievous forest creatures. Choose Warrior, Archer, or Sorcerer, defend buildings with class abilities, and shape each run through common level-up cards.

## Features

- Isometric-style fairy-tale village defense arena
- Three playable classes: Warrior, Archer, and Sorcerer
- Class attacks and skills: Sword Slash/Shield Guard, Bow Shot/Trap, and Wand Bolt/Magic Shield
- Immediate paid repair action for restoring damaged buildings
- Budget-built waves with seven readable forest enemy roles
- Building health and village safety tracking
- Round-clear two-card choices with five-tier persistent progression
- Gold-only enemy rewards credited automatically with fading coin feedback
- Seasonal guardian rounds with building-targeted projectile volleys
- Game over screen when the castle falls or the hero reaches 0 hearts
- Designer-authored procedural level system with logical blockers, edge spawns, A* routes, decoration passes, and visual time-of-day profiles
- Rich procedural Web Audio SFX and a gentle interaction-started village theme
- Family-friendly effects: sparkles, puffs, dazed reactions, and retreating monsters
- Generated image assets in a bright cartoon storybook style

## Controls

| Action | Input |
| --- | --- |
| Move | `WASD` or arrow keys |
| Main attack | `Space` or left click |
| Class skill | `F` |
| Repair nearest damaged building | `E` |
| Pick level-up card | `1` or `2` on the level-up screen |
| Toggle level grid debug | `G` |
| Cycle time-of-day preview | `N` |
| Start game | Click/tap `START`, `Enter`, or `Space` on the title screen |
| Restart after game over | `R` |

On touch devices, the game shows a landscape-first mobile overlay with a left joystick and exactly three actions: left main attack, right class skill, and bottom repair. Ranged attacks auto-target nearby enemies on mobile. Portrait phones show a rotate hint.

## Mobile & PWA

Mobile Safari cannot forcibly hide the browser/navigation chrome for an ordinary webpage. For the most immersive mode, add the app to the Home Screen and launch it from there; the web manifest and Apple mobile meta tags request fullscreen/standalone landscape play. When opened normally in Safari, the layout uses dynamic viewport sizing and safe-area insets so the canvas fits below the visible browser UI.

For mobile diagnostics, append `?debugTouch=1` to log touch detection, Phaser touch-control creation, canvas visibility, and safe-area layout details. Append `?touchControls=1` to force the touch overlay while testing in desktop browser emulation.

The PWA shell includes PNG app icons for iOS and installable browsers. Use `?debugGame=1` or press `B` to show a small balance overlay with phase, enemy counts, building HP, hero stats, and current resources.

## Progression

The game opens on a title screen for `The Village Must Stand`, credited as `A minigame by Javier Algaba`. Choose a class and press `Start Defense` to begin the Level 1 countdown. The Warrior starts with 4 hearts; Archer and Sorcerer start with 3. Each cleared wave pauses gameplay for a two-card level-up choice. Wave completion counts resolved threats, including Bomb Bud detonations, without awarding defeat credit for enemies the player did not defeat.

Persistent cards can be selected up to Tier V:

- `Swift Boots`: movement speed
- `Stronger Strikes`: main-attack damage
- `Quick Hands`: main-attack speed
- `Reinforced Walls`: building maximum health
- `Tough Heart`: maximum hearts and one immediate heal
- `Magic Repair`: situational one-time full repair for surviving buildings

Buildings keep their damage between levels. Press `E` near a damaged building to immediately spend 5 gold and restore 16 HP. Non-castle buildings at 0 HP can be repaired. Enemies grant gold immediately when defeated; there are no collectible rewards, XP, mana, inventory purchases, or reward chests.

Early levels use class-specific enemy unlock curves and a first-level repair tip so the player has time to understand the defense loop. Enemy strength, wave budgets, repair values, class skills, cards, and guardian tuning are configured in `src/gameConfig.ts`.

The procedural level foundation lives in `src/levels/`. Procedural maps are the default map on every fresh start. Seasonal villages build a `25 x 25` board with playable bounds `3..21`, a scenic forest buffer, perimeter spawn cells, and protected buildings placed away from the border. Generated scenes use a smoothly following zoomed-in world camera, camera-driven scenic parallax, and lightweight seasonal atmosphere while HUD and touch controls remain screen-fixed. `?generatedLevel=festival-village` renders a second catalog level, while `?staticMap=1` temporarily restores the older painted board for comparison. Designers can preview variants with query overrides such as `?seed=my-seed`, `?density=0.6`, `?difficulty=2`, `?tileSize=64`, and `?timeOfDay=night`. `N` cycles lighting profiles at runtime. `?debugLevel=1` or `G` overlays the grid, blockers, protected building footprints, spawn points, attack cells, validation routes, decorations, and live enemy paths.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Open the app at:

```text
http://localhost:5173/
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run the full smoke check:

```bash
npm test
```

Or run TypeScript, ESLint, and production build checks separately:

```bash
npm run typecheck
npm run lint
npm run build
```

Rebuild or validate the fixed-cell atlas assets:

```bash
npm run build:class-assets
npm run validate:class-assets
npm run build:atlases
npm run validate:atlases
npm run build:scene-variants
npm run validate:scene-variants
```

Run the local test server script:

```bash
npm run test
```

## Vercel Deployment

The project includes `vercel.json` for Vercel's Vite preset. Vercel should use:

- Build command: `npm run build`
- Output directory: `dist`

To deploy from the Vercel dashboard, import the repository and keep the detected framework as Vite. Local Vercel project metadata is ignored via `.vercel/`.

## Project Structure

```text
.
|-- docs/
|   `-- base-prompt.md
|-- public/
|   `-- assets/
|       |-- atlas-sources/
|       |   `-- generated/
|       |-- buildings_atlas.json
|       |-- buildings_atlas.png
|       |-- archer-hero-sheet.png
|       |-- archer-hero-sheet-source.png
|       |-- effects_atlas.json
|       |-- effects_atlas.png
|       |-- game-over-ui.png
|       |-- game-over-ui-source.png
|       |-- guild-notes-ui.png
|       |-- guild-notes-ui-transparent.png
|       |-- hero-sheet.png
|       |-- hero-sheet-source.png
|       |-- hud_bars_atlas.json
|       |-- hud_bars_atlas.png
|       |-- hud_ui_atlas.json
|       |-- hud_ui_atlas.png
|       |-- level-up-ui.png
|       |-- level-up-ui-source.png
|       |-- monster-pickup-sheet.png
|       |-- monster-pickup-sheet-source.png
|       |-- repair-tool.png
|       |-- repair-tool-source.png
|       |-- status-panel-ui.png
|       |-- touch_controls_atlas.json
|       |-- touch_controls_atlas.png
|       |-- ui_atlas.json
|       |-- ui_atlas.png
|       |-- village-board.png
|       |-- world_edges_atlas.json
|       |-- world_edges_atlas.png
|       |-- world_tiles_atlas.json
|       |-- world_tiles_atlas.png
|       |-- world-ui-sheet.png
|       `-- world-ui-sheet-source.png
|-- src/
|   |-- levels/
|   |   |-- assetRegistry.ts
|   |   |-- defaultVillageLevel.ts
|   |   |-- generateLevel.ts
|   |   |-- levelCatalog.ts
|   |   |-- levelTypes.ts
|   |   |-- pathfinding.ts
|   |   |-- seededRandom.ts
|   |   `-- timeOfDay.ts
|   |-- gameConfig.ts
|   |-- main.ts
|   `-- style.css
|-- index.html
|-- package.json
|-- eslint.config.js
|-- tsconfig.json
|-- tools/
|   |-- atlas-manifest.mjs
|   |-- build-class-assets.mjs
|   `-- build-atlases.mjs
|-- vercel.json
`-- README.md
```

## Asset Notes

The project-bound assets were generated with Image Gen / GPT Image 2 and copied into `public/assets/`. The source images are kept alongside processed transparent versions where applicable. The Archer class uses `archer-hero-sheet-source.png`, and the Sorcerer uses the wand-only `sorcerer-hero-sheet-source.png`; `npm run build:class-assets` processes these into their transparent runtime sheets. The legacy `princess-hero-sheet` files remain in the repository but are no longer the normal Sorcerer presentation. Touch controls, effects, and the six common card illustrations are generated as individual padded square sources under `public/assets/atlas-sources/generated/class-ui/`, then chroma-cleaned and validated before atlas packing. The shared class/level-up Card Box shell and the Warrior, Archer, and Sorcerer portrait tiles live under `public/assets/atlas-sources/generated/card-ui/`; the shell is packed into `game_ui_atlas` while the portraits are packed into `ui_atlas`. This avoids contact-sheet cropping and rejects visible backing pixels or art outside the safe margin. The current generated map uses deterministic fixed-cell atlases built from source art: `world_tiles_atlas`, `world_edges_atlas`, `buildings_atlas`, `ui_atlas`, `effects_atlas`, `touch_controls_atlas`, `hud_ui_atlas`, and `hud_bars_atlas`. Seasonal board visuals are built from chroma-key sheets under `public/assets/scene-variants/sources/<theme>/` into `scene_variant_terrain_atlas`, `scene_variant_props_atlas`, and `scene_variant_buildings_atlas`; the runtime themes are `spring`, `summer`, `twilight_autumn`, and `winter`. The existing `night_spring` world key intentionally renders with the `twilight_autumn` library. The older `world-ui-sheet.png` is treated as source art for atlas rebuilding rather than a runtime crop target.

Atlas split rules:

- `world_tiles_atlas`: playable terrain and world props.
- `world_edges_atlas`: floating-island cliff rims, corner caps, a soft island shadow, fog surround bands, and sparse off-board decorative edge clusters.
- `buildings_atlas`: castle, houses, market, bakery, and well frames.
- `ui_atlas`: square gameplay icons, unique level-up card illustrations, and class-selection portrait tiles.
- `game_ui_atlas`: reusable panel pieces, buttons, HUD chips, and the shared portrait Card Box frame.
- `touch_controls_atlas`: touch button icons, including distinct class-skill icons, used by the Phaser mobile overlay.
- `hud_ui_atlas`: square/compact HUD badges such as coin, crown, and repair tool.
- `hud_bars_atlas`: long HUD bar frames only, with a separate fixed rectangular cell size.
- `effects_atlas`: smoke, sparkles, arrows, magic splashes, shield glows, the placed Trap, and the active Magic Shield field.
- `scene_variant_terrain_atlas`: theme-specific grass, path, and plaza diamond tiles.
- `scene_variant_props_atlas`: theme-specific trees, rocks, ponds, vegetation, lamps, fences, and signs.
- `scene_variant_buildings_atlas`: role-preserving seasonal castle and village building presentations.

Large panel art remains standalone: generated `status-panel-ui.png`, `guild-notes-ui-transparent.png`, textless `level-up-ui.png`, and `game-over-ui.png`.

Composable asset rule: keep UI panels textless and transparent. Swappable sprites, labels, hit areas, progress bars, live values, and colored card stages should remain Phaser-owned layers so future sprite swaps do not require regenerating panel art.

## Design Reference

The original creative and technical brief is preserved in [docs/base-prompt.md](docs/base-prompt.md). Use it as the starting point for future art passes, mechanic expansions, balance changes, and additional minigame iterations.

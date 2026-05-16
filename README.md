# Fairy Guild Defense

A cheerful isometric Phaser minigame where a young guild hero protects a fairy-tale village from level-based rounds of cute, mischievous forest creatures. The game uses generated cartoon assets, playful nonviolent combat feedback, round-clear level-up choices, gold upgrades, treasure chests, building safety, and friendly live Guild Notes.

## Features

- Isometric-style fairy-tale village defense arena
- Real-time hero movement with keyboard controls
- Wooden sword melee attack, bow shot, and mana-based sparkle spell
- Repair Kit mode for spending gold to restore damaged buildings
- Charming monster rounds that target village buildings
- Data-driven enemy archetypes and enhanced variants for easier balancing
- Building health and village safety tracking
- Round-clear level-up screen with melee, range, or magic damage choices and progress pips
- XP score, gold drops, treasure chests, and upgrade progression
- Inventory panel with six upgrade paths
- Game over screen when the castle falls or the hero reaches 0 hearts
- Designer-authored procedural level scaffold with logical blockers, A* routes, decoration passes, and visual time-of-day profiles
- Rich procedural Web Audio SFX and a gentle interaction-started village theme
- Family-friendly effects: sparkles, puffs, dazed reactions, and retreating monsters
- Generated image assets in a bright cartoon storybook style

## Controls

| Action | Input |
| --- | --- |
| Move | `WASD` or arrow keys |
| Melee attack | `Space` |
| Bow attack | Mouse click or `F` |
| Spell cast | `Q` or `R` |
| Toggle Repair Kit | `T` |
| Repair with kit | `Space`, mouse click, or `E` while Repair Kit is active |
| Open chest | `E` outside Repair Kit mode |
| Inventory | `I` |
| Buy upgrade | `1` through `6` while inventory is open |
| Pick level-up bonus | `1`, `2`, or `3` on the level-up screen |
| Toggle level grid debug | `G` |
| Cycle time-of-day preview | `N` |
| Start game | Click/tap `START`, `Enter`, or `Space` on the title screen |
| Restart after game over | `R` |

On touch devices, the game shows a landscape-first mobile overlay with a left joystick and right-side action buttons for Sword, Bow, Spell, Repair Kit, Use, and Inventory. Bow and Spell auto-target nearby enemies on mobile. Portrait phones show a rotate hint.

## Mobile & PWA

Mobile Safari cannot forcibly hide the browser/navigation chrome for an ordinary webpage. For the most immersive mode, add the app to the Home Screen and launch it from there; the web manifest and Apple mobile meta tags request fullscreen/standalone landscape play. When opened normally in Safari, the layout uses dynamic viewport sizing and safe-area insets so the canvas fits below the visible browser UI.

For mobile diagnostics, append `?debugTouch=1` to log touch detection, Phaser touch-control creation, canvas visibility, and safe-area layout details. Append `?touchControls=1` to force the touch overlay while testing in desktop browser emulation.

The PWA shell includes PNG app icons for iOS and installable browsers. Use `?debugGame=1` or press `B` to show a small balance overlay with phase, enemy counts, building HP, hero stats, and current resources.

## Progression

The game opens on a title screen for `The Village Must Stand`, credited as `A minigame by Javier Algaba`. Press `START` to begin the Level 1 countdown. The hero starts with 3 hearts. Each level begins with a countdown, then a finite enemy round starts. When all enemies in the current level are defeated, gameplay pauses and a level-up screen appears.

Every level-up grants `Heart +1` and one chosen training bonus:

- `1` Melee Damage: increases sword power
- `2` Range Damage: increases bow power
- `3` Magic Damage: increases spell power

Buildings keep their damage between levels. Press `T` to ready the Repair Kit, then use `Space`, mouse click, or `E` near a damaged building to spend 5 gold and restore 16 HP. Non-castle buildings at 0 HP can be repaired and become valid monster targets again once their HP rises above 0. If the castle reaches 0 HP, or the hero reaches 0 hearts, the game ends.

Early levels use a gentler spawn curve and a first-level repair tip so the player has more time to understand the defense loop. Enemy strength, round size, repair values, and compact Guild Notes behavior are configured in `src/gameConfig.ts`. Archetypes control base HP, speed, damage, rewards, unlock level, and spawn weight; variants add tint, scale, and stat multipliers for brighter or elder enemies in later levels.

The procedural level foundation lives in `src/levels/`. The current painted village remains the default map, but `?generatedLevel=1` renders the default designer-authored token matrix and `?generatedLevel=festival-village` renders a second catalog level. Level catalog entries live in `levelCatalog.ts`; designers can also preview variants with query overrides such as `?seed=my-seed`, `?density=0.6`, `?difficulty=2`, `?tileSize=64`, and `?timeOfDay=night`. Generated maps honor `tileSize` by scaling the isometric diamond spacing and generated object art while leaving the static painted board unchanged. The generator uses reusable registry entries and sliced `world-ui-sheet.png` frames where available, then adds deterministic nonblocking flowers, mushrooms, sparkles, and magical plants around designer-authored structure. `N` cycles lighting profiles at runtime. `?debugLevel=1` or `G` overlays the logical grid, blockers, protected building footprints, spawn points, attack cells, validation routes, chests, decorations, and live enemy paths. The `B` balance panel also shows live target counts, tile metrics, and route scores so designers can see why monsters prefer a building. In generated-level mode, large-object footprints block player movement and monsters route along A* paths toward protected buildings.

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
|       |-- game-over-ui.png
|       |-- game-over-ui-source.png
|       |-- guild-notes-ui.png
|       |-- guild-notes-ui-transparent.png
|       |-- hero-sheet.png
|       |-- hero-sheet-source.png
|       |-- level-up-ui.png
|       |-- level-up-ui-source.png
|       |-- monster-pickup-sheet.png
|       |-- monster-pickup-sheet-source.png
|       |-- repair-tool.png
|       |-- repair-tool-source.png
|       |-- status-panel-ui.png
|       |-- village-board.png
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
|-- vercel.json
`-- README.md
```

## Asset Notes

The project-bound assets were generated with Image Gen / GPT Image 2 and copied into `public/assets/`. The source sheets are kept alongside processed transparent versions where applicable. The current game uses the generated village board as the main scene backdrop, generated hero and monster sheets for characters, generated `status-panel-ui.png` and `guild-notes-ui-transparent.png` HUD frames, a standalone transparent `repair-tool.png` sprite, and generated textless `level-up-ui.png` and `game-over-ui.png` panels.

Composable asset rule: keep UI panels textless and transparent. Swappable sprites, labels, hit areas, progress bars, live values, and colored card stages should remain Phaser-owned layers so future sprite swaps do not require regenerating panel art.

## Design Reference

The original creative and technical brief is preserved in [docs/base-prompt.md](docs/base-prompt.md). Use it as the starting point for future art passes, mechanic expansions, balance changes, and additional minigame iterations.

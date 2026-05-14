# Fairy Guild Defense

A cheerful isometric Phaser minigame where a young guild hero protects a fairy-tale village from waves of cute, mischievous forest creatures. The game uses generated cartoon assets, playful nonviolent combat feedback, XP leveling, gold upgrades, treasure chests, building safety, and friendly live Guild Notes.

## Features

- Isometric-style fairy-tale village defense arena
- Real-time hero movement with keyboard controls
- Wooden sword melee attack, bow shot, and mana-based sparkle spell
- Charming monster waves that target village buildings
- Building health and village safety tracking
- XP, leveling, gold drops, treasure chests, and upgrade progression
- Inventory panel with six upgrade paths
- Family-friendly effects: sparkles, puffs, dazed reactions, and retreating monsters
- Generated image assets in a bright cartoon storybook style

## Controls

| Action | Input |
| --- | --- |
| Move | `WASD` or arrow keys |
| Melee attack | `Space` |
| Bow attack | Mouse click or `F` |
| Spell cast | `Q` or `R` |
| Open chest / interact | `E` |
| Inventory | `I` |
| Buy upgrade | `1` through `6` while inventory is open |

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

Run the local test server script:

```bash
npm run test
```

## Project Structure

```text
.
|-- docs/
|   `-- base-prompt.md
|-- public/
|   `-- assets/
|       |-- hero-sheet.png
|       |-- hero-sheet-source.png
|       |-- monster-pickup-sheet.png
|       |-- monster-pickup-sheet-source.png
|       |-- village-board.png
|       |-- world-ui-sheet.png
|       `-- world-ui-sheet-source.png
|-- src/
|   |-- main.js
|   `-- style.css
|-- index.html
|-- package.json
`-- README.md
```

## Asset Notes

The project-bound assets were generated with Image Gen / GPT Image 2 and copied into `public/assets/`. The source sheets are kept alongside processed transparent versions where applicable. The current game uses the generated village board as the main scene backdrop, generated hero and monster sheets for characters, and Phaser-drawn runtime textures for crisp interactive markers, pickups, and upgrade icons.

## Design Reference

The original creative and technical brief is preserved in [docs/base-prompt.md](docs/base-prompt.md). Use it as the starting point for future art passes, mechanic expansions, balance changes, and additional minigame iterations.

# Fairy Guild Defense

A cheerful isometric Phaser minigame where a young guild hero protects a fairy-tale village from level-based rounds of cute, mischievous forest creatures. The game uses generated cartoon assets, playful nonviolent combat feedback, round-clear level-up choices, gold upgrades, treasure chests, building safety, and friendly live Guild Notes.

## Features

- Isometric-style fairy-tale village defense arena
- Real-time hero movement with keyboard controls
- Wooden sword melee attack, bow shot, and mana-based sparkle spell
- Charming monster rounds that target village buildings
- Building health and village safety tracking
- Round-clear level-up screen with melee, range, or magic damage choices and progress pips
- XP score, gold drops, treasure chests, and upgrade progression
- Inventory panel with six upgrade paths
- Game over screen when the castle falls or the hero reaches 0 hearts
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
| Pick level-up bonus | `1`, `2`, or `3` on the level-up screen |
| Restart after game over | `R` |

## Progression

The hero starts with 3 hearts. Each level begins with a countdown, then a finite enemy round starts. When all enemies in the current level are defeated, gameplay pauses and a level-up screen appears.

Every level-up grants `Heart +1` and one chosen training bonus:

- `1` Melee Damage: increases sword power
- `2` Range Damage: increases bow power
- `3` Magic Damage: increases spell power

Buildings keep their damage between levels. If a non-castle building reaches 0 HP, it remains damaged and monsters stop targeting it. If the castle reaches 0 HP, or the hero reaches 0 hearts, the game ends.

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
|       |-- status-panel-ui.png
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

The project-bound assets were generated with Image Gen / GPT Image 2 and copied into `public/assets/`. The source sheets are kept alongside processed transparent versions where applicable. The current game uses the generated village board as the main scene backdrop, generated hero and monster sheets for characters, generated `status-panel-ui.png` and `guild-notes-ui-transparent.png` HUD frames, and generated textless `level-up-ui.png` and `game-over-ui.png` panels with Phaser-rendered labels, buttons, level-up card stages, generated card icons, and progress pips for reliable interaction.

## Design Reference

The original creative and technical brief is preserved in [docs/base-prompt.md](docs/base-prompt.md). Use it as the starting point for future art passes, mechanic expansions, balance changes, and additional minigame iterations.

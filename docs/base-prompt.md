# Base Prompt

This document preserves the original creative and technical brief for future iterations of **Fairy Guild Defense**.

## Game Concept

Generate a Phaser minigame: a cheerful isometric action RPG inspired by classic Zelda-like adventures, with a bright cartoon fairy-tale style. Use Image Gen with GPT Image 2 to create the sprites, tiles, UI icons, characters, monsters, weapons, spell effects, chests, buildings, and environment assets.

The player is a young guild-style hero, inspired by the feeling of characters like Link, Harry Potter, or Ash Ketchum, but fully original. The hero protects a magical fairy-tale village from waves of charming monsters. The tone must be adventurous, colorful, wholesome, and suitable for kids and general audiences. Do not make the game dark, scary, violent, bloody, or grim.

## Setting

Create an isometric fairy-tale town with a small castle, cozy houses, cobblestone paths, gardens, wells, lamps, and colorful market stalls. The village is surrounded by an enchanted forest with glowing plants, friendly magical details, mushrooms, ancient trees, and hidden treasure chests.

## Core Gameplay

The player controls the hero in real time from an isometric perspective. Charming monsters come from the enchanted forest and try to damage village buildings. The player must defend the village using three main abilities:

1. A basic melee weapon, such as a wooden sword or short magical blade.
2. A bow for ranged attacks.
3. A simple magical spell that uses mana.

Combat should feel playful and arcade-like, with soft impact effects, stars, sparkles, puffs of smoke, and funny reactions. Monsters should disappear, retreat, or become dazed when defeated. Avoid realistic violence.

## Monster Style

Design monsters to be charming and memorable, similar in tone to creatures from Pokemon or Zelda games. They can be mischievous forest blobs, tiny horned sprites, mushroom creatures, round goblin-like critters, leafy lizards, or floating magical pests. They should look cute, silly, or quirky rather than ugly, scary, or evil.

## Progression

The hero earns XP by stopping monsters and protecting the village. When enough XP is gained, the hero levels up. Leveling up can improve health, mana, attack power, bow range, spell strength, or movement speed.

The hero can also collect gold coins from treasure chests, monster drops, and village rewards. Gold can be used to unlock or upgrade better skills and weapons, such as:

- Stronger sword
- Faster bow
- Larger mana pool
- Improved spell
- Faster movement
- Better armor or shield effect

## Treasure Chests

Place treasure chests around the village and forest edges. Chests may contain gold, XP bonuses, temporary buffs, mana potions, health hearts, or weapon upgrades. Opening chests should feel rewarding and magical, with a bright animation and sound cue.

## Village Defense

Village buildings have simple health or protection values. Monsters try to reach and damage buildings, but the tone should remain lighthearted. Buildings can shake, flash, or show cartoon "repair needed" icons instead of destruction. The player's goal is to keep the village safe for as long as possible or survive a series of waves.

## User Interface

Show a clear status bar with:

- Life / hearts
- Mana
- Gold
- XP and current level
- Equipped weapon
- Current spell
- Village safety or building health

Also show a small inventory panel for weapons and upgrades. The inventory should be simple and readable, suitable for kids and casual players.

## Live Feedback Panel

Include a small "Village Updates" or "Guild Notes" panel with friendly real-time messages such as:

- "A chest appeared near the old oak!"
- "Mushroom sprites are heading toward the bakery!"
- "The castle guard cheers you on!"
- "You found 25 gold!"
- "Level up! Your mana increased!"
- "The village is safe for now!"

## Art Direction

Use a colorful isometric cartoon style. The game should feel magical, cozy, adventurous, and family-friendly. Use soft outlines, bright colors, expressive animations, and clear silhouettes. Avoid horror, darkness, gore, realistic weapons, or intimidating monster designs.

## Assets To Generate With Image Gen

- Hero idle, walk, melee attack, bow attack, spell cast, hurt, and victory animations
- Charming monster types with walk, attack, hit, and defeated/retreat animations
- Isometric fairy-tale village tiles
- Castle, houses, market stalls, wells, lamps, paths, trees, forest props
- Treasure chests, coins, hearts, mana orbs, XP stars
- Sword, bow, spell icons, upgrade icons
- UI panels, status bars, inventory slots, and wave indicators
- Magical effects such as sparkles, arrows, spell bursts, shield glows, and chest-opening effects

## Game Loop

1. Start in the fairy-tale village.
2. Show the hero, village buildings, forest border, and UI.
3. Spawn charming monsters from forest paths in waves.
4. Let the player move, attack with sword, shoot bow, and cast spell.
5. Monsters attempt to reach village buildings.
6. Player earns XP and gold by defending the village.
7. Player finds and opens treasure chests.
8. Player levels up and unlocks upgrades.
9. Each new wave introduces slightly stronger or more varied charming monsters.
10. The goal is to protect the village, grow stronger, and become a beloved guild hero.

## Controls

- Arrow keys or WASD to move
- Space for melee attack
- Mouse click or a key for bow attack
- Another key for spell casting
- E to open chests or interact
- I to open inventory

## Technical Requirements

Build the game in Phaser using an isometric-style camera and tile layout. Keep the mechanics simple, responsive, and easy to understand. Include placeholder logic for waves, XP, leveling, gold collection, inventory, chests, village building health, enemy AI, melee attack, ranged bow attack, and mana-based spell casting.

The final result should feel like a small, cheerful Zelda-like village defense RPG minigame for a broad general audience, including kids.

## Current Implementation Notes

- The playable app is implemented in `src/main.js`.
- Generated image assets are stored under `public/assets/`.
- The main village board uses `public/assets/village-board.png`.
- Hero and monster sheets are loaded from `public/assets/hero-sheet.png` and `public/assets/monster-pickup-sheet.png`.
- The current progression is round-clear based: each level starts with a countdown, spawns a finite enemy round, then pauses for a level-up choice once all enemies are defeated.
- The hero starts with 3 hearts. Each level-up grants `Heart +1` and one selected damage bonus: melee, range, or magic.
- Buildings persist their damage across levels. Non-castle buildings remain damaged at 0 HP; castle HP reaching 0 triggers game over.
- The hero reaching 0 hearts also triggers game over, with a restart screen.
- The level-up and game-over screens use generated textless UI art from `public/assets/level-up-ui.png` and `public/assets/game-over-ui.png`, with all functional text rendered in Phaser.
- The level-up screen keeps `public/assets/level-up-ui-source.png` as its chroma-key source and renders each card's colored stage, five-pip progress bars, and hover preview in Phaser so future sprite swaps do not require regenerating the panel art.
- The level-up sword, range, and magic card icons use cropped generated frames from `public/assets/world-ui-sheet.png` instead of runtime placeholder drawings.
- The status bar and Guild Notes panel use generated textless UI art from `public/assets/status-panel-ui.png` and `public/assets/guild-notes-ui-transparent.png`, with all functional text rendered in Phaser for readability.
- Some crisp interactive markers and HUD icons are generated at runtime with Phaser graphics for readability.

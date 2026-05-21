# The Village Must Stand - Project Progress

## Current Game Shape

The project is a Vite, TypeScript, and Phaser 3 browser game. The main playable scene lives in `src/main.ts`, with balance and progression constants in `src/gameConfig.ts` and procedural level support in `src/levels/`.

The game opens on a startup overlay where the player chooses a hero and starts a fresh run. Each run begins at Level 1 with 3 hearts, gold at 0, and the first spring round. Generated maps are the default playfield, with world variants advancing after boss rounds.

## Gameplay Systems

- The player defends village buildings from finite enemy rounds.
- Combat uses melee, bow, and spell actions. Mana remains a hidden spell resource, but it is no longer shown as a HUD bar.
- Buildings keep HP and can be repaired with gold while Repair Kit mode is active.
- Building condition is shown directly in-world with health bars using green, yellow, and red semaphore colors.
- Normal level clears award gold, XP, and one combat training choice.
- Boss clears award gold, XP, one combat training choice, and one new max heart.
- Range training fills a five-step bow mastery track; once full, the next range choice evolves the bow into a faster, stronger version.
- Game over can happen when the hero runs out of hearts or the castle reaches 0 HP.

## Recent UI And Flow Decisions

- Startup and level-up overlays use fitted title text so labels stay inside ornate banner frames.
- Hero selection buttons are larger and keep selected badge, sprite, and caption in separate visual slots.
- Level-up cards no longer show numeric shortcut labels, but keyboard shortcuts still work.
- The level-up panel now tiles its ornate border pieces across wide and tall overlays so the frame does not reveal missing background gaps.
- Level-up card detail labels sit inside a dedicated lower slot, and the title plaque is taller with vertically centered text.
- Game-over restart returns to the startup hero picker and starts over from Level 1 instead of resuming the current run.
- The mana HUD bar was removed from the top HUD; mana logic still powers spells and pickups.

## Validation Policy

For the current implementation pass, use only static/build checks:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Do not run `npm test`, `npm run dev`, browser screenshots, debug automation, or manual gameplay verification unless requested.

# Project Guidelines

## Scope

- This repository is a Vite + TypeScript + Phaser 3 browser game.
- Use this root `AGENTS.md` as the single project-wide instruction file for the repo.
- See [README.md](README.md) for gameplay rules, debug toggles, and deployment notes.
- See [docs/base-prompt.md](docs/base-prompt.md) for the original design and art direction.

## Architecture

- `src/main.ts` is the browser bootstrap only: import CSS, choose the app route, configure Phaser, and create the game instance.
- `src/scenes/FairyGuildScene.ts` owns the main Phaser scene lifecycle and high-level orchestration. Keep it as an adapter over smaller systems instead of adding new feature logic directly to the scene.
- `src/systems/` contains scene-adapter modules and testable helpers for HUD, overlays, input, player flow, debug text, and generated-world rendering. Prefer adding focused system helpers there when behavior needs Phaser scene state but can still be isolated.
- `src/gameConfig.ts` is the source of truth for balance constants, spawn pacing, repair values, and progression. Prefer updating config over scattering new literals through scene code.
- `src/combat.ts`, `src/projectiles.ts`, and focused helper modules such as `src/combatTargeting.ts` own combat behavior. Keep target-selection rules and other gameplay decisions in pure helpers when they can be tested without Phaser.
- `src/levels/` contains procedural level generation, validation, catalog selection, pathfinding, and time-of-day logic.
- `src/mapEditor/` contains the authored-map editor scene plus extracted editor serialization, config, rendering metadata, and camera helpers.
- `src/sceneVariants.ts`, `src/sceneVariantRenderer.ts`, `src/viewportBackdrop.ts`, and the asset registries should stay the place where variant-, surround-, and asset-selection logic lives; prefer extending those registries or helpers instead of hardcoding new asset paths in scene code.
- Browser gutters around the fixed 16:9 Phaser canvas are intentional presentation space. Preserve Phaser `FIT` scaling unless explicitly asked to crop; use `src/viewportBackdrop.ts` and scene-variant CSS variables to update decorative page backdrops.
- New features should first look for a pure domain module or `src/systems/` boundary before adding methods or state to `FairyGuildScene`.

## Assets And Tooling

- Treat built atlas manifests and generated sprite sheets in `public/assets/` as generated outputs when a matching source exists under `public/assets/atlas-sources/` or a builder in `tools/` produces them.
- Use existing scene-variant background, frame, foreground, terrain, prop, building, and environment-frame assets for visual polish before adding new artwork.
- Prefer changing source art, manifests, or build scripts over hand-editing generated atlas JSON.
- Keep Node tooling in `tools/*.mjs` compatible with the existing CLI surface, including validation modes such as `--validate-only`.
- Do not edit `dist/` unless the task is explicitly about build output.

## Code Style

- Match the existing TypeScript style: ESM imports, single quotes, semicolons, descriptive names, and focused functions.
- Keep logic near its owning module instead of introducing extra abstraction layers without a clear payoff.
- Avoid meaningful magic numbers in gameplay, rendering, and UI code. Extract tunable numeric or color literals into descriptively named constants; put shared balance/config values in `src/gameConfig.ts` and keep one-off local tuning constants close to the owning code.
- Prefer explicit types when touching existing TypeScript surfaces; if a value is intentionally unused, prefix it with `_` to satisfy ESLint.
- Add comments only when a block is hard to infer from the code itself.

## Build And Test

- Install dependencies with `npm install`.
- Use the narrowest relevant validation first: `npm run typecheck`, `npm run lint`, or `npm run build`.
- Run `npm run test:coverage` when refactoring or extracting modules. Coverage is reported with V8 reporters but is not threshold-gated yet.
- Add colocated Vitest coverage for pure behavior in new or extracted modules, especially helpers in `src/systems/`, `src/levels/`, and `src/mapEditor/`.
- Run `npm test` before handoff when a change affects gameplay, assets, or build tooling. The test script validates world-enemy assets, typechecks, lints, and builds.
- For asset-pipeline changes, run the relevant script as needed: `npm run build:atlases`, `npm run validate:atlases`, `npm run build:world-enemies`, `npm run validate:world-enemies`, or `npm run build:scene-variants`.
- Use `npm run dev` for manual verification. The README documents useful debug flags such as `?debugGame=1`, `?debugLevel=1`, `?debugTouch=1`, and `?touchControls=1`.

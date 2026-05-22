# Project Guidelines

## Scope

- This repository is a Vite + TypeScript + Phaser 3 browser game.
- Use this root `AGENTS.md` as the single project-wide instruction file for the repo.
- See [README.md](README.md) for gameplay rules, debug toggles, and deployment notes.
- See [docs/base-prompt.md](docs/base-prompt.md) for the original design and art direction.

## Architecture

- `src/main.ts` owns the main Phaser scene, runtime state, input handling, HUD, and debug overlays.
- `src/gameConfig.ts` is the source of truth for balance constants, spawn pacing, repair values, and progression. Prefer updating config over scattering new literals through scene code.
- `src/levels/` contains procedural level generation, validation, catalog selection, pathfinding, and time-of-day logic.
- `src/sceneVariants.ts` and the asset registries should stay the place where variant- and asset-selection logic lives; prefer extending those registries instead of hardcoding new asset paths in scene code.

## Assets And Tooling

- Treat built atlas manifests and generated sprite sheets in `public/assets/` as generated outputs when a matching source exists under `public/assets/atlas-sources/` or a builder in `tools/` produces them.
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
- Run `npm test` before handoff when a change affects gameplay, assets, or build tooling. The test script validates world-enemy assets, typechecks, lints, and builds.
- For asset-pipeline changes, run the relevant script as needed: `npm run build:atlases`, `npm run validate:atlases`, `npm run build:world-enemies`, `npm run validate:world-enemies`, or `npm run build:scene-variants`.
- Use `npm run dev` for manual verification. The README documents useful debug flags such as `?debugGame=1`, `?debugLevel=1`, `?debugTouch=1`, and `?touchControls=1`.
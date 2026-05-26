# Refactoring Plan: `src/main.ts`

**Goal:** Reduce `main.ts` from **3826 lines → ~800 lines** by extracting 8 domain modules with typed interfaces. Each extracted module gets co-located `vitest` tests.

**Status:** 🟢 Phase 0 in progress

---

## Phase 0: Test Infrastructure

Install `vitest`, add test config, write smoke test.

---

## Phase 1: Type Foundation

Add typed entity interfaces (`PlayerEntity`, `EnemyEntity`, `BuildingEntity`, `GameState`, etc.) to `gameTypes.ts`. Remove `[key: string]: any` from `SceneAPI` and `FairyGuildScene`. Replace each `any` property with its real type.

**Files:** `gameTypes.ts`, `sceneAPI.ts`, `main.ts`

---

## Phase 2: Pure-Logic Module Extractions

### 2a — `src/levelFlow.ts` (+ `src/levelFlow.test.ts`)

Level lifecycle: countdown, round start, clear check, level complete, world progression.

**Functions:** `getCurrentRoundTitle`, `getNextWorldProgressionState`, `createRunResumeSnapshot`, `clearLevelTimers`, `addLevelTimer`, `startLevelCountdown`, `showCountdownLabel`, `startLevelRound`, `checkLevelClear`, `completeLevel`

**Tests:** Round title formatting, progression state machine (boss→next world), spawn count calculation, clear condition logic, timer setup.

### 2b — `src/enemySpawning.ts` (+ `src/enemySpawning.test.ts`)

Enemy archetype/variant selection, stat formulas, visual selection, enemy creation.

**Functions:** `pickWeighted`, `getEnemyArchetype`, `getEnemyVariant`, `getEnemyDisplayName`, `getEnemyFrameKey`, `getWorldEliteVisual`, `getBossVisual`, `spawnRoundEnemy`, `spawnEnemy`, `spawnBossEnemy`

**Tests:** Weighted selection distribution, archetype unlock levels, variant stat scaling formulas (hp/speed/damage at different levels), boss vs regular stat calculation, elite visual eligibility.

### 2c — `src/enemyAI.ts` (+ `src/enemyAI.test.ts`)

Enemy targeting, path following, building damage, retreat logic.

**Functions:** `updateEnemies`, `getEnemyTarget`, `getNearestForestExit`

**Tests:** Path waypoint following, target switching when building destroyed, player proximity damage timing, retreat behavior, nearest forest exit selection.

---

## Phase 3: Stateful System Modules

### 3a — `src/repairSystem.ts` (+ `src/repairSystem.test.ts`)

Repair mode toggle, target finding, outline, execution.

**Functions:** `toggleRepairMode`, `setRepairMode`, `getFootprintCells`, `getBuildingFootprintCells`, `getRepairDistanceToBuilding`, `getNearestDamagedBuilding`, `getRepairModeTarget`, `getRepairModeTargetState`, `tryRepairBuilding`, outline rendering helpers

**Tests:** Footprint cell calculation (odd/even footprints), distance computation across footprint cells, nearest damaged building selection, gold/cooldown validation, target state determination.

### 3b — `src/generatedLevelSpawning.ts` (+ `src/generatedLevelSpawning.test.ts`)

Generated level spawn point caching, route scoring, spawn selection.

**Functions:** `isoToGridCell`, `getGeneratedEdgeSpawnPoints`, `getGeneratedFallbackSpawnAnchors`, `getGeneratedPlayableEdgeCells`, `buildGeneratedSpawnCache`, `getGeneratedSpawnIso`, `jitterGeneratedSpawnPoint`, `getGeneratedRouteScores`, `selectGeneratedEnemyRoute`

**Tests:** Edge cell generation bounds, fallback anchor midpoint math, spawn cache deduplication, route scoring formula, walkable grid validation.

### 3c — `src/buildingSystem.ts` (+ `src/buildingSystem.test.ts`)

Building health bars, damage, repair state, village safety.

**Functions:** `getBuildingHealthColor`, `updateBuildingHealthBar`, `bumpBuilding`, `updateBuildingRepairState`, `updateVillageSafety`

**Tests:** Health color thresholds, village safety weighted average, building HP clamping.

---

## Phase 4: UI/Overlay Modules

### 4a — `src/hudSystem.ts` (+ `src/hudSystem.test.ts`)

HUD rendering: top bar, hearts, inventory panel, controls hint.

**Functions:** `createHud`, `createTopBar`, `createControlsHint`, `createInventoryPanel`, `rebuildInventoryPanel`, `toggleInventory`, `updateHud`, `renderHearts`, `truncateGuildNote`

**Testable:** `truncateGuildNote` (pure string logic)

### 4b — `src/overlaySystem.ts` (+ `src/overlaySystem.test.ts`)

Splash/countdown/level-up/game-over overlays and layout helpers.

**Functions:** All overlay creation + display + `isCompactOverlayLayout`, `getOverlayContentOffset`, layout functions, `showSplashScreen`, `showLevelUpScreen`, `showGameOverScreen`, `chooseLevelUpgrade`

**Testable:** Layout math, state transitions, level-up progress bar logic

---

## Phase 5: main.ts Cleanup

Remove all delegation methods that now forward to extracted modules. main.ts retains ~800 lines: scene lifecycle, asset loading, input setup, render orchestration, update loop routing.

---

## Execution Order

| # | Phase | Complexity | Est. Lines Removed | Test Count |
|---|-------|-----------|-------------------|------------|
| 0 | Test infra | Low | 0 | 1 |
| 1 | Type foundation | Low | 0 | 0 |
| 2a | levelFlow | Low | ~90 | 10–15 |
| 2b | enemySpawning | Medium | ~200 | 15–20 |
| 2c | enemyAI | Medium | ~80 | 8–10 |
| 3a | repairSystem | Medium | ~150 | 10–12 |
| 3b | genLevelSpawning | Medium | ~140 | 8–10 |
| 3c | buildingSystem | Low | ~70 | 5–8 |
| 4a | hudSystem | Medium | ~100 | 2 |
| 4b | overlaySystem | High | ~350 | 8–10 |
| 5 | main.ts cleanup | Low | ~3000→800 | 0 |

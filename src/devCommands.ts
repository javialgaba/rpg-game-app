import * as Phaser from 'phaser';
import { WORLD_SEQUENCE, WORLD_ENEMY_THEMES, REPAIR_COST } from './gameConfig';
import type { SeasonPreset } from './sceneVariants';

export function isDebugAutomationEnabled() {
  return new URLSearchParams(window.location.search).has('debugAutomation');
}

export function getDebugAutomationHost() {
  return document.querySelector('#game');
}

export function toDebugSlug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getDebugBuildingSummary(scene) {
  return scene.buildings
    .map((building) => `${toDebugSlug(building.levelPlacementId ?? building.name)}:${building.hp}/${building.max}`)
    .join('|');
}

export function setDebugCommandResult(command, result) {
  const host = getDebugAutomationHost();
  if (!host) {
    return;
  }
  host.setAttribute('data-debug-last-command', String(command));
  host.setAttribute('data-debug-last-result', String(result));
}

export function findDebugBuilding(scene, query) {
  const normalized = toDebugSlug(query);
  if (!normalized) {
    return null;
  }
  return scene.buildings.find((building) => {
    const candidates = [
      building.levelPlacementId,
      building.name,
    ].map((value) => toDebugSlug(value));
    if (normalized === 'house') {
      return candidates.includes('cottage') || candidates.includes('bakery') || candidates.includes('house-1') || candidates.includes('house-2');
    }
    return candidates.includes(normalized);
  }) ?? null;
}

export function resolveDebugTeleportPoint(scene, query) {
  const normalized = toDebugSlug(query);
  if (!scene.player) {
    return null;
  }
  if (!normalized || normalized === 'player') {
    return { x: scene.player.iso.x, y: scene.player.iso.y };
  }
  if (normalized === 'spawn' || normalized === 'player-spawn') {
    return scene.generatedLevel?.playerSpawn
      ? { x: scene.generatedLevel.playerSpawn.x, y: scene.generatedLevel.playerSpawn.y }
      : { x: scene.player.iso.x, y: scene.player.iso.y };
  }
  if (normalized === 'center' && scene.generatedLevel) {
    const { minX, minY, maxX, maxY } = scene.generatedLevel.playableBounds;
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }
  const building = findDebugBuilding(scene, normalized);
  if (!building) {
    return null;
  }
  const footprintCells = building.footprintCells ?? scene.getFootprintCells(building.iso.x, building.iso.y, building.footprint);
  const minX = Math.min(...footprintCells.map((cell) => cell.x));
  const maxX = Math.max(...footprintCells.map((cell) => cell.x));
  const minY = Math.min(...footprintCells.map((cell) => cell.y));
  const maxY = Math.max(...footprintCells.map((cell) => cell.y));
  const candidates = [
    { x: (minX + maxX) / 2, y: maxY + 1 },
    { x: maxX + 1, y: (minY + maxY) / 2 },
    { x: (minX + maxX) / 2, y: minY - 1 },
    { x: minX - 1, y: (minY + maxY) / 2 },
  ];
  return candidates.find((point) => !scene.generatedLevelActive || scene.isPlayerRecoveryAnchor(point)) ?? candidates[0];
}

export function teleportPlayerToDebugTarget(scene, query) {
  const point = resolveDebugTeleportPoint(scene, query);
  if (!point || !scene.player) {
    return false;
  }
  scene.player.iso.x = point.x;
  scene.player.iso.y = point.y;
  scene.clampIso(scene.player.iso, 1.2);
  scene.recoverPlayerToSafeAnchor(true);
  scene.rememberPlayerSafePosition();
  scene.lastPointerIso = { x: scene.player.iso.x, y: scene.player.iso.y };
  scene.positionPlayerAtCurrentIso();
  return true;
}

export function teleportPlayerToDebugIso(scene, rawX, rawY) {
  const x = Number(rawX);
  const y = Number(rawY);
  if (!scene.player || !Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }
  scene.player.iso.x = x;
  scene.player.iso.y = y;
  scene.clampIso(scene.player.iso, 1.2);
  if (!scene.isPlayerFootprintWalkable(scene.player.iso)) {
    scene.recoverPlayerToSafeAnchor(true, true);
  } else {
    scene.rememberPlayerSafePosition();
  }
  scene.lastPointerIso = { x: scene.player.iso.x, y: scene.player.iso.y };
  scene.positionPlayerAtCurrentIso();
  return true;
}

export function triggerDebugSeasonTransition(scene) {
  const nextIndex = (scene.state.worldIndex + 1) % WORLD_SEQUENCE.length;
  const looped = nextIndex === 0;
  const nextProgression = {
    worldIndex: nextIndex,
    worldKey: WORLD_SEQUENCE[nextIndex],
    worldRound: 1,
    bossRound: false,
    worldCycle: scene.state.worldCycle + (looped ? 1 : 0),
  };
  const theme = WORLD_ENEMY_THEMES[nextProgression.worldKey as SeasonPreset];
  const transitionNote = `${theme.label} debug transition.`;
  return scene.restartForWorldProgression(nextProgression, transitionNote);
}

export function syncDevDiagnostics(scene) {
  if (!(import.meta.env.DEV || isDebugAutomationEnabled())) {
    return;
  }
  const host = getDebugAutomationHost();
  if (!host) {
    return;
  }
  const repairTarget = scene.state.phase === 'playing' ? scene.getNearestDamagedBuilding() : null;
  const repairTargetDamaged = repairTarget && repairTarget.hp < repairTarget.max;
  host.setAttribute('data-phase', String(scene.state.phase ?? ''));
  host.setAttribute('data-map-mode', scene.generatedLevelActive ? 'generated' : 'static');
  host.setAttribute('data-level', String(scene.state.level ?? 0));
  host.setAttribute('data-gold', String(scene.state.gold ?? 0));
  host.setAttribute('data-world-key', String(scene.state.worldKey ?? ''));
  host.setAttribute('data-world-round', String(scene.state.worldRound ?? 0));
  host.setAttribute('data-world-cycle', String(scene.state.worldCycle ?? 0));
  host.setAttribute('data-boss-round', scene.state.bossRound ? '1' : '0');
  host.setAttribute('data-game-over-reason', String(scene.state.gameOverReason ?? ''));
  host.setAttribute('data-hero-class', String(scene.heroClass ?? ''));
  host.setAttribute('data-pending-hero-class', String(scene.pendingHeroClass ?? ''));
  host.setAttribute('data-splash-ready', scene.pendingHeroClass ? '1' : '0');
  host.setAttribute('data-repair-target', repairTarget ? toDebugSlug(repairTarget.name) : '');
  host.setAttribute('data-repair-affordable', repairTargetDamaged ? (scene.state.gold >= REPAIR_COST ? '1' : '0') : '');
  host.setAttribute('data-enemies', String(scene.enemies.length));
  host.setAttribute('data-level-spawns-pending', String(scene.levelSpawnsPending));
  host.setAttribute('data-level-required-defeats', String(scene.levelRequiredDefeats));
  host.setAttribute('data-level-defeats', String(scene.levelDefeatsThisRound));
  host.setAttribute('data-level-spawned-count', String(scene.levelSpawnedCount));
  host.setAttribute('data-valid-spawn-points', String(scene.generatedValidSpawnPoints?.length ?? 0));
  host.setAttribute('data-board-seed', String(scene.generatedLevel?.config.seed ?? ''));
  host.setAttribute('data-board-config-id', String(scene.generatedLevelConfigId ?? ''));
  host.setAttribute('data-building-summary', getDebugBuildingSummary(scene));
  const movementDebug = scene.getPlayerMovementDebugState?.();
  host.setAttribute('data-player-iso-x', String(scene.player?.iso.x ?? ''));
  host.setAttribute('data-player-iso-y', String(scene.player?.iso.y ?? ''));
  host.setAttribute('data-player-footprint-walkable', movementDebug?.footprintWalkable ? '1' : '0');
  host.setAttribute('data-player-recovery-anchor', movementDebug?.recoveryAnchor ? '1' : '0');
  host.setAttribute('data-player-visible-exits', movementDebug?.escapeDirections.join('|') ?? '');
  host.setAttribute('data-player-movement-rejected', movementDebug?.rejectedReason ?? '');
  host.setAttribute('data-player-runtime-dead-end', movementDebug?.runtimeDeadEnd ? '1' : '0');
  host.setAttribute('data-player-active-input', movementDebug?.activeIntent ? JSON.stringify(movementDebug.activeIntent.screen) : '');
  host.setAttribute('data-player-selected-travel', movementDebug?.movementResult?.selectedScreen
    ? JSON.stringify(movementDebug.movementResult.selectedScreen)
    : '');
  host.setAttribute('data-player-candidates', JSON.stringify(movementDebug?.movementResult?.candidates ?? []));
  host.setAttribute('data-player-movement-trace', JSON.stringify(scene.playerMovementTrace ?? []));
  const occlusionDebug = scene.getPlayerOcclusionDebugState?.();
  host.setAttribute('data-player-occluders', String(occlusionDebug?.registered ?? 0));
  host.setAttribute('data-player-faded-occluders', occlusionDebug?.activeLabels.join('|') ?? '');
  host.setAttribute('data-debug-enemies-frozen', scene.debugEnemiesFrozen ? '1' : '0');
}

export function consumeDevCommand(scene) {
  if (!(import.meta.env.DEV || isDebugAutomationEnabled())) {
    return;
  }
  const host = getDebugAutomationHost();
  const command = host?.getAttribute('data-debug-command');
  if (!host || !command) {
    return;
  }
  host.removeAttribute('data-debug-command');
  let result = 'unknown-command';
  if (command === 'clearRound') {
    scene.enemies.slice().forEach((enemy) => scene.damageEnemy(enemy, enemy.hp + 999, 'debug'));
    result = 'ok';
  } else if (command.startsWith('chooseUpgrade:')) {
    const index = Number(command.split(':')[1]);
    if (scene.state.phase === 'levelUp' && Number.isInteger(index)) {
      scene.chooseLevelUpgrade(Phaser.Math.Clamp(index, 0, 1));
      result = `upgrade:${Phaser.Math.Clamp(index, 0, 1)}`;
    } else {
      result = 'ignored-levelup-inactive';
    }
  } else if (command.startsWith('chooseHero:')) {
    const choice = command.split(':')[1];
    if (choice === 'warrior' || choice === 'archer' || choice === 'sorcerer') {
      scene.selectHeroClass(choice);
      result = `hero:${choice}`;
    } else {
      result = 'invalid-hero';
    }
  } else if (command === 'startGame') {
    scene.startGameFromSplash();
    result = scene.state.phase === 'splash' ? 'awaiting-hero' : 'ok';
  } else if (command === 'startRound') {
    if (scene.state.phase === 'countdown') {
      scene.startLevelRound();
      result = 'ok';
    } else {
      result = 'ignored-countdown-inactive';
    }
  } else if (command.startsWith('setGold:')) {
    const value = Number(command.split(':')[1]);
    if (Number.isFinite(value)) {
      scene.state.gold = Math.max(0, Math.round(value));
      result = `gold:${scene.state.gold}`;
    } else {
      result = 'invalid-gold';
    }
  } else if (command.startsWith('teleport:')) {
    const target = command.split(':')[1];
    result = teleportPlayerToDebugTarget(scene, target) ? `teleport:${toDebugSlug(target)}` : 'missing-teleport-target';
  } else if (command.startsWith('teleportIso:')) {
    const [, rawX, rawY] = command.split(':');
    result = teleportPlayerToDebugIso(scene, rawX, rawY) ? `teleport-iso:${rawX}:${rawY}` : 'invalid-teleport-iso';
  } else if (command === 'freezeEnemies') {
    scene.debugEnemiesFrozen = true;
    scene.clearProjectiles();
    result = 'enemies:frozen';
  } else if (command === 'resumeEnemies') {
    scene.debugEnemiesFrozen = false;
    result = 'enemies:resumed';
  } else if (command.startsWith('damageBuilding:')) {
    const [, rawTarget, rawAmount] = command.split(':');
    const building = findDebugBuilding(scene, rawTarget);
    if (!building) {
      result = 'missing-building';
    } else {
      const requestedAmount = Number(rawAmount ?? '18');
      const amount = Number.isFinite(requestedAmount) ? Math.max(1, Math.round(requestedAmount)) : 18;
      const minHp = building.name === 'Castle' ? 1 : 0;
      building.hp = Math.max(minHp, building.hp - amount);
      building.underAttackUntil = scene.time.now + 650;
      scene.updateBuildingRepairState(building);
      scene.updateVillageSafety();
      result = `building:${toDebugSlug(building.name)}:${building.hp}`;
    }
  } else if (command === 'repairNearest') {
    scene.tryRepairBuilding();
    result = 'repair:attempted';
  } else if (command === 'advanceSeason') {
    result = triggerDebugSeasonTransition(scene);
  }
  setDebugCommandResult(command, result);
  if (command === 'advanceSeason') {
    return;
  }
}
